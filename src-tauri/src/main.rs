#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::fs;
use std::io::Read;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::Instant;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const MAX_TREE_ENTRIES: usize = 20_000;
const IGNORED_DIRS: &[&str] = &["node_modules", "target", "_minted", "__pycache__"];
const TECTONIC_URL: &str = "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.17.0/tectonic-0.17.0-x86_64-pc-windows-msvc.zip";

/// PID of the running compiler, so a newer compile or the Stop button can kill it.
struct CompileState(Mutex<Option<u32>>);

type Res<T> = Result<T, String>;

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

fn app_dir() -> PathBuf {
    let base = std::env::var_os("APPDATA").map(PathBuf::from).unwrap_or_else(|| PathBuf::from("."));
    base.join("Galley")
}

fn command(program: &Path) -> Command {
    let mut c = Command::new(program);
    c.creation_flags(CREATE_NO_WINDOW);
    c
}

// ---------- settings ----------

#[tauri::command]
fn load_settings() -> String {
    fs::read_to_string(app_dir().join("settings.json")).unwrap_or_default()
}

#[tauri::command]
fn save_settings(json: String) -> Res<()> {
    let dir = app_dir();
    fs::create_dir_all(&dir).map_err(err)?;
    // Write-then-rename so a crash mid-write never leaves a truncated settings file.
    let tmp = dir.join("settings.json.tmp");
    fs::write(&tmp, json).map_err(err)?;
    fs::rename(&tmp, dir.join("settings.json")).map_err(err)
}

#[tauri::command]
fn launch_arg() -> Option<String> {
    std::env::args().nth(1)
}

// ---------- files ----------

#[derive(Serialize)]
struct Entry {
    name: String,
    path: String,
    dir: bool,
    children: Vec<Entry>,
}

fn walk(dir: &Path, show_hidden: bool, budget: &mut usize) -> Vec<Entry> {
    let Ok(rd) = fs::read_dir(dir) else { return vec![] };
    let mut out: Vec<Entry> = rd
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().into_owned();
            let is_dir = e.file_type().ok()?.is_dir();
            if !show_hidden && (name.starts_with('.') || (is_dir && IGNORED_DIRS.contains(&name.as_str()))) {
                return None;
            }
            Some((name, e.path(), is_dir))
        })
        .map(|(name, path, dir)| Entry { name, path: path.to_string_lossy().into_owned(), dir, children: vec![] })
        .collect();
    out.sort_by(|a, b| b.dir.cmp(&a.dir).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    for e in out.iter_mut() {
        if *budget == 0 {
            break;
        }
        *budget -= 1;
        if e.dir {
            e.children = walk(Path::new(&e.path), show_hidden, budget);
        }
    }
    out
}

/// Runs blocking work (disk walks, child processes) off the async runtime's worker threads.
async fn blocking<T: Send + 'static>(f: impl FnOnce() -> Res<T> + Send + 'static) -> Res<T> {
    tauri::async_runtime::spawn_blocking(f).await.map_err(err)?
}

// ponytail: full recursive listing (capped) instead of lazy per-folder loading; switch to lazy if huge trees matter.
#[tauri::command]
async fn list_tree(root: String, show_hidden: bool) -> Res<Vec<Entry>> {
    blocking(move || {
        let mut budget = MAX_TREE_ENTRIES;
        Ok(walk(Path::new(&root), show_hidden, &mut budget))
    })
    .await
}

#[tauri::command]
fn read_text(path: String) -> Res<String> {
    let bytes = fs::read(&path).map_err(err)?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

#[tauri::command]
fn write_text(path: String, text: String) -> Res<()> {
    fs::write(&path, text).map_err(err)
}

#[tauri::command]
fn read_bytes(path: String) -> Res<tauri::ipc::Response> {
    fs::read(&path).map(tauri::ipc::Response::new).map_err(err)
}

#[tauri::command]
fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
fn create_file(path: String, text: String) -> Res<()> {
    let p = Path::new(&path);
    if p.exists() {
        return Err(format!("'{}' already exists", p.display()));
    }
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(err)?;
    }
    fs::write(p, text).map_err(err)
}

#[tauri::command]
fn create_dir(path: String) -> Res<()> {
    if Path::new(&path).exists() {
        return Err(format!("'{path}' already exists"));
    }
    fs::create_dir_all(&path).map_err(err)
}

#[tauri::command]
fn rename_path(from: String, to: String) -> Res<()> {
    // A case-only rename targets the same file on Windows, so "exists" would be a false alarm.
    let case_only = from.to_lowercase() == to.to_lowercase();
    if !case_only && Path::new(&to).exists() {
        return Err(format!("'{to}' already exists"));
    }
    fs::rename(&from, &to).map_err(err)
}

#[tauri::command]
fn trash_path(path: String) -> Res<()> {
    trash::delete(&path).map_err(err)
}

#[tauri::command]
fn reveal(path: String) {
    let _ = Command::new("explorer.exe").raw_arg(format!("/select,\"{path}\"")).spawn();
}

#[tauri::command]
fn open_path(path: String) {
    let _ = Command::new("explorer.exe").arg(path).spawn();
}

// ---------- compiler ----------

fn find_on_path(exe: &str) -> Option<PathBuf> {
    let paths = std::env::var_os("PATH")?;
    std::env::split_paths(&paths).map(|d| d.join(exe)).find(|p| p.is_file())
}

fn bundled_tectonic() -> PathBuf {
    app_dir().join("bin").join("tectonic.exe")
}

/// Resolves the executable for an engine: explicit path, then PATH, then Galley's own copy of Tectonic.
fn resolve_engine(engine: &str, custom: &str) -> Option<PathBuf> {
    if !custom.trim().is_empty() {
        let p = PathBuf::from(custom.trim());
        return p.is_file().then_some(p);
    }
    find_on_path(&format!("{engine}.exe")).or_else(|| {
        let b = bundled_tectonic();
        (engine == "tectonic" && b.is_file()).then_some(b)
    })
}

#[tauri::command]
fn engine_path(engine: String, custom: String) -> Option<String> {
    resolve_engine(&engine, &custom).map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
async fn install_tectonic() -> Res<String> {
    blocking(|| {
        let dir = app_dir().join("bin");
        fs::create_dir_all(&dir).map_err(err)?;
        let zip = dir.join("tectonic.zip");
        // Paths travel as environment variables so quotes in a user name can't break the script.
        let script = "$ProgressPreference='SilentlyContinue'; $ErrorActionPreference='Stop'; \
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; \
            try { \
              Invoke-WebRequest -UseBasicParsing -TimeoutSec 300 -Uri $env:KT_URL -OutFile $env:KT_ZIP; \
              Expand-Archive -LiteralPath $env:KT_ZIP -DestinationPath $env:KT_DIR -Force \
            } finally { Remove-Item -LiteralPath $env:KT_ZIP -ErrorAction SilentlyContinue }";
        let out = command(Path::new("powershell.exe"))
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .env("KT_URL", TECTONIC_URL)
            .env("KT_ZIP", &zip)
            .env("KT_DIR", &dir)
            .output()
            .map_err(err)?;
        let exe = bundled_tectonic();
        if out.status.success() && exe.is_file() {
            Ok(exe.to_string_lossy().into_owned())
        } else {
            Err(format!("Could not download Tectonic: {}", String::from_utf8_lossy(&out.stderr).trim()))
        }
    })
    .await
}

#[derive(Serialize)]
struct CompileResult {
    ok: bool,
    code: Option<i32>,
    output: String,
    log: String,
    pdf: Option<String>,
    ms: u128,
}

fn engine_args(engine: &str, file: &str) -> Vec<String> {
    let v: &[&str] = match engine {
        "tectonic" => &["--synctex", "--keep-logs"],
        "latexmk" => &["-pdf", "-interaction=nonstopmode", "-file-line-error", "-synctex=1"],
        _ => &["-interaction=nonstopmode", "-file-line-error", "-synctex=1"],
    };
    v.iter().map(|s| s.to_string()).chain([file.to_string()]).collect()
}

fn kill_tree(pid: u32) {
    let _ = command(Path::new("taskkill.exe")).args(["/T", "/F", "/PID", &pid.to_string()]).output();
}

#[tauri::command]
fn cancel_compile(state: tauri::State<CompileState>) {
    if let Some(pid) = state.0.lock().unwrap().take() {
        kill_tree(pid);
    }
}

#[tauri::command]
async fn compile(app: tauri::AppHandle, file: String, engine: String, custom: String) -> Res<CompileResult> {
    blocking(move || run_compile(&app.state::<CompileState>(), &file, &engine, &custom)).await
}

fn run_compile(state: &CompileState, file: &str, engine: &str, custom: &str) -> Res<CompileResult> {
    let exe = resolve_engine(engine, custom).ok_or_else(|| format!("ENGINE_MISSING:{engine}"))?;
    let path = PathBuf::from(file);
    let dir = path.parent().ok_or("Invalid file")?.to_path_buf();
    let name = path.file_name().ok_or("Invalid file")?.to_string_lossy().into_owned();
    let stem = path.with_extension("");

    let started = Instant::now();
    let mut child = command(&exe)
        .args(engine_args(engine, &name))
        .current_dir(&dir)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(err)?;
    if let Some(old) = state.0.lock().unwrap().replace(child.id()) {
        kill_tree(old);
    }

    // Drain stderr on a thread so a chatty compiler can't deadlock on a full pipe.
    let mut stderr = child.stderr.take().unwrap();
    let err_thread = std::thread::spawn(move || {
        let mut s = Vec::new();
        let _ = stderr.read_to_end(&mut s);
        s
    });
    let mut stdout = Vec::new();
    let _ = child.stdout.take().unwrap().read_to_end(&mut stdout);
    let status = child.wait();
    // Forget the PID as soon as the process is gone so Stop can never kill a reused PID.
    {
        let mut guard = state.0.lock().unwrap();
        if *guard == Some(child.id()) {
            *guard = None;
        }
    }
    let status = status.map_err(err)?;
    let stderr = err_thread.join().unwrap_or_default();

    let pdf = stem.with_extension("pdf");
    let mut output = String::from_utf8_lossy(&stdout).into_owned();
    output.push_str(&String::from_utf8_lossy(&stderr));
    Ok(CompileResult {
        ok: status.success(),
        code: status.code(),
        output,
        log: fs::read(stem.with_extension("log")).map(|b| String::from_utf8_lossy(&b).into_owned()).unwrap_or_default(),
        pdf: pdf.is_file().then(|| pdf.to_string_lossy().into_owned()),
        ms: started.elapsed().as_millis(),
    })
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show Galley", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("Galley")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, e| match e.id().as_ref() {
            "show" => show_main(app),
            // The frontend owns quitting so unsaved-changes prompts and session saving still run.
            "quit" => {
                show_main(app);
                let _ = app.emit("tray-quit", ());
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, e| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = e {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(CompileState(Mutex::new(None)))
        .setup(|app| Ok(setup_tray(app.handle())?))
        .invoke_handler(tauri::generate_handler![
            load_settings,
            save_settings,
            launch_arg,
            list_tree,
            read_text,
            write_text,
            read_bytes,
            path_exists,
            create_file,
            create_dir,
            rename_path,
            trash_path,
            reveal,
            open_path,
            engine_path,
            install_tectonic,
            cancel_compile,
            compile
        ])
        .run(tauri::generate_context!())
        .expect("error while running Galley");
}

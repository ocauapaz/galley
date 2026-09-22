// Command palette entries and title-bar menus. `a` carries the app state and actions owned by main.js.
import { invoke } from '@tauri-apps/api/core'
import { openSearchPanel, gotoLine as gotoLineDialog } from '@codemirror/search'
import { settings, setSettings, THEMES } from './settings.js'
import { editor, closeTab, insertSnippet } from './editor.js'
import { newFile, newFolder, refresh as refreshExplorer } from './explorer.js'
import { setZoom, zoomBy } from './pdfview.js'
import { openSettings } from './settings-ui.js'
import { allSnippets } from './panels.js'
import { basename } from './ui.js'

const isTex = p => /\.(tex|ltx)$/i.test(p || '')

export function commandList(a) {
  const t = editor.active
  const { app } = a
  return [
    { label: 'Build: Compile', kbd: 'Ctrl+Enter', icon: 'play', run: () => a.compile() },
    { label: 'Build: Stop compiling', icon: 'stop', run: a.stopCompile },
    { label: 'Build: Show cursor position in PDF', kbd: 'Ctrl+Alt+J', icon: 'sync', run: () => a.forwardSync() },
    { label: 'Build: Choose main file…', icon: 'star', run: a.chooseMainFile },
    t && isTex(t.path) && { label: 'Build: Set current file as main file', icon: 'star', run: () => a.setMainFile(t.path) },
    app.pdfPath && { label: 'Build: Open PDF in default viewer', icon: 'external', run: () => invoke('open_path', { path: app.pdfPath }) },
    { label: 'File: New file…', kbd: 'Ctrl+N', icon: 'newFile', run: () => app.folder ? newFile() : a.newProject() },
    app.folder && { label: 'File: New folder…', icon: 'newFolder', run: () => newFolder() },
    { label: 'File: New project from template…', icon: 'newFile', run: a.newProject },
    { label: 'File: Open folder…', kbd: 'Ctrl+O', icon: 'folderOpen', run: () => a.openFolder() },
    { label: 'File: Open file…', icon: 'file', run: a.openFileDialog },
    t && { label: 'File: Save', kbd: 'Ctrl+S', icon: 'check', run: a.saveActive },
    { label: 'File: Save all', kbd: 'Ctrl+Shift+S', icon: 'check', run: a.saveAll },
    t && { label: 'File: Close tab', kbd: 'Ctrl+W', icon: 'close', run: () => closeTab(t.path) },
    app.folder && { label: 'File: Close folder', icon: 'folder', run: a.closeFolder },
    t && { label: 'File: Reveal active file in File Explorer', icon: 'external', run: () => invoke('reveal', { path: t.path }) },
    app.folder && { label: 'File: Refresh explorer', icon: 'refresh', run: refreshExplorer },
    { label: 'View: Toggle sidebar', kbd: 'Ctrl+Shift+B', icon: 'sidebar', run: () => a.toggleSidebar() },
    { label: 'View: Toggle PDF preview', kbd: 'Ctrl+Alt+P', icon: 'pdf', run: a.togglePdf },
    { label: 'View: Toggle problems panel', kbd: 'Ctrl+J', icon: 'panel', run: () => a.togglePanel() },
    { label: 'View: Explorer', icon: 'files', run: () => a.toggleSidebar('files') },
    { label: 'View: Outline', icon: 'outline', run: () => a.toggleSidebar('outline') },
    { label: 'View: Snippets', icon: 'snippets', run: () => a.toggleSidebar('snippets') },
    { label: 'View: Math symbols', icon: 'symbols', run: () => a.toggleSidebar('symbols') },
    { label: 'View: Zoom PDF in', kbd: 'Ctrl+=', icon: 'zoomIn', run: () => zoomBy(1.15) },
    { label: 'View: Zoom PDF out', kbd: 'Ctrl+-', icon: 'zoomOut', run: () => zoomBy(1 / 1.15) },
    { label: 'View: PDF fit width', icon: 'fitWidth', run: () => setZoom('width') },
    { label: 'View: PDF fit page', icon: 'fitPage', run: () => setZoom('page') },
    { label: 'View: Toggle dark PDF pages', icon: 'contrast', run: () => setSettings({ pdfInvert: !settings.pdfInvert }) },
    t && { label: 'Edit: Find and replace', kbd: 'Ctrl+F', icon: 'search', run: () => openSearchPanel(editor.view) },
    t && { label: 'Edit: Go to line…', kbd: 'Ctrl+Alt+G', icon: 'outline', run: () => gotoLineDialog(editor.view) },
    ...THEMES.map(th => ({ label: `Theme: ${th.name}`, icon: 'contrast', detail: settings.theme === th.id ? 'current' : '', run: () => setSettings({ theme: th.id }) })),
    { label: 'Preferences: Settings', kbd: 'Ctrl+,', icon: 'settings', run: () => openSettings() },
    { label: 'Preferences: Keyboard shortcuts', kbd: 'F1', icon: 'command', run: () => openSettings('keys') },
    { label: 'Preferences: Manage snippets', icon: 'snippets', run: () => openSettings('snippets') },
    ...(t ? allSnippets().map(s => ({ label: `Insert: ${s.name}`, detail: s.trigger, icon: 'snippets', run: () => insertSnippet(s.body) })) : []),
  ].filter(Boolean)
}

export function menu(name, a) {
  const { app } = a
  const menus = {
    file: () => [
      { label: 'New file…', kbd: 'Ctrl+N', icon: 'newFile', action: () => app.folder ? newFile() : a.newProject() },
      { label: 'New project…', icon: 'newFile', action: a.newProject },
      '-',
      { label: 'Open folder…', kbd: 'Ctrl+O', icon: 'folderOpen', action: () => a.openFolder() },
      { label: 'Open file…', icon: 'file', action: a.openFileDialog },
      ...settings.recent.slice(0, 5).map(p => ({ label: basename(p), icon: 'folder', action: () => a.openFolder(p) })),
      '-',
      { label: 'Save', kbd: 'Ctrl+S', icon: 'check', disabled: !editor.active, action: a.saveActive },
      { label: 'Save all', kbd: 'Ctrl+Shift+S', action: a.saveAll },
      { label: 'Close tab', kbd: 'Ctrl+W', disabled: !editor.active, action: () => closeTab(editor.active.path) },
      { label: 'Close folder', disabled: !app.folder, action: a.closeFolder },
      '-',
      { label: 'Settings', kbd: 'Ctrl+,', icon: 'settings', action: () => openSettings() },
      { label: 'Exit', action: a.requestClose },
    ],
    view: () => [
      { label: 'Command palette', kbd: 'Ctrl+Shift+P', icon: 'command', action: a.commandPalette },
      { label: 'Quick open', kbd: 'Ctrl+P', icon: 'search', action: a.quickOpen },
      '-',
      { label: 'Explorer', icon: 'files', action: () => a.toggleSidebar('files') },
      { label: 'Outline', icon: 'outline', action: () => a.toggleSidebar('outline') },
      { label: 'Snippets', icon: 'snippets', action: () => a.toggleSidebar('snippets') },
      { label: 'Math symbols', icon: 'symbols', action: () => a.toggleSidebar('symbols') },
      '-',
      { label: settings.sidebarVisible ? 'Hide sidebar' : 'Show sidebar', kbd: 'Ctrl+Shift+B', icon: 'sidebar', action: () => a.toggleSidebar() },
      { label: settings.pdfVisible ? 'Hide PDF preview' : 'Show PDF preview', kbd: 'Ctrl+Alt+P', icon: 'pdf', action: a.togglePdf },
      { label: settings.panelVisible ? 'Hide problems' : 'Show problems', kbd: 'Ctrl+J', icon: 'panel', action: () => a.togglePanel() },
      '-',
      { label: 'Theme…', icon: 'contrast', action: () => openSettings('appearance') },
    ],
    build: () => [
      { label: app.compiling ? 'Stop compiling' : 'Compile', kbd: 'Ctrl+Enter', icon: app.compiling ? 'stop' : 'play', action: () => app.compiling ? a.stopCompile() : a.compile() },
      { label: 'Show cursor position in PDF', kbd: 'Ctrl+Alt+J', icon: 'sync', action: () => a.forwardSync() },
      '-',
      { label: 'Choose main file…', icon: 'star', disabled: !app.folder, action: a.chooseMainFile },
      { label: 'Open PDF in default viewer', icon: 'external', disabled: !app.pdfPath, action: () => invoke('open_path', { path: app.pdfPath }) },
      '-',
      { label: 'Compilation settings…', icon: 'settings', action: () => openSettings('compile') },
    ],
    help: () => [
      { label: 'Keyboard shortcuts', kbd: 'F1', icon: 'command', action: () => openSettings('keys') },
      { label: 'Manage snippets', icon: 'snippets', action: () => openSettings('snippets') },
      { label: 'About Galley', icon: 'info', action: () => openSettings('about') },
    ],
  }
  return menus[name]()
}

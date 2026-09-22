@echo off
rem Builds Galley.exe (release) and build\Galley.zip with the README.
setlocal
cd /d "%~dp0"

if not exist node_modules (
  call npm install || goto :fail
)
call npm test || goto :fail
call npx tauri build --no-bundle || goto :fail

if not exist build mkdir build
copy /y "src-tauri\target\release\galley.exe" "build\Galley.exe" >nul || goto :fail
copy /y README.md "build\README.md" >nul || goto :fail
powershell -NoProfile -Command "Compress-Archive -Force -Path 'build\Galley.exe','build\README.md' -DestinationPath 'build\Galley.zip'" || goto :fail

echo.
echo Built build\Galley.exe and build\Galley.zip
exit /b 0

:fail
echo Build failed.
exit /b 1

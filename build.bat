@echo off
rem Builds the Galley installer (NSIS setup) into build\.
setlocal
cd /d "%~dp0"

if not exist node_modules (
  call npm install || goto :fail
)
call npm test || goto :fail
call npx tauri build || goto :fail

if not exist build mkdir build
copy /y "src-tauri\target\release\bundle\nsis\*-setup.exe" build\ >nul || goto :fail

echo.
echo Built the installer in build\
exit /b 0

:fail
echo Build failed.
exit /b 1

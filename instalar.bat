@echo off
setlocal enabledelayedexpansion

set "NODE_VER=22.11.0"
set "NODE_DIR=%LOCALAPPDATA%\Programs\nodejs"
set "NODE_ZIP=%TEMP%\nodejs-portable.zip"
set "PROJECT_DIR=%~dp0"

echo.
echo  ============================================
echo    Portal Safra - Instalacao
echo  ============================================
echo.

:: Verifica se ja instalado no diretório local
if exist "%NODE_DIR%\node.exe" (
    echo Node.js ja instalado em %NODE_DIR%
    set "PATH=%NODE_DIR%;%PATH%"
    goto :install_deps
)

:: Verifica se node esta no PATH do sistema
where node >nul 2>&1
if %ERRORLEVEL%==0 (
    echo Node.js ja encontrado no PATH.
    goto :install_deps
)

echo Node.js nao encontrado. Instalando versao portatil...
echo (sem necessidade de administrador)
echo.

echo [1/3] Baixando Node.js v%NODE_VER% (~30 MB)...
powershell -NoProfile -Command "(New-Object Net.WebClient).DownloadFile('https://nodejs.org/dist/v%NODE_VER%/node-v%NODE_VER%-win-x64.zip', '%NODE_ZIP%')"

if not exist "%NODE_ZIP%" (
    echo.
    echo ERRO: Download falhou. Verifique a internet.
    echo Se o erro persistir, acesse nodejs.org e baixe manualmente
    echo a versao LTS como arquivo .zip e extraia em:
    echo   %NODE_DIR%
    pause
    exit /b 1
)

echo [2/3] Extraindo...
if not exist "%LOCALAPPDATA%\Programs" mkdir "%LOCALAPPDATA%\Programs"
if exist "%NODE_DIR%" rmdir /s /q "%NODE_DIR%"
powershell -NoProfile -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%LOCALAPPDATA%\Programs' -Force; Rename-Item -Path '%LOCALAPPDATA%\Programs\node-v%NODE_VER%-win-x64' -NewName 'nodejs'"
del "%NODE_ZIP%" >nul 2>&1

if not exist "%NODE_DIR%\node.exe" (
    echo ERRO: Extracao falhou.
    pause
    exit /b 1
)

echo [3/3] Configurando PATH do usuario...
powershell -NoProfile -Command "$cur = [Environment]::GetEnvironmentVariable('PATH','User'); if ($cur -notlike '*nodejs*') { [Environment]::SetEnvironmentVariable('PATH', '%NODE_DIR%;' + $cur, 'User') }"
set "PATH=%NODE_DIR%;%PATH%"

echo Node.js v%NODE_VER% instalado!

:install_deps
echo.
echo Instalando dependencias do projeto (pode demorar alguns minutos)...
cd /d "%PROJECT_DIR%"

if exist "%NODE_DIR%\npm.cmd" (
    call "%NODE_DIR%\npm.cmd" install
) else (
    call npm install
)

if %ERRORLEVEL% neq 0 (
    echo.
    echo ERRO: Falha ao instalar dependencias.
    pause
    exit /b 1
)

echo.
echo  ============================================
echo   Instalacao concluida!
echo.
echo   Proximos passos:
echo    1. Preencha o SHAREPOINT_SITE_ID no .env.local
echo       (execute get-sharepoint-info.ps1 para descobrir)
echo    2. Abra um novo terminal e execute:  npm run dev
echo    3. Acesse:  http://localhost:3000
echo  ============================================
echo.
pause

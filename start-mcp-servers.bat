@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
cd /d "%PROJECT_DIR%"

where uvx >nul 2>nul
if errorlevel 1 (
    echo [Error] uvx not found in PATH. Install uv from https://docs.astral.sh/uv/.
    exit /b 1
)

where npx >nul 2>nul
if errorlevel 1 (
    echo [Error] npx not found in PATH. Install Node.js 20+ from https://nodejs.org/.
    exit /b 1
)

echo Starting MCP Git server for %PROJECT_DIR% ...
start "MCP Git Server" cmd /k "cd /d ""%PROJECT_DIR%"" && uvx mcp-server-git --repository ""%PROJECT_DIR%"""

echo Starting MCP filesystem server for %PROJECT_DIR% ...
start "MCP Filesystem Server" cmd /k "cd /d ""%PROJECT_DIR%"" && npx --yes @modelcontextprotocol/server-filesystem ""%PROJECT_DIR%"""

echo.
echo Close the launched windows to stop the servers.
echo.

endlocal


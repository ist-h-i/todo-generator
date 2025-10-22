@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
cd /d "%PROJECT_DIR%"

rem Resolve uvx path
set "UVX_CMD="
for /f "delims=" %%I in ('where uvx 2^>nul') do (
    if not defined UVX_CMD set "UVX_CMD=%%~fI"
)
if not defined UVX_CMD (
    echo [Error] uvx not found in PATH. Install uv from https://docs.astral.sh/uv/.
    exit /b 1
)

rem Resolve npx.cmd path
set "NPX_CMD="
for /f "delims=" %%I in ('where npx.cmd 2^>nul') do (
    if not defined NPX_CMD set "NPX_CMD=%%~fI"
)
if not defined NPX_CMD (
    echo [Error] npx not found in PATH. Install Node.js 20+ from https://nodejs.org/.
    exit /b 1
)

echo Starting MCP filesystem server for %PROJECT_DIR% ...
call :start_npx "MCP Filesystem Server" "--yes @modelcontextprotocol/server-filesystem ""%PROJECT_DIR%"""

echo Starting MCP memory server ...
call :start_npx "MCP Memory Server" "--yes @modelcontextprotocol/server-memory"

call :start_brave

echo Starting MCP fetch server ...
call :start_uvx "MCP Fetch Server" "mcp-server-fetch"

echo Starting MCP puppeteer server ...
call :start_npx "MCP Puppeteer Server" "--yes @modelcontextprotocol/server-puppeteer"

echo Starting MCP sequential thinking server ...
call :start_npx "MCP Sequential Thinking Server" "--yes @modelcontextprotocol/server-sequential-thinking"

echo Starting MCP time server ...
call :start_uvx "MCP Time Server" "mcp-server-time"

echo Starting MCP serena server ...
call :start_uvx "MCP Serena Server" "--from git+https://github.com/oraios/serena serena start-mcp-server --context codex --project ""%PROJECT_DIR%"""

call :start_magic

echo Starting MCP Playwright server ...
call :start_npx "MCP Playwright Server" "-y @playwright/mcp@latest"

echo.
echo Close the launched windows to stop the servers.
echo.

endlocal
exit /b

:start_npx
set "TITLE=%~1"
set "ARGS=%~2"
start "%TITLE%" /D "%PROJECT_DIR%" cmd.exe /k ""%NPX_CMD%" %ARGS%"
exit /b

:start_uvx
set "TITLE=%~1"
set "ARGS=%~2"
start "%TITLE%" /D "%PROJECT_DIR%" cmd.exe /k ""%UVX_CMD%" %ARGS%"
exit /b

:start_brave
set "BRAVE_VALUE=%BRAVE_API_KEY%"
if not defined BRAVE_VALUE (
    call :read_env_value BRAVE_API_KEY BRAVE_VALUE
)
if not defined BRAVE_VALUE (
    echo [Skip] BRAVE_API_KEY not configured. Skipping MCP Brave Search server.
    exit /b
)
if /I "%BRAVE_VALUE%"=="YOUR_BRAVE_API_KEY_HERE" (
    echo [Skip] BRAVE_API_KEY is still the placeholder. Skipping MCP Brave Search server.
    exit /b
)
set "BRAVE_API_KEY=%BRAVE_VALUE%"
echo Starting MCP Brave Search server ...
call :start_npx "MCP Brave Search Server" "--yes @modelcontextprotocol/server-brave-search"
exit /b

:start_magic
set "MAGIC_VALUE=%MAGIC_API_KEY%"
if not defined MAGIC_VALUE (
    call :read_env_value MAGIC_API_KEY MAGIC_VALUE
)
if not defined MAGIC_VALUE (
    if exist ".env" (
        echo [Skip] MAGIC_API_KEY not set in environment or .env. Skipping @21st-dev/magic server.
    ) else (
        echo [Skip] .env not found. Skipping @21st-dev/magic server.
    )
    exit /b
)
echo Starting @21st-dev/magic server ...
call :start_npx "MCP Magic Server" "-y dotenv -e .env -- ""%NPX_CMD%"" -y @21st-dev/magic@latest"
exit /b

:read_env_value
set "ENV_KEY=%~1"
set "OUT_VAR=%~2"
if not exist ".env" exit /b
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if /I "%%A"=="%ENV_KEY%" (
        set "%OUT_VAR%=%%B"
        exit /b
    )
)
exit /b


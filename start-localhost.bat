@echo off
setlocal

set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

set "BACKEND_DIR=%PROJECT_DIR%backend"
set "FRONTEND_DIR=%PROJECT_DIR%frontend"
set "VENV_DIR=%PROJECT_DIR%.venv"
set "VENV_PYTHON=%VENV_DIR%\Scripts\python.exe"

if not exist "%VENV_PYTHON%" (
    echo [Backend] Creating Python virtual environment at "%VENV_DIR%" ...
    py -m venv "%VENV_DIR%" 2>nul || python -m venv "%VENV_DIR%"
)

echo [Backend] Installing dependencies from backend\requirements.txt ...
"%VENV_PYTHON%" -m pip install -r "%BACKEND_DIR%\requirements.txt"

if not exist "%FRONTEND_DIR%\node_modules" (
    echo [Frontend] Installing npm dependencies in frontend\ ...
    pushd "%FRONTEND_DIR%"
    npm install
    popd
)

echo.
echo Launching Todo Generator services...
echo Close the spawned windows to stop the servers.
echo.

echo Starting backend on http://localhost:8000/ ...
start "Todo Generator Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && ""%VENV_PYTHON%"" -m uvicorn app.main:app --reload"

echo Starting frontend on http://localhost:4200/ ...
start "Todo Generator Frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm start"

echo.
echo Backend docs:   http://localhost:8000/docs
echo Frontend app:   http://localhost:4200/
echo.
endlocal

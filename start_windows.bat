@echo off

REM ============================================
REM PromptForge Server Startup Script (Windows)
REM ============================================

echo.
echo ============================================
echo    PromptForge - Starting up...
echo ============================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3 from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

echo [OK] Python found
python --version
echo.

REM Check if virtual environment exists
if not exist "venv\" (
    echo [SETUP] Creating virtual environment...
    python -m venv venv
    
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
    
    echo [OK] Virtual environment created
    echo.
)

REM Activate virtual environment
echo [SETUP] Activating virtual environment...
call venv\Scripts\activate.bat

REM --- Smart requirements installer ---
set REQ_HASH_FILE=venv\.requirements_hash

REM Compute current hash of requirements.txt
for /f "delims=" %%i in ('certutil -hashfile requirements.txt SHA256 ^| findstr /v "hash"') do set CURRENT_HASH=%%i

set NEED_INSTALL=1

REM Check if previous hash exists and matches
if exist "%REQ_HASH_FILE%" (
    set /p OLD_HASH=<%REQ_HASH_FILE%
    if "%CURRENT_HASH%"=="%OLD_HASH%" set NEED_INSTALL=0
)

if "%NEED_INSTALL%"=="1" (
    echo.
    echo [SETUP] Installing or updating dependencies...
    python -m pip install --upgrade pip
    pip install -r requirements.txt
    
    if errorlevel 1 (
        echo [ERROR] Failed to install requirements.
        pause
        exit /b 1
    )
    
    REM Save current hash
    echo %CURRENT_HASH% > %REQ_HASH_FILE%
    echo [OK] Dependencies installed/updated
) else (
    echo [OK] Requirements: No changes detected
)
echo.

REM Start the Flask server
echo.
echo ============================================
echo   PromptForge is running!
echo   Open your browser and go to:
echo.
echo     http://localhost:5000
echo.
echo   Press Ctrl+C to stop the server
echo ============================================
echo.

python app.py
pause

@echo off
setlocal enabledelayedexpansion
title SpotShrooms / OSIP Mushroom launcher
cd /d "%~dp0"

echo ============================================================
echo   SpotShrooms (OSIP Mushroom) - local launcher
echo ============================================================

REM --- 0. Check prerequisites -------------------------------------------
where python >nul 2>nul || (echo [ERROR] Python not found on PATH. Install Python 3.10+ and retry. & pause & exit /b 1)
where node   >nul 2>nul || (echo [ERROR] Node.js not found on PATH. Install Node 18+ and retry. & pause & exit /b 1)
where npm    >nul 2>nul || (echo [ERROR] npm not found on PATH. & pause & exit /b 1)
where git    >nul 2>nul || (echo [ERROR] git not found on PATH. & pause & exit /b 1)

REM --- 1. Backend dependencies ------------------------------------------
echo.
echo [1/5] Installing Python dependencies...
python -m pip install -r requirements.txt || (echo [ERROR] pip install failed. & pause & exit /b 1)

REM --- 2. Frontend dependencies (first run only) ------------------------
echo.
echo [2/5] Installing frontend dependencies...
if not exist "frontend\node_modules" (
    pushd frontend
    call npm install || (echo [ERROR] npm install failed. & popd & pause & exit /b 1)
    popd
) else (
    echo      node_modules already present - skipping.
)

REM --- 3. Download the project's YOLOv8 code (notebook) -----------------
echo.
echo [3/5] Fetching the YOLOv8 model code into yolo_model\ ...
git fetch origin >nul 2>nul
if not exist "yolo_model" mkdir yolo_model
git show origin/YOLO_Model_Code:Classification_Detection_Model.ipynb > "yolo_model\Classification_Detection_Model.ipynb" 2>nul
git show origin/YOLO_Model_Code:README.md > "yolo_model\README.md" 2>nul
if exist "yolo_model\Classification_Detection_Model.ipynb" (
    echo      Saved yolo_model\Classification_Detection_Model.ipynb
) else (
    echo      [WARN] Could not fetch the YOLO notebook ^(no network, or 'origin' missing^).
)

REM --- 4. Optional: install ultralytics for REAL YOLO detection ---------
echo.
set /p YOLO="Install ultralytics now to enable REAL YOLO detection? (~2-3 GB) [y/N]: "
if /i "!YOLO!"=="y" (
    echo      Installing ultralytics ...
    python -m pip install ultralytics
    echo      Next: train in the notebook, then copy best.pt to api\camera\weights\best.pt
) else (
    echo      Skipped. Dashboard runs with the mock camera; add best.pt later to go live.
)

REM --- 5. Launch backend + frontend in their own windows ----------------
echo.
echo [5/5] Starting servers...
start "OSIP Backend (FastAPI :8000)"  cmd /k "python -m uvicorn api.main:app --port 8000"
start "OSIP Frontend (Vite :5173)"    cmd /k "cd frontend && npm run dev"

echo.
echo Waiting for the dev server to come up...
timeout /t 6 /nobreak >nul
start "" http://localhost:5173

echo.
echo ============================================================
echo   Dashboard : http://localhost:5173
echo   API check : http://localhost:8000/api/health
echo   YOLO code : yolo_model\Classification_Detection_Model.ipynb
echo.
echo   Close the two server windows to stop the app.
echo ============================================================
pause
endlocal

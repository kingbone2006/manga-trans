@echo off
title MangaTrans Launcher
echo ===================================================
echo             KHOI DONG MANGATRANS
echo ===================================================
echo.

rem Kiem tra va khoi dong Local AI Server neu chua chay
curl -s http://127.0.0.1:8080/v1/models >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [1/2] Dang khoi dong Local AI Server (RTX 4050 GPU)...
    start /min "MangaTrans AI Server" "C:\Users\BoneLap\Desktop\manga-trans\bin\llama\llama-server.exe" -m "C:\Users\BoneLap\Desktop\manga-trans\models\Qwen2.5-VL-3B-Instruct.Q4_K_M.gguf" --mmproj "C:\Users\BoneLap\Desktop\manga-trans\models\Qwen2.5-VL-3B-Instruct.mmproj-fp16.gguf" --port 8080 -ngl 99 -c 8192 --host 127.0.0.1
    timeout /t 4 /nobreak >nul
) else (
    echo [1/2] Local AI Server dang hoat dong san sang tai cong 8080.
)

echo [2/2] Dang mo ung dung MangaTrans...
start "" "C:\Users\BoneLap\Desktop\manga-trans\src-tauri\target\release\manga-trans.exe"

echo.
echo ===================================================
echo MangaTrans da duoc mo! Ban co the bat dau dich truyen.
echo ===================================================
exit

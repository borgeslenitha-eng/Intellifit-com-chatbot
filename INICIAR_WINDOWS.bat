@echo off
cd /d "%~dp0"
if not exist "backend\.env" (
 echo Primeiro configure backend\.env seguindo o README.md.
 pause
 exit /b 1
)
if not exist "backend\node_modules" (
 echo Execute npm ci nas pastas backend e frontend conforme o README.md.
 pause
 exit /b 1
)
if not exist "frontend\node_modules" (
 echo Execute npm ci na pasta frontend conforme o README.md.
 pause
 exit /b 1
)
start "IntelliFit Backend" cmd /k "cd /d ""%~dp0backend"" && npm run dev"
start "IntelliFit Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"
echo Abra http://127.0.0.1:5173 quando os servidores iniciarem.
pause

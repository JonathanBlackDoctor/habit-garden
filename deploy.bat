@echo off
echo [1/3] Building web app...
cd /d "%~dp0"
call pnpm --filter web build
if errorlevel 1 (echo Build failed! & exit /b 1)

echo [2/3] Building functions...
cd functions
call npm run build
if errorlevel 1 (echo Functions build failed! & exit /b 1)
cd ..

echo [3/3] Deploying to Firebase...
call firebase deploy
echo Done!

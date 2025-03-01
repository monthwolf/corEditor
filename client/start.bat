@echo off
echo 正在启动协同编辑器客户端...
echo.

REM 设置工作目录为脚本所在目录
cd /d "%~dp0"

REM 检查是否安装了 Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo 错误：未安装 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

REM 检查是否安装了依赖
if not exist "node_modules" (
    echo 正在安装依赖...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo 错误：依赖安装失败
        pause
        exit /b 1
    )
)

REM 启动应用
echo 正在启动应用...
npm start

pause 
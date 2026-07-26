
@echo off
echo ========================================
echo   Snow Box - 启动脚本 (Windows)
echo ========================================
echo.

REM 检查 Python 是否安装
python --version &gt;nul 2&gt;&amp;1
if errorlevel 1 (
    echo [错误] 未找到 Python，请先安装 Python 3.7+
    pause
    exit /b 1
)

echo [1/4] 检查虚拟环境...
if not exist "venv" (
    echo [信息] 创建虚拟环境...
    python -m venv venv
)

echo [2/4] 激活虚拟环境...
call venv\Scripts\activate.bat

echo [3/4] 安装依赖...
pip install -r requirements.txt

echo.
echo [4/4] 启动服务器...
echo.
echo ========================================
echo   服务器已启动！
echo   访问地址: http://localhost:8000
echo   按 Ctrl+C 停止服务器
echo ========================================
echo.

python server.py

pause

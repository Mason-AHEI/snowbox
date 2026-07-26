
#!/bin/bash

echo "========================================"
echo "  Snow Box - 启动脚本 (Linux/Mac)"
echo "========================================"
echo ""

# 检查 Python 是否安装
if ! command -v python3 &amp;&gt; /dev/null; then
    echo "[错误] 未找到 Python3，请先安装 Python 3.7+"
    exit 1
fi

echo "[1/4] 检查虚拟环境..."
if [ ! -d "venv" ]; then
    echo "[信息] 创建虚拟环境..."
    python3 -m venv venv
fi

echo "[2/4] 激活虚拟环境..."
source venv/bin/activate

echo "[3/4] 安装依赖..."
pip install -r requirements.txt

echo ""
echo "[4/4] 启动服务器..."
echo ""
echo "========================================"
echo "  服务器已启动！"
echo "  访问地址: http://localhost:8000"
echo "  按 Ctrl+C 停止服务器"
echo "========================================"
echo ""

python3 server.py

#!/bin/bash

echo "正在启动协同编辑器客户端..."
echo

# 设置工作目录为脚本所在目录
cd "$(dirname "$0")"

# 检查是否安装了 Node.js
if ! command -v node &> /dev/null; then
    echo "错误：未安装 Node.js，请先安装 Node.js"
    exit 1
fi

# 检查是否安装了依赖
if [ ! -d "node_modules" ]; then
    echo "正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "错误：依赖安装失败"
        exit 1
    fi
fi

# 设置执行权限
chmod +x node_modules/.bin/*

# 启动应用
echo "正在启动应用..."
npm start 
# 协同编辑器客户端

## 启动说明

### Windows 系统
1. 双击运行 `start.bat` 文件
2. 或在命令提示符中执行：
```bash
.\start.bat
```

### Linux 系统
1. 打开终端，进入项目目录
2. 设置脚本执行权限：
```bash
chmod +x start.sh
```
3. 运行脚本：
```bash
./start.sh
```

### macOS 系统
1. 打开终端，进入项目目录
2. 设置脚本执行权限：
```bash
chmod +x start.sh
```
3. 运行脚本：
```bash
./start.sh
```

## 环境要求
- Node.js 16.0.0 或更高版本
- npm 7.0.0 或更高版本

## 配置说明
项目使用 `.env` 文件进行配置，主要包含以下环境变量：
- `REACT_APP_API_URL`：后端 API 服务地址
- `REACT_APP_SOCKET_URL`：WebSocket 服务地址

## 常见问题
1. 如果遇到 "未安装 Node.js" 错误：
   - 请访问 [Node.js 官网](https://nodejs.org/) 下载并安装最新的 LTS 版本

2. 如果遇到依赖安装失败：
   - 检查网络连接
   - 尝试清除 npm 缓存：`npm cache clean --force`
   - 删除 node_modules 文件夹后重新安装：`rm -rf node_modules && npm install`

3. 如果遇到启动失败：
   - 检查端口 3000 是否被占用
   - 如果端口被占用，可以修改 `package.json` 中的 `start` 脚本，添加 `PORT=其他端口号`

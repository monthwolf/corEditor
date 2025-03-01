# 协同编辑器

## 项目简介
这是一个基于 React 和 Node.js 的协同编辑器，允许多个用户实时编辑文档。用户可以注册、登录，并使用 AI 润色功能来改进文本表达。

## 技术栈
- 前端：React, TypeScript, Tailwind CSS
- 后端：Node.js, Express, MongoDB
- 实时通信：Socket.IO
- 身份验证：JSON Web Token (JWT)
- AI 润色：OpenAI API

## 环境要求
- Node.js 16.0.0 或更高版本
- npm 7.0.0 或更高版本
- MongoDB 数据库

## 项目结构
```
/client          # 前端代码
/server          # 后端代码
```

## 部署方法

### 1. 克隆项目
```bash
git clone <项目仓库地址>
cd <项目目录>
```

### 2. 安装依赖
#### 前端
```bash
cd client
npm install
```

#### 后端
```bash
cd server
npm install
```

### 3. 配置环境变量
在 `client` 和 `server` 目录下创建 `.env` 文件，并添加以下环境变量：

#### client/.env
```plaintext
REACT_APP_API_URL=http://localhost:5000
REACT_APP_SOCKET_URL=http://localhost:5000
```

#### server/.env
```plaintext
MONGO_URI=<您的MongoDB连接字符串>
JWT_SECRET=<您的JWT密钥>
OPENAI_API_KEY=<您的OpenAI API密钥>
OPENAI_BASEURL=<OpenAI API基础URL>
```

### 4. 启动项目
#### 前端
```bash
cd client
npm start
```

#### 后端
```bash
cd server
npm run dev
```

## 使用方法
1. 打开浏览器，访问 `http://localhost:3000`。
2. 注册新用户（默认隐藏了注册页，访问 `/register` 进行注册）或使用已有账户登录。
3. 登录后，您可以创建或编辑文档，通过打开<BASE_URL>/editor/<自定义地址>，实时与其他用户协作编辑不同的文档。
4. 选中需要润色的文本，点击弹出框中的 "AI 润色" 按钮，获取润色后的文本。

## 常见问题
1. **如果遇到 "未安装 Node.js" 错误：**
   - 请访问 [Node.js 官网](https://nodejs.org/) 下载并安装最新的 LTS 版本。

2. **如果遇到依赖安装失败：**
   - 检查网络连接。
   - 尝试清除 npm 缓存：`npm cache clean --force`。
   - 删除 `node_modules` 文件夹后重新安装：`rm -rf node_modules && npm install`。

3. **如果遇到启动失败：**
   - 检查端口 3000 是否被占用。
   - 如果端口被占用，可以修改 `client/package.json` 中的 `start` 脚本，添加 `PORT=其他端口号`。

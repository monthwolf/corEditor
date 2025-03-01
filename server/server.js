require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const http = require('http');
const { OpenAI } = require('openai');
const User = require('./models/User');
const Document = require('./models/Document');
const auth = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// 初始化 OpenAI 客户端
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASEURL,
    timeout: 60000,
    maxRetries: 3,
});

// 中间件
app.use(cors());
app.use(express.json());

// 数据库连接
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost/collaborative-editor', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// AI 润色功能
app.post('/api/polish', auth, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).send({ error: '请提供需要润色的文本' });
        }

        const response = await openai.chat.completions.create({
            model: "o3-mini",
            messages: [
                {
                    role: "system",
                    content: "你是一个文字润色助手，可以帮助用户改进文字表达，使其更加优雅、专业。保持原文的核心意思不变，但可以改进其表达方式。"
                },
                {
                    role: "user",
                    content: `请润色以下文字，使其更加优雅、专业：\n${text}`
                }
            ],
            temperature: 0.7,
            max_tokens: 128000
        });

        res.json({
            polishedText: response.choices[0].message.content
        });
    } catch (error) {
        console.error('AI 润色失败:', error);
        res.status(500).send({ error: 'AI 润色失败' });
    }
});

// 用户注册
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const user = new User({ username, email, password });
        await user.save();

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
        res.status(201).send({ user, token });
    } catch (error) {
        res.status(400).send({ error: '注册失败' });
    }
});

// 用户登录
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !(await user.comparePassword(password))) {
            throw new Error();
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
        res.send({ user, token });
    } catch (error) {
        res.status(401).send({ error: '登录失败' });
    }
});

// 获取当前用户信息
app.get('/api/user', auth, async (req, res) => {
    res.send(req.user);
});

// 获取文档内容
app.get('/api/documents/:documentId', auth, async (req, res) => {
    try {
        let document = await Document.findById(req.params.documentId);
        if (!document) {
            document = new Document({
                _id: req.params.documentId,
                content: '',
                lastModifiedBy: req.user._id
            });
            await document.save();
        }
        // 清理不活跃用户
        document.cleanInactiveUsers();
        await document.save();
        res.json(document);
    } catch (error) {
        console.error('获取文档失败:', error);
        res.status(500).send({ error: '获取文档失败' });
    }
});

// WebSocket 连接处理
const documentContents = new Map(); // 临时存储文档内容

const saveDocument = async (documentId, content, userId) => {
    try {
        await Document.findOneAndUpdate(
            { _id: documentId },
            {
                content,
                lastModified: new Date(),
                lastModifiedBy: userId
            },
            { upsert: true, new: true }
        );
    } catch (error) {
        console.error('保存文档失败:', error);
    }
};

const updateUserActivity = async (documentId, userId, username, cursorPosition = null) => {
    try {
        const document = await Document.findById(documentId);
        if (!document) return;

        // 更新用户活跃状态
        const userIndex = document.activeUsers.findIndex(u => u.userId.toString() === userId.toString());
        if (userIndex === -1) {
            document.activeUsers.push({
                userId,
                username,
                lastActive: new Date(),
                cursorPosition
            });
        } else {
            document.activeUsers[userIndex].lastActive = new Date();
            if (cursorPosition !== null) {
                document.activeUsers[userIndex].cursorPosition = cursorPosition;
            }
        }

        // 清理不活跃用户
        document.cleanInactiveUsers();
        await document.save();

        return document.activeUsers;
    } catch (error) {
        console.error('更新用户活跃状态失败:', error);
    }
};

io.on('connection', (socket) => {
    console.log('用户已连接');

    socket.on('join', async ({ token, documentId }) => {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findOne({ _id: decoded.userId });

            if (user) {
                socket.join(documentId);
                socket.userId = user._id; // 保存用户ID到socket实例
                socket.documentId = documentId; // 保存文档ID到socket实例

                // 更新用户活跃状态
                const activeUsers = await updateUserActivity(documentId, user._id, user.username);

                // 获取文档内容
                let document = await Document.findById(documentId);
                if (!document) {
                    document = new Document({
                        _id: documentId,
                        content: '',
                        lastModifiedBy: user._id
                    });
                    await document.save();
                }

                // 发送当前文档内容给新加入的用户
                socket.emit('documentContent', {
                    content: document.content,
                    activeUsers: document.activeUsers
                });

                // 广播活跃用户列表
                io.to(documentId).emit('activeUsers', document.activeUsers);
            }
        } catch (error) {
            console.error('认证失败:', error);
        }
    });

    // 处理用户主动退出
    socket.on('userExit', async ({ userId, documentId }) => {
        try {
            const document = await Document.findById(documentId);
            if (document) {
                // 从活跃用户列表中移除该用户的所有实例
                document.activeUsers = document.activeUsers.filter(
                    user => user.userId.toString() !== userId.toString()
                );
                await document.save();

                // 广播用户退出消息
                io.to(documentId).emit('userExited', { userId });
                // 广播更新后的活跃用户列表
                io.to(documentId).emit('activeUsers', document.activeUsers);
            }
        } catch (error) {
            console.error('处理用户退出失败:', error);
        }
    });

    // 处理断开连接
    socket.on('disconnect', async () => {
        try {
            if (socket.userId && socket.documentId) {
                const document = await Document.findById(socket.documentId);
                if (document) {
                    // 从活跃用户列表中移除该用户的所有实例
                    document.activeUsers = document.activeUsers.filter(
                        user => user.userId.toString() !== socket.userId.toString()
                    );
                    await document.save();

                    // 广播用户退出消息
                    io.to(socket.documentId).emit('userExited', { userId: socket.userId });
                    // 广播更新后的活跃用户列表
                    io.to(socket.documentId).emit('activeUsers', document.activeUsers);
                }
            }
        } catch (error) {
            console.error('处理断开连接失败:', error);
        }
    });

    socket.on('contentChange', async ({ documentId, content, cursorPosition }) => {
        try {
            const decoded = jwt.verify(socket.handshake.query.token, process.env.JWT_SECRET);
            const user = await User.findOne({ _id: decoded.userId });

            if (user) {
                // 更新临时存储
                documentContents.set(documentId, content);

                // 更新用户活跃状态和光标位置
                const activeUsers = await updateUserActivity(documentId, user._id, user.username, cursorPosition);

                // 广播内容更新
                socket.to(documentId).emit('contentUpdate', {
                    content,
                    cursorPosition,
                    userId: user._id,
                    username: user.username
                });

                // 广播更新后的活跃用户列表
                io.to(documentId).emit('activeUsers', activeUsers);

                // 使用防抖保存文档
                clearTimeout(socket.saveTimeout);
                socket.saveTimeout = setTimeout(() => {
                    saveDocument(documentId, content, user._id);
                }, 1000);
            }
        } catch (error) {
            console.error('处理内容更新失败:', error);
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
});

import React, { useState, useEffect, useCallback, useRef } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

// 创建带有认证拦截器的 axios 实例
const authAxios = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000'
});
authAxios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface ActiveUser {
  userId: string;
  username: string;
  cursorPosition?: number;
  lastActive: Date;
}

interface PopupPosition {
  x: number;
  y: number;
}

const Editor: React.FC = () => {
  const [content, setContent] = useState<string>('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPopup, setShowPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState<PopupPosition>({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [polishing, setPolishing] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const { user, token, logout } = useAuth();
  const { documentId = 'default' } = useParams();
  const navigate = useNavigate();

  // 处理文本选择
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setShowPopup(false);
      return;
    }

    const text = selection.toString().trim();
    if (text) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // 计算气泡位置
      const editorRect = editorRef.current?.getBoundingClientRect();
      if (editorRect) {
        setPopupPosition({
          x: rect.left + rect.width / 2 - editorRect.left,
          y: rect.top - editorRect.top - 40 // 在选中文本上方显示
        });
      }
      
      setSelectedText(text);
      setShowPopup(true);
    } else {
      setShowPopup(false);
    }
  }, []);

  // 处理 AI 润色
  const handlePolish = async () => {
    if (!selectedText || polishing) return;

    try {
      setPolishing(true);
      const response = await authAxios.post('/api/polish', {
        text: selectedText
      });

      // 替换选中的文本
      const newContent = content.replace(selectedText, response.data.polishedText);
      setContent(newContent);
      
      // 发送更新到其他用户
      if (socket) {
        socket.emit('contentChange', {
          documentId,
          content: newContent,
          cursorPosition: document.getSelection()?.anchorOffset
        });
      }
    } catch (error) {
      console.error('AI 润色失败:', error);
    } finally {
      setPolishing(false);
      setShowPopup(false);
    }
  };

  // 加载文档内容
  useEffect(() => {
    const loadDocument = async () => {
      try {
        const response = await authAxios.get(`/api/documents/${documentId}`);
        setContent(response.data.content || '');
        setActiveUsers(response.data.activeUsers || []);
      } catch (error) {
        console.error('加载文档失败:', error);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      loadDocument();
    }
  }, [documentId, token]);

  // 处理用户退出
  const handleUserExit = useCallback(() => {
    if (socket && user) {
      socket.emit('userExit', {
        userId: user._id,
        documentId
      });
    }
  }, [socket, user, documentId]);

  // 处理页面刷新和关闭
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      handleUserExit();
      // 为了兼容一些浏览器，返回空字符串
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleUserExit();
    };
  }, [handleUserExit]);

  // 处理路由变化（包括用户主动离开页面）
  useEffect(() => {
    return () => {
      handleUserExit();
    };
  }, [handleUserExit]);

  // 处理登出
  const handleLogout = useCallback(async () => {
    handleUserExit();
    await logout();
    navigate('/login');
  }, [handleUserExit, logout, navigate]);

  // WebSocket 连接处理
  useEffect(() => {
    if (!user || !token) {
      return;
    }

    const newSocket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000', {
      query: { token }
    });

    newSocket.emit('join', {
      token,
      documentId
    });

    // 监听其他用户退出
    newSocket.on('userExited', (data: { userId: string }) => {
      setActiveUsers(prevUsers => 
        prevUsers.filter(user => user.userId !== data.userId)
      );
    });

    newSocket.on('documentContent', (data: { content: string; activeUsers: ActiveUser[] }) => {
      setContent(data.content || '');
      setActiveUsers(data.activeUsers || []);
      setLoading(false);
    });

    newSocket.on('activeUsers', (users: ActiveUser[]) => {
      let map = new Map();
      for (let i of users) {
        if (map.has(i.userId)) {
          continue;
        }
        map.set(i.userId, i);
      }
      setActiveUsers(Array.from(map.values()));
    });

    newSocket.on('contentUpdate', (data: {
      content: string;
      cursorPosition?: number;
      userId: string;
      username: string;
    }) => {
      setContent(data.content);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user, token, documentId]);

  // 监听文本选择事件
  useEffect(() => {
    document.addEventListener('selectionchange', handleTextSelection);
    return () => {
      document.removeEventListener('selectionchange', handleTextSelection);
    };
  }, [handleTextSelection]);

  // 处理内容变化
  const handleContentChange = (value: string | undefined) => {
    if (!value) return;
    
    setContent(value);
    if (socket) {
      socket.emit('contentChange', {
        documentId,
        content: value,
        cursorPosition: document.getSelection()?.anchorOffset
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // 过滤掉不活跃的用户（5分钟无活动）
  const filteredActiveUsers = activeUsers.filter(user => {
    const lastActive = new Date(user.lastActive);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastActive > fiveMinutesAgo;
  });

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* 添加退出按钮 */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">当前在线用户：</h3>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              退出登录
            </button>
          </div>
          
          {/* 活跃用户列表 */}
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {filteredActiveUsers.map((activeUser) => (
                <div
                  key={activeUser.userId}
                  className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm"
                >
                  {activeUser.username}
                  {activeUser.cursorPosition !== undefined && ' (正在编辑...)'}
                </div>
              ))}
            </div>
          </div>

          {/* Markdown编辑器 */}
          <div ref={editorRef} className="relative" data-color-mode="light">
            <MDEditor
              value={content}
              onChange={handleContentChange}
              preview="live"
              height={500}
            />

            {/* 选中文本的气泡提示 */}
            {showPopup && (
              <div
                className="absolute bg-white rounded-lg shadow-lg p-2 transform -translate-x-1/2"
                style={{
                  left: popupPosition.x,
                  top: popupPosition.y,
                  zIndex: 1000
                }}
              >
                <button
                  className={`px-3 py-1 rounded-md text-sm font-medium text-white ${
                    polishing ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                  onClick={handlePolish}
                  disabled={polishing}
                >
                  {polishing ? '润色中...' : 'AI 润色'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Editor; 
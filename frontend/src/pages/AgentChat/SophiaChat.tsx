/**
 * SophiaChat - 复刻 sophia-pro 风格的对话页面
 *
 * 使用 SSE (Server-Sent Events) 替代 WebSocket
 *
 * 功能：
 * - AI 输出的 Thought Process（来自后端，折叠面板样式）
 * - 流式输出和打字机效果
 * - Markdown 渲染
 * - 心跳检测和自动重连
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowUp, MessageSquare, Pencil, Trash2, Check, X } from 'lucide-react';
import { useParams } from 'react-router-dom';
import ChatMessage from '@/components/chat/ChatMessage';
import { Message } from '@/types/chat';
import { ConnectionStatus } from '@/types/transport';
import { useCLTP } from '@/hooks/useCLTP';
import { HTMLTemplateRenderer } from '@/pages/Workspace/v2/HTMLTemplateRenderer';
import { getResume } from '@/services/resumeStorage';
import type { ResumeData } from '@/pages/Workspace/v2/types';

// ============================================================================
// 配置
// ============================================================================

const rawApiBase =
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '';
const API_BASE = rawApiBase
  ? rawApiBase.startsWith('http')
    ? rawApiBase
    : `https://${rawApiBase}`
  : import.meta.env.PROD
    ? ''
    : 'http://localhost:9000';

const SSE_CONFIG = {
  BASE_URL: API_BASE || 'http://localhost:9000',
  HEARTBEAT_TIMEOUT: 60000,  // 60 seconds
};
const HISTORY_BASE = 'http://localhost:8080';

function convertResumeDataToOpenManusFormat(resume: ResumeData) {
  return {
    ...resume,
  };
}

// ============================================================================
// 主页面组件
// ============================================================================

export default function SophiaChat() {
  const { resumeId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [sessions, setSessions] = useState([]);
  const [showSessions, setShowSessions] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState(`conv-${Date.now()}`);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [loadingResume, setLoadingResume] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isFinalizedRef = useRef(false);
  const shouldFinalizeRef = useRef(false); // 标记是否需要完成（等待打字机效果完成）
  const currentThoughtRef = useRef('');
  const currentAnswerRef = useRef('');

  const normalizedResume = useMemo(() => {
    if (!resumeData) return null;
    return convertResumeDataToOpenManusFormat(resumeData);
  }, [resumeData]);

  const {
    currentThought,
    currentAnswer,
    isProcessing,
    isConnected,
    answerCompleteCount,
    sendMessage,
    finalizeStream,
  } = useCLTP({
    conversationId,
    baseUrl: SSE_CONFIG.BASE_URL,
    heartbeatTimeout: SSE_CONFIG.HEARTBEAT_TIMEOUT,
    resumeData: normalizedResume,
  });

  useEffect(() => {
    if (resumeId) {
      setConversationId(`conv-${resumeId}`);
    }
  }, [resumeId]);

  useEffect(() => {
    let mounted = true;
    const loadResume = async () => {
      if (!resumeId) {
        setResumeError('未找到简历 ID');
        setLoadingResume(false);
        return;
      }
      setLoadingResume(true);
      setResumeError(null);
      try {
        const resume = await getResume(resumeId);
        if (!mounted) return;
        if (!resume) {
          setResumeError('未找到对应的简历');
          setResumeData(null);
        } else {
          setResumeData(resume.data as ResumeData);
        }
      } catch (error) {
        if (!mounted) return;
        setResumeError('加载简历失败');
      } finally {
        if (mounted) setLoadingResume(false);
      }
    };
    loadResume();
    return () => {
      mounted = false;
    };
  }, [resumeId]);

  const isHtmlTemplate = resumeData?.templateType === 'html';

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentThought, currentAnswer]);

  useEffect(() => {
    currentThoughtRef.current = currentThought;
  }, [currentThought]);

  useEffect(() => {
    currentAnswerRef.current = currentAnswer;
  }, [currentAnswer]);


  useEffect(() => {
    if (!isConnected) {
      setStatus('connecting');
      return;
    }
    setStatus(isProcessing ? 'processing' : 'idle');
  }, [isConnected, isProcessing]);

  /**
   * Finalize current message and add to history
   */
  const finalizeMessage = useCallback(() => {
    // 防止重复调用
    if (isFinalizedRef.current) {
      console.log('[SophiaChat] finalizeMessage already called, skipping');
      return;
    }

    isFinalizedRef.current = true;

    const thought = currentThoughtRef.current.trim();
    const answer = currentAnswerRef.current.trim();

    if (!thought && !answer) {
      console.log('[SophiaChat] No content to finalize, just resetting state');
      finalizeStream();
      setTimeout(() => {
        isFinalizedRef.current = false;
      }, 100);
      return;
    }

    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newMessage: Message = {
      id: uniqueId,
      role: 'assistant',
      content: answer || '',
      timestamp: new Date().toISOString(),
    };
    if (thought) {
      newMessage.thought = thought;
    }

    setMessages((prev) => [...prev, newMessage]);
    finalizeStream();
    setTimeout(() => {
      isFinalizedRef.current = false;
    }, 100);
  }, [finalizeStream]);

  const saveCurrentSession = useCallback(() => {
    if (isProcessing || currentThoughtRef.current || currentAnswerRef.current) {
      finalizeMessage();
    }
  }, [finalizeMessage, isProcessing]);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const resp = await fetch(`${HISTORY_BASE}/api/history/sessions/list`);
      const data = await resp.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('[SophiaChat] Failed to fetch sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (showSessions) {
      fetchSessions();
    }
  }, [showSessions]);

  const deleteSession = async (sessionId: string) => {
    if (!window.confirm('确定要删除此会话吗？')) return;
    try {
      await fetch(`${HISTORY_BASE}/api/history/${sessionId}`, { method: 'DELETE' });
      if (currentSessionId === sessionId) {
        const newId = `conv-${Date.now()}`;
        setMessages([]);
        setCurrentSessionId(newId);
        setConversationId(newId);
        finalizeStream();
      }
      await fetchSessions();
    } catch (error) {
      console.error('[SophiaChat] Failed to delete session:', error);
    }
  };

  const startRenameSession = (sessionId: string, title: string) => {
    setEditingSessionId(sessionId);
    setEditingTitle(title);
  };

  const cancelRenameSession = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const renameSession = async (sessionId: string, title: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    try {
      await fetch(`${HISTORY_BASE}/api/history/sessions/${sessionId}/title`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle }),
      });
      cancelRenameSession();
      await fetchSessions();
    } catch (error) {
      console.error('[SophiaChat] Failed to rename session:', error);
    }
  };

  const loadSession = async (sessionId: string) => {
    saveCurrentSession();
    try {
      const resp = await fetch(`${HISTORY_BASE}/api/history/sessions/${sessionId}`);
      const data = await resp.json();
      const loadedMessages: Message[] = (data.messages || []).map((m: any) => ({
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content || '',
        timestamp: new Date().toISOString(),
      }));

      setMessages(loadedMessages);
      setCurrentSessionId(sessionId);
      setConversationId(sessionId);
      finalizeStream();
    } catch (error) {
      console.error('[SophiaChat] Failed to load session:', error);
    }
  };

  const createNewSession = () => {
    saveCurrentSession();
    const newId = `conv-${Date.now()}`;
    setMessages([]);
    setCurrentSessionId(newId);
    setConversationId(newId);
    finalizeStream();
  };

  useEffect(() => {
    if (answerCompleteCount === 0) return;

    shouldFinalizeRef.current = true;
    // 交给打字机完成回调 finalize，避免中途强制完成导致跳变
    if (!currentAnswerRef.current.trim() && !currentThoughtRef.current.trim()) {
      finalizeMessage();
    }
  }, [answerCompleteCount, finalizeMessage]);

  /**
   * Send message to backend via SSE
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing || !isHtmlTemplate) return;

    const userMessage = input.trim();
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Add user message to UI
    setMessages(prev => [...prev, {
      id: uniqueId,
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    }]);

    isFinalizedRef.current = false;
    shouldFinalizeRef.current = false; // 重置完成标记
    setInput('');

    try {
      await sendMessage(userMessage);
    } catch (error) {
      console.error('[SophiaChat] Failed to send message:', error);
    }
  };

  /**
   * Clear conversation
   */
  const handleClearConversation = () => {
    setMessages([]);
    finalizeStream();
  };

  return (
    <div className="h-screen bg-gradient-to-b from-orange-50 to-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">
              SophiaPro Chat
            </h1>
            <p className="text-sm text-gray-500">
              Thought Process · Streaming · Markdown · SSE
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSessions(!showSessions)}
              className={`flex items-center gap-2 text-sm px-3 py-1 rounded border transition-colors ${showSessions
                ? 'text-orange-600 border-orange-200 bg-orange-50'
                : 'text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
            >
              <MessageSquare className="w-4 h-4" />
              历史会话
            </button>
            <button
              onClick={handleClearConversation}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 rounded border border-gray-200 hover:border-gray-300 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat */}
        <section className="w-1/2 flex flex-col border-r border-gray-100">
          <main className="flex-1 overflow-y-auto px-6 py-8">
            {loadingResume && (
              <div className="text-sm text-gray-400 mb-4">正在加载简历...</div>
            )}
            {resumeError && (
              <div className="text-sm text-red-500 mb-4">{resumeError}</div>
            )}
            {!loadingResume && !resumeError && !isHtmlTemplate && (
              <div className="text-sm text-orange-600 mb-4">
                当前仅支持 HTML 模板简历的 Agent 对话与预览。
              </div>
            )}

            {showSessions && (
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-gray-700">历史会话</div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={createNewSession}
                      className="text-xs text-orange-600 hover:text-orange-700"
                    >
                      新建会话
                    </button>
                    <button
                      onClick={fetchSessions}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      刷新
                    </button>
                  </div>
                </div>
                {loadingSessions ? (
                  <div className="text-xs text-gray-500">加载中...</div>
                ) : sessions.length === 0 ? (
                  <div className="text-xs text-gray-500">暂无历史会话</div>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((session: any) => (
                      <div
                        key={session.session_id}
                        onClick={() => loadSession(session.session_id)}
                        role="button"
                        tabIndex={0}
                        className={`w-full text-left p-2 rounded border text-xs ${currentSessionId === session.session_id
                          ? 'bg-orange-50 border-orange-200 text-orange-700'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                          }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {editingSessionId === session.session_id ? (
                              <input
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    renameSession(session.session_id, editingTitle);
                                  } else if (e.key === 'Escape') {
                                    cancelRenameSession();
                                  }
                                }}
                                className="w-full px-2 py-1 text-xs border border-gray-200 rounded"
                                autoFocus
                              />
                            ) : (
                              <span className="font-medium truncate block">
                                {session.title || session.session_id}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-gray-400">
                            {editingSessionId === session.session_id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    renameSession(session.session_id, editingTitle);
                                  }}
                                  className="p-1 hover:text-green-600"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    cancelRenameSession();
                                  }}
                                  className="p-1 hover:text-gray-600"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startRenameSession(session.session_id, session.title || session.session_id);
                                }}
                                className="p-1 hover:text-orange-600"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSession(session.session_id);
                              }}
                              className="p-1 hover:text-red-500"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <span className="ml-1">
                              {session.message_count || 0} 条
                            </span>
                          </div>
                        </div>
                        <div className="text-gray-400 mt-1">
                          {session.updated_at || session.created_at}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.length === 0 && !isProcessing && (
              <div className="text-center py-20">
                <div className="text-5xl mb-4">✨</div>
                <p className="text-gray-600 text-lg mb-2">
                  输入 <span className="font-medium text-orange-500">"你好"</span> 开始对话
                </p>
                <p className="text-gray-400 text-sm">
                  体验 Thought Process · 流式输出 · Markdown 渲染
                </p>
                <p className="text-gray-300 text-xs mt-4">
                  使用 SSE + CLTP 传输
                </p>
              </div>
            )}

            {/* 历史消息 */}
            {messages.map((msg, idx) => (
              <ChatMessage
                key={msg.id || idx}
                message={msg}
                isLatest={idx === messages.length - 1 && msg.role === 'assistant'}
                isStreaming={false}
              />
            ))}

            {/* 当前正在生成的消息 */}
            {isProcessing && (currentThought || currentAnswer) && (
              <ChatMessage
                message={{
                  id: 'current',
                  role: 'assistant',
                  thought: currentThought,
                  content: currentAnswer,
                }}
                isLatest={true}
                isStreaming={true}
                onTypewriterComplete={() => {
                  // 打字机效果完成时，如果标记了需要完成，则调用 finalizeMessage
                  if (shouldFinalizeRef.current) {
                    shouldFinalizeRef.current = false;
                    finalizeMessage();
                  }
                }}
              />
            )}

            {/* Loading */}
            {isProcessing && !currentThought && !currentAnswer && (
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-6">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '100ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></span>
                </div>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>Thinking...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </main>

          {/* Input Area */}
          <div className="border-t border-gray-100 bg-white px-6 py-4">
            <form onSubmit={handleSubmit}>
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isHtmlTemplate ? '输入消息...' : '仅支持 HTML 模板简历'}
                  className="flex-1 px-4 py-3 outline-none text-gray-700 placeholder-gray-400 bg-transparent"
                  disabled={isProcessing || !isHtmlTemplate}
                />
                <div className="pr-2 py-2">
                  <button
                    type="submit"
                    disabled={!input.trim() || isProcessing || !isHtmlTemplate}
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center
                      transition-all duration-200
                      ${!input.trim() || isProcessing || !isHtmlTemplate
                        ? 'bg-gray-200 cursor-not-allowed'
                        : 'bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 hover:from-orange-600 hover:via-orange-700 hover:to-orange-800 shadow-sm hover:shadow-md'
                      }
                    `}
                    title="发送消息"
                  >
                    <ArrowUp
                      className={`w-5 h-5 ${!input.trim() || isProcessing || !isHtmlTemplate
                        ? 'text-gray-400'
                        : 'text-white'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </form>

            {/* Status */}
            <div className="text-center mt-3 text-xs text-gray-400">
              <span className={`inline-flex items-center gap-1.5 ${status === 'idle' ? 'text-green-500' :
                status === 'processing' ? 'text-orange-500' : 'text-gray-400'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status === 'idle' ? 'bg-green-500' :
                  status === 'processing' ? 'bg-orange-500 animate-pulse' : 'bg-gray-400'
                  }`}></span>
                {status === 'idle' ? 'Ready (SSE)' : status === 'processing' ? 'Processing...' : 'Connecting...'}
              </span>
            </div>
          </div>
        </section>

        {/* Right: Resume Preview */}
        <aside className="w-1/2 bg-slate-50 overflow-y-auto">
          <div className="border-b border-slate-200 bg-white px-6 py-4 sticky top-0 z-10">
            <h2 className="text-sm font-semibold text-slate-700">简历预览</h2>
            {resumeData?.basic?.name && (
              <p className="text-xs text-slate-400 mt-1">{resumeData.basic.name}</p>
            )}
          </div>
          <div className="p-6">
            {loadingResume && (
              <div className="text-sm text-slate-500">正在加载简历...</div>
            )}
            {resumeError && (
              <div className="text-sm text-red-500">{resumeError}</div>
            )}
            {!loadingResume && !resumeError && !isHtmlTemplate && (
              <div className="text-sm text-orange-600">
                当前仅支持 HTML 模板简历的预览。
              </div>
            )}
            {!loadingResume && !resumeError && isHtmlTemplate && resumeData && (
              <div className="bg-white shadow-lg rounded-lg p-6">
                <HTMLTemplateRenderer resumeData={resumeData} />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

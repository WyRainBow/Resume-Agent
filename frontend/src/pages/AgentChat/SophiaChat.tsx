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

import ChatMessage from '@/components/chat/ChatMessage';
import { useAuth } from '@/contexts/AuthContext';
import { useCLTP } from '@/hooks/useCLTP';
import { HTMLTemplateRenderer } from '@/pages/Workspace/v2/HTMLTemplateRenderer';
import type { ResumeData } from '@/pages/Workspace/v2/types';
import { getResume } from '@/services/resumeStorage';
import { Message } from '@/types/chat';
import { ConnectionStatus } from '@/types/transport';
import { ArrowUp, Check, MessageSquare, Pencil, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

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
const HISTORY_BASE = 'http://localhost:9000';

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
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [sessions, setSessions] = useState([]);
  const [showSessions, setShowSessions] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState(() => {
    // 尝试从 URL 查询参数恢复会话ID
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('sessionId');
      if (sessionId) {
        return sessionId;
      }
      // 尝试从 localStorage 恢复最后的会话ID（如果有 resumeId）
      const lastSessionKey = `last_session_${window.location.pathname}`;
      const lastSessionId = localStorage.getItem(lastSessionKey);
      if (lastSessionId) {
        return lastSessionId;
      }
    }
    return `conv-${Date.now()}`;
  });
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [loadingResume, setLoadingResume] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isFinalizedRef = useRef(false);
  const shouldFinalizeRef = useRef(false); // 标记是否需要完成（等待打字机效果完成）
  const currentThoughtRef = useRef('');
  const currentAnswerRef = useRef('');
  const lastCompletedRef = useRef<{ thought: string; answer: string; at: number } | null>(null);
  const lastHandledAnswerCompleteRef = useRef(0);

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

  // 保存会话ID到 localStorage
  useEffect(() => {
    if (conversationId && typeof window !== 'undefined') {
      const lastSessionKey = `last_session_${window.location.pathname}`;
      localStorage.setItem(lastSessionKey, conversationId);
    }
  }, [conversationId]);

  useEffect(() => {
    if (resumeId) {
      // 如果有 resumeId，优先使用 resumeId 相关的会话ID
      const resumeSessionId = `conv-${resumeId}`;
      // 但如果没有从 URL 或 localStorage 恢复的会话ID，才使用 resumeId
      // 检查当前 conversationId 是否是之前保存的
      if (!conversationId || (!conversationId.startsWith(resumeSessionId) && conversationId !== resumeSessionId)) {
        // 只有当 conversationId 不是 resumeId 相关的时候才设置
        // 但如果 conversationId 是从 localStorage 恢复的，应该保留它
        const lastSessionKey = `last_session_${window.location.pathname}`;
        const lastSessionId = localStorage.getItem(lastSessionKey);
        if (!lastSessionId || lastSessionId === conversationId) {
          // 如果没有保存的会话ID，或者保存的会话ID就是当前的，则使用 resumeId
          setConversationId(resumeSessionId);
        }
      }
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
          const resolvedUserId = user?.id ?? (resume as any).user_id ?? null;
          const resumeDataWithMeta = {
            ...(resume.data || {}),
            resume_id: resume.id,
            user_id: resolvedUserId,
            _meta: {
              resume_id: resume.id,
              user_id: resolvedUserId,
            },
          };
          setResumeData(resumeDataWithMeta as ResumeData);
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
  }, [resumeId, user?.id]);

  // 刷新后自动加载历史会话（如果 conversationId 是从 localStorage 恢复的）
  useEffect(() => {
    // 如果已经有当前会话ID，不自动加载
    if (currentSessionId) {
      return;
    }

    // 如果 conversationId 是新的时间戳格式（conv-timestamp），不加载历史
    const isNewConversationId = /^conv-\d{13,}$/.test(conversationId);
    if (isNewConversationId) {
      return;
    }

    let mounted = true;
    const autoLoadSession = async () => {
      try {
        // 尝试加载会话历史
        const resp = await fetch(`${HISTORY_BASE}/api/agent/history/sessions/${conversationId}`);
        if (!mounted) return;
        if (!resp.ok) {
          // 会话不存在，使用新的会话ID
          console.log(`[SophiaChat] Session ${conversationId} not found, starting new session`);
          return;
        }
        const data = await resp.json();
        
        // 🔧 改进：使用内容哈希生成稳定的消息 ID
        const generateMessageId = (content: string, role: string): string => {
          // 简单的字符串哈希函数（FNV-1a 变体）
          let hash = 2166136261;
          const str = `${role}:${content}`;
          for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
          }
          // 转换为正数并取前12位十六进制
          const hashStr = (hash >>> 0).toString(16).slice(0, 12);
          return `msg-${hashStr}`;
        };
        
        const loadedMessages: Message[] = (data.messages || []).map((m: any) => ({
          id: generateMessageId(m.content || '', m.role || 'unknown'),
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content || '',
          timestamp: new Date().toISOString(),
        }));

        const dedupedMessages = dedupeLoadedMessages(loadedMessages);
        if (!mounted) return;
        if (dedupedMessages.length > 0) {
          setMessages(dedupedMessages);
          setCurrentSessionId(conversationId);
          console.log(
            `[SophiaChat] Auto-loaded session ${conversationId} with ${dedupedMessages.length} messages`
          );
        }
      } catch (error) {
        console.error('[SophiaChat] Failed to auto-load session:', error);
      }
    };

    autoLoadSession();
    return () => {
      mounted = false;
    };
  }, [conversationId]); // 只在 conversationId 变化时执行一次

  useEffect(() => {
    if (answerCompleteCount <= 0 || !resumeId) {
      return;
    }

    let mounted = true;
    
    // 🔧 改进：延迟刷新，确保后端持久化已完成
    const refreshResume = async () => {
      // 延迟 500ms 后刷新，给后端持久化时间
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!mounted) return;
      
      try {
        const resume = await getResume(resumeId);
        if (!mounted) return;
        if (resume) {
          const resolvedUserId = user?.id ?? (resume as any).user_id ?? null;
          const resumeDataWithMeta = {
            ...(resume.data || {}),
            resume_id: resume.id,
            user_id: resolvedUserId,
            _meta: {
              resume_id: resume.id,
              user_id: resolvedUserId,
            },
          };
          setResumeData(resumeDataWithMeta as ResumeData);
          console.log('[SophiaChat] Resume data refreshed after agent completion');
        }
      } catch (error) {
        console.error('[SophiaChat] Failed to refresh resume data:', error);
      }
    };

    refreshResume();
    return () => {
      mounted = false;
    };
  }, [answerCompleteCount, resumeId, user?.id]);

  const isHtmlTemplate = resumeData?.templateType === 'html';

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentThought, currentAnswer]);

  useEffect(() => {
    currentThoughtRef.current = currentThought;
    console.log('[SophiaChat] currentThought updated', {
      length: currentThought.length,
    });
  }, [currentThought]);

  useEffect(() => {
    currentAnswerRef.current = currentAnswer;
    console.log('[SophiaChat] currentAnswer updated', {
      length: currentAnswer.length,
    });
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

    const thoughtRefValue = currentThoughtRef.current.trim();
    const answerRefValue = currentAnswerRef.current.trim();
    const thoughtStateValue = currentThought.trim();
    const answerStateValue = currentAnswer.trim();
    const fallback = lastCompletedRef.current;
    const thought = thoughtRefValue || thoughtStateValue || fallback?.thought || '';
    const answer = answerRefValue || answerStateValue || fallback?.answer || '';

    console.log('[SophiaChat] finalizeMessage called', {
      thoughtLength: thought.length,
      answerLength: answer.length,
      thoughtRefLength: thoughtRefValue.length,
      answerRefLength: answerRefValue.length,
      thoughtStateLength: thoughtStateValue.length,
      answerStateLength: answerStateValue.length,
      fallbackThoughtLength: fallback?.thought?.length || 0,
      fallbackAnswerLength: fallback?.answer?.length || 0,
    });

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

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (
        last &&
        last.role === 'assistant' &&
        (last.content || '').trim() === newMessage.content.trim() &&
        ((last as any).thought || '').trim() === (newMessage.thought || '').trim()
      ) {
        console.log('[SophiaChat] Duplicate assistant message skipped');
        return prev;
      }
      const updated = [...prev, newMessage];
      console.log('[SophiaChat] Messages updated', { count: updated.length });
      return updated;
    });
  }, [finalizeStream, currentAnswer, currentThought]);

  const saveCurrentSession = useCallback(() => {
    if (isProcessing || currentThoughtRef.current || currentAnswerRef.current) {
      finalizeMessage();
    }
  }, [finalizeMessage, isProcessing]);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const resp = await fetch(`${HISTORY_BASE}/api/agent/history/sessions/list`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      if (!resp.ok) throw new Error(`Failed to fetch sessions: ${resp.status}`);
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
      const resp = await fetch(`${HISTORY_BASE}/api/agent/history/${sessionId}`, { 
        method: 'DELETE',
      });
      if (!resp.ok) throw new Error(`Failed to delete session: ${resp.status}`);

      // Clear active session memory on backend
      fetch(`${HISTORY_BASE}/api/agent/stream/session/${sessionId}`, {
        method: 'DELETE',
      }).catch(() => undefined);
      
      // 立即从本地状态中移除，避免等待刷新
      setSessions((prev) => prev.filter((s: any) => s.session_id !== sessionId));
      setSelectedSessions((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
      
      if (currentSessionId === sessionId) {
        const newId = `conv-${Date.now()}`;
        setMessages([]);
        setCurrentSessionId(newId);
        setConversationId(newId);
        finalizeStream();
      }
      
      // 延迟刷新以确保后端操作完成
      setTimeout(() => {
        fetchSessions();
      }, 100);
    } catch (error) {
      console.error('[SophiaChat] Failed to delete session:', error);
      // 删除失败时重新获取，恢复正确状态
      await fetchSessions();
    }
  };

  const batchDeleteSessions = async (sessionIds: string[]) => {
    if (sessionIds.length === 0) return;
    const count = sessionIds.length;
    if (!window.confirm(`确定要删除选中的 ${count} 个会话吗？`)) return;
    try {
      const resp = await fetch(`${HISTORY_BASE}/api/agent/history/sessions/batch-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_ids: sessionIds }),
      });
      if (!resp.ok) throw new Error('Batch delete failed');
      const data = await resp.json();
      console.log(`[SophiaChat] Batch deleted ${data.deleted_count} sessions`);

      // Clear active session memory on backend
      sessionIds.forEach((id) => {
        fetch(`${HISTORY_BASE}/api/agent/stream/session/${id}`, {
          method: 'DELETE',
        }).catch(() => undefined);
      });
      
      // 立即从本地状态中移除，避免等待刷新
      setSessions((prev) => prev.filter((s: any) => !sessionIds.includes(s.session_id)));
      setSelectedSessions(new Set());
      
      // 如果当前会话被删除，切换到新会话
      if (sessionIds.includes(currentSessionId || '')) {
        const newId = `conv-${Date.now()}`;
        setMessages([]);
        setCurrentSessionId(newId);
        setConversationId(newId);
        finalizeStream();
      }
      
      // 延迟刷新以确保后端操作完成
      setTimeout(() => {
        fetchSessions();
      }, 100);
    } catch (error) {
      console.error('[SophiaChat] Failed to batch delete sessions:', error);
      alert('批量删除失败，请重试');
      // 删除失败时重新获取，恢复正确状态
      await fetchSessions();
    }
  };

  const deleteAllSessions = async () => {
    if (sessions.length === 0) return;
    if (!window.confirm(`确定要删除所有 ${sessions.length} 个会话吗？此操作不可恢复！`)) return;
    try {
      const resp = await fetch(`${HISTORY_BASE}/api/agent/history/sessions/all`, {
        method: 'DELETE',
      });
      if (!resp.ok) throw new Error('Delete all failed');
      const data = await resp.json();
      console.log(`[SophiaChat] Deleted all ${data.deleted_count} sessions`);

      // Clear active session memory on backend for current session
      if (currentSessionId) {
        fetch(`${HISTORY_BASE}/api/agent/stream/session/${currentSessionId}`, {
          method: 'DELETE',
        }).catch(() => undefined);
      }
      
      // 立即清空本地状态
      setSessions([]);
      setSelectedSessions(new Set());
      
      // 切换到新会话
      const newId = `conv-${Date.now()}`;
      setMessages([]);
      setCurrentSessionId(newId);
      setConversationId(newId);
      finalizeStream();
      
      // 延迟刷新以确保后端操作完成
      setTimeout(() => {
        fetchSessions();
      }, 100);
    } catch (error) {
      console.error('[SophiaChat] Failed to delete all sessions:', error);
      alert('删除所有会话失败，请重试');
      // 删除失败时重新获取，恢复正确状态
      await fetchSessions();
    }
  };

  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedSessions.size === sessions.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(sessions.map((s: any) => s.session_id)));
    }
  };

  const dedupeLoadedMessages = (messages: Message[]) => {
    if (messages.length <= 1) return messages;
    
    const deduped: Message[] = [];
    const seenByRole = new Map<string, Set<string>>();
    const getSeenSet = (role: string) => {
      const key = role || 'unknown';
      if (!seenByRole.has(key)) {
        seenByRole.set(key, new Set<string>());
      }
      return seenByRole.get(key)!;
    };
    
    for (const msg of messages) {
      const contentKey = (msg.content || '').trim();
      const roleKey = msg.role || 'unknown';
      const seenContents = getSeenSet(roleKey);
      
      // 仅在 assistant 消息中进行扩展去重逻辑，避免误伤 user 消息
      let cleanContent = contentKey;
      if (roleKey === 'assistant' && contentKey.includes('Response:')) {
        cleanContent = contentKey.split('Response:').pop()?.trim() || contentKey;
      }
      
      // 检查是否已存在相同或相似的内容
      // 检查完全匹配
      if (seenContents.has(contentKey)) {
        console.log('[SophiaChat] Duplicate message skipped (exact match):', contentKey.slice(0, 50));
        continue;
      }
      
      if (roleKey === 'assistant') {
        // 检查 Response 部分匹配
        if (seenContents.has(cleanContent)) {
          console.log('[SophiaChat] Duplicate message skipped (response match):', cleanContent.slice(0, 50));
          continue;
        }
        
        // 检查包含关系：已存在的消息是否包含当前消息的 Response 部分
        let isDuplicate = false;
        for (const seen of seenContents) {
          if (seen.includes(cleanContent) || cleanContent.includes(seen)) {
            console.log('[SophiaChat] Duplicate message skipped (contains match):', cleanContent.slice(0, 50));
            isDuplicate = true;
            break;
          }
        }
        if (isDuplicate) {
          continue;
        }
      }
      
      seenContents.add(contentKey);
      if (roleKey === 'assistant') {
        seenContents.add(cleanContent);  // 同时记录 Response 部分
      }
      deduped.push(msg);
    }
    
    return deduped;
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
      await fetch(`${HISTORY_BASE}/api/agent/history/sessions/${sessionId}/title`, {
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
      const resp = await fetch(`${HISTORY_BASE}/api/agent/history/sessions/${sessionId}`);
      const data = await resp.json();
      
      // 🔧 改进：使用内容哈希生成稳定的消息 ID（与 autoLoadSession 保持一致）
      const generateMessageId = (content: string, role: string): string => {
        let hash = 2166136261;
        const str = `${role}:${content}`;
        for (let i = 0; i < str.length; i++) {
          hash ^= str.charCodeAt(i);
          hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
        const hashStr = (hash >>> 0).toString(16).slice(0, 12);
        return `msg-${hashStr}`;
      };
      
      const loadedMessages: Message[] = (data.messages || []).map((m: any) => ({
        id: generateMessageId(m.content || '', m.role || 'unknown'),
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content || '',
        timestamp: new Date().toISOString(),
      }));

      const dedupedMessages = dedupeLoadedMessages(loadedMessages);
      setMessages(dedupedMessages);
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
    if (answerCompleteCount <= lastHandledAnswerCompleteRef.current) {
      return;
    }
    lastHandledAnswerCompleteRef.current = answerCompleteCount;

    shouldFinalizeRef.current = true;
    const hasContent =
      currentAnswerRef.current.trim() ||
      currentThoughtRef.current.trim() ||
      currentAnswer.trim() ||
      currentThought.trim();
    if (hasContent) {
      lastCompletedRef.current = {
        thought: currentThoughtRef.current.trim() || currentThought.trim(),
        answer: currentAnswerRef.current.trim() || currentAnswer.trim(),
        at: Date.now(),
      };
    }
    console.log('[SophiaChat] answerCompleteCount effect', {
      answerCompleteCount,
      hasContent,
      answerRefLength: currentAnswerRef.current.trim().length,
      thoughtRefLength: currentThoughtRef.current.trim().length,
      answerStateLength: currentAnswer.trim().length,
      thoughtStateLength: currentThought.trim().length,
    });
    if (!hasContent) {
      // No content to typewriter, finalize immediately to clear state
      finalizeMessage();
      return;
    }
    // Fallback: if typewriter doesn't complete, cleanup after a delay
    setTimeout(() => {
      if (isFinalizedRef.current && isProcessing) {
        console.log('[SophiaChat] Fallback finalize timeout');
        finalizeMessage();
        finalizeStream();
        setTimeout(() => {
          isFinalizedRef.current = false;
        }, 100);
      }
    }, 1400);
  }, [answerCompleteCount, finalizeMessage]);

  /**
   * Send message to backend via SSE
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing || !isHtmlTemplate) return;

    const resumeMetaResumeId =
      (resumeData as any)?.resume_id ||
      (resumeData as any)?.id ||
      (resumeData as any)?._meta?.resume_id;
    const resumeMetaUserId =
      (resumeData as any)?.user_id || (resumeData as any)?._meta?.user_id;
    if (!resumeMetaResumeId || !resumeMetaUserId) {
      setResumeError('简历数据未就绪，缺少用户信息，请稍后重试');
      return;
    }

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
                {sessions.length > 0 && (
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedSessions.size === sessions.length && sessions.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                      />
                      <span className="text-xs text-gray-600">
                        {selectedSessions.size > 0 ? `已选中 ${selectedSessions.size} 个` : '全选'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedSessions.size > 0 && (
                        <button
                          onClick={() => batchDeleteSessions(Array.from(selectedSessions))}
                          className="text-xs text-red-600 hover:text-red-700 px-2 py-1 border border-red-200 rounded hover:bg-red-50"
                        >
                          删除选中 ({selectedSessions.size})
                        </button>
                      )}
                      <button
                        onClick={deleteAllSessions}
                        className="text-xs text-red-600 hover:text-red-700 px-2 py-1 border border-red-200 rounded hover:bg-red-50"
                      >
                        全删
                      </button>
                    </div>
                  </div>
                )}
                {loadingSessions ? (
                  <div className="text-xs text-gray-500">加载中...</div>
                ) : sessions.length === 0 ? (
                  <div className="text-xs text-gray-500">暂无历史会话</div>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((session: any) => (
                      <div
                        key={session.session_id}
                        onClick={(e) => {
                          // 如果点击的是复选框，不触发加载会话
                          if ((e.target as HTMLElement).type === 'checkbox') {
                            e.stopPropagation();
                            return;
                          }
                          loadSession(session.session_id);
                        }}
                        role="button"
                        tabIndex={0}
                        className={`w-full text-left p-2 rounded border text-xs ${currentSessionId === session.session_id
                          ? 'bg-orange-50 border-orange-200 text-orange-700'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                          }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={selectedSessions.has(session.session_id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleSessionSelection(session.session_id);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 shrink-0"
                            />
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
                  // 打字机效果完成时，清理流式状态
                  if (shouldFinalizeRef.current) {
                    console.log('[SophiaChat] Typewriter completed, finalize stream');
                    shouldFinalizeRef.current = false;
                    finalizeMessage();
                    finalizeStream();
                    setTimeout(() => {
                      isFinalizedRef.current = false;
                    }, 100);
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

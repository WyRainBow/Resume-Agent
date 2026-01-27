/**
 * AgentChat - 对话页面
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
import ReportCard from '@/components/chat/ReportCard';
import { ReportGenerationDetector } from '@/components/chat/ReportGenerationDetector';
import { RecentSessions } from '@/components/sidebar/RecentSessions';
import { useAuth } from '@/contexts/AuthContext';
import { useCLTP } from '@/hooks/useCLTP';
import { HTMLTemplateRenderer } from '@/pages/Workspace/v2/HTMLTemplateRenderer';
import type { ResumeData } from '@/pages/Workspace/v2/types';
import { getResume } from '@/services/resumeStorage';
import { 
  createReport, 
  getReport, 
  getDocumentContent,
  ensureReportConversation
} from '@/services/api';
import { Message } from '@/types/chat';
import { ConnectionStatus } from '@/types/transport';
import { ArrowUp, MessageSquare } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { useParams } from 'react-router-dom';
import EnhancedMarkdown from '@/components/chat/EnhancedMarkdown';
import { useTextStream } from '@/hooks/useTextStream';

// 报告内容视图组件
function ReportContentView({ 
  reportId, 
  onContentLoaded 
}: { 
  reportId: string
  onContentLoaded: (content: string, title?: string) => void 
}) {
  const [content, setContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadReport = async () => {
      try {
        setIsLoading(true)
        const report = await getReport(reportId)
        if (report.main_id) {
          const docContent = await getDocumentContent(report.main_id)
          setContent(docContent.content || '')
          onContentLoaded(docContent.content || '', report.title)
        } else {
          setContent('')
          onContentLoaded('', report.title)
        }
        setError(null)
      } catch (err) {
        console.error('加载报告失败:', err)
        setError(err instanceof Error ? err.message : '加载报告失败')
      } finally {
        setIsLoading(false)
      }
    }
    loadReport()
  }, [reportId, onContentLoaded])

  if (isLoading) {
    return <div className="text-sm text-slate-500">正在加载报告...</div>
  }

  if (error) {
    return <div className="text-sm text-red-500">{error}</div>
  }

  if (!content.trim()) {
    return <div className="text-sm text-slate-400">报告内容为空</div>
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="prose max-w-none">
        <EnhancedMarkdown>{content}</EnhancedMarkdown>
      </div>
    </div>
  )
}

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
  BASE_URL: API_BASE || '',
  HEARTBEAT_TIMEOUT: 60000,  // 60 seconds
};
const HISTORY_BASE = API_BASE || '';

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
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState(() => {
    // 尝试从 URL 查询参数恢复会话ID
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('sessionId');
      if (sessionId && sessionId.trim() !== '') {
        return sessionId;
      }
      // 尝试从 localStorage 恢复最后的会话ID（如果有 resumeId）
      const lastSessionKey = `last_session_${window.location.pathname}`;
      const lastSessionId = localStorage.getItem(lastSessionKey);
      // 验证从 localStorage 获取的值不为空字符串
      if (lastSessionId && lastSessionId.trim() !== '') {
        return lastSessionId;
      }
    }
    return `conv-${Date.now()}`;
  });
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [loadingResume, setLoadingResume] = useState(true);
  
  // 报告相关状态
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportContent, setReportContent] = useState<string>('');
  const [reportTitle, setReportTitle] = useState<string>('');
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [generatedReports, setGeneratedReports] = useState<Array<{ id: string; title: string; messageId: string }>>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const saveInFlightRef = useRef<Promise<void> | null>(null);
  const pendingSaveRef = useRef(false);
  const queuedSaveRef = useRef<{ sessionId: string; messages: Message[] } | null>(null);
  const lastSavedKeyRef = useRef<string>('');
  const refreshAfterSaveRef = useRef(false);
  const saveRetryRef = useRef<Record<string, number>>({});
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

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(media.matches);
    update();

    if (media.addEventListener) {
      media.addEventListener('change', update);
    } else {
      media.addListener(update);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', update);
      } else {
        media.removeListener(update);
      }
    };
  }, []);

  useEffect(() => {
    if (isDesktop) {
      setIsSidebarOpen(false);
    }
  }, [isDesktop]);

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
        // 防御性检查：确保 conversationId 不为空
        if (!conversationId || conversationId.trim() === '') {
          console.warn('[AgentChat] Cannot load session: conversationId is empty');
          return;
        }
        const resp = await fetch(`${HISTORY_BASE}/api/agent/history/sessions/${conversationId}`);
        if (!mounted) return;
        if (!resp.ok) {
          // 会话不存在，使用新的会话ID
          console.log(`[AgentChat] Session ${conversationId} not found, starting new session`);
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
          thought: m.thought || undefined,
          timestamp: new Date().toISOString(),
        }));

        const dedupedMessages = dedupeLoadedMessages(loadedMessages);
        if (!mounted) return;
        if (dedupedMessages.length > 0) {
          setMessages(dedupedMessages);
          setCurrentSessionId(conversationId);
          console.log(
            `[AgentChat] Auto-loaded session ${conversationId} with ${dedupedMessages.length} messages`
          );
        }
      } catch (error) {
        console.error('[AgentChat] Failed to auto-load session:', error);
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
          console.log('[AgentChat] Resume data refreshed after agent completion');
        }
      } catch (error) {
        console.error('[AgentChat] Failed to refresh resume data:', error);
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
    console.log('[AgentChat] currentThought updated', {
      length: currentThought.length,
    });
  }, [currentThought]);

  useEffect(() => {
    currentAnswerRef.current = currentAnswer;
    console.log('[AgentChat] currentAnswer updated', {
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
      console.log('[AgentChat] finalizeMessage already called, skipping');
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

    console.log('[AgentChat] finalizeMessage called', {
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
      console.log('[AgentChat] No content to finalize, just resetting state');
      finalizeStream();
      setTimeout(() => {
        isFinalizedRef.current = false;
      }, 100);
      return;
    }

    refreshAfterSaveRef.current = true;
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
        console.log('[AgentChat] Duplicate assistant message skipped');
        return prev;
      }
      const updated = [...prev, newMessage];
      console.log('[AgentChat] Messages updated', { count: updated.length });
      
      // 检测报告生成：如果消息内容包含报告相关关键词，尝试创建报告
      // 延迟检测，确保消息已添加到列表
      setTimeout(() => {
        detectAndCreateReport(newMessage.content, newMessage.id);
      }, 500);
      
      return updated;
    });
  }, [finalizeStream, currentAnswer, currentThought, detectAndCreateReport]);

  const refreshSessions = useCallback(() => {
    setSessionsRefreshKey((prev) => prev + 1);
  }, []);

  // 检测并创建报告
  const detectAndCreateReport = useCallback(async (content: string, messageId: string) => {
    // 检查是否已经为这条消息创建过报告
    if (generatedReports.some(r => r.messageId === messageId)) {
      return;
    }
    
    // 检测报告生成的关键词（更精确的匹配）
    const reportPatterns = [
      /(?:生成|创建|完成|已生成|已创建)(?:了)?(?:一份|一个)?(?:关于|的)?([^"《\n]+)(?:的|"|》)?(?:详细|完整|研究|调研)?报告/,
      /(?:报告|调研报告|研究报告)(?:：|:)?\s*(?:关于|主题)?([^"《\n]+)/,
      /^#+\s*(.+?)(?:报告|调研|研究)/m,
    ];
    
    let reportTopic = '';
    for (const pattern of reportPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        reportTopic = match[1].trim();
        if (reportTopic.length > 5 && reportTopic.length < 100) {
          break;
        }
      }
    }
    
    // 如果没找到标题，但内容很长且包含报告关键词，使用前50个字符作为标题
    if (!reportTopic && content.length > 500) {
      const hasReportKeyword = /报告|调研|研究|分析/.test(content);
      if (hasReportKeyword) {
        // 尝试从第一个标题提取
        const titleMatch = content.match(/^#+\s*(.+?)$/m);
        if (titleMatch) {
          reportTopic = titleMatch[1].trim().substring(0, 50);
        } else {
          reportTopic = content.substring(0, 50).replace(/\n/g, ' ').trim();
        }
      }
    }
    
    if (reportTopic && reportTopic.length > 5) {
      try {
        // 创建报告
        const result = await createReport(reportTopic);
        
        // 保存报告内容
        if (result.mainId) {
          await fetch(`${API_BASE}/api/documents/${result.mainId}/content`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
          });
        }
        
        // 添加到生成的报告列表
        setGeneratedReports(prev => [...prev, {
          id: result.reportId,
          title: reportTopic,
          messageId
        }]);
        
        console.log('[AgentChat] 检测到报告生成:', result.reportId, reportTopic);
      } catch (err) {
        console.error('[AgentChat] 创建报告失败:', err);
      }
    }
  }, [generatedReports]);

  const buildSavePayload = useCallback((messagesToSave: Message[]) => {
    return messagesToSave.map((msg) => ({
      role: msg.role,
      content: msg.content,
      thought: msg.thought,
    }));
  }, []);

  const persistSessionSnapshot = useCallback(
    async (sessionId: string, messagesToSave: Message[], shouldRefresh = false) => {
      // 验证 sessionId，如果为空则生成新的会话 ID
      let validSessionId = sessionId;
      if (!validSessionId || validSessionId.trim() === '') {
        // 如果为空，使用 conversationId 或生成新的
        validSessionId = conversationId || `conv-${Date.now()}`;
        if (validSessionId !== conversationId) {
          setConversationId(validSessionId);
        }
        console.log(`[AgentChat] Generated new session ID: ${validSessionId}`);
      }

      const payload = buildSavePayload(messagesToSave);
      const payloadKey = JSON.stringify(payload);
      if (payloadKey === lastSavedKeyRef.current) {
        return;
      }

      if (saveInFlightRef.current) {
        queuedSaveRef.current = { sessionId: validSessionId, messages: messagesToSave };
        return;
      }

      saveInFlightRef.current = (async () => {
        try {
          const resp = await fetch(
            `${HISTORY_BASE}/api/agent/history/sessions/${validSessionId}/save`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ messages: payload }),
            }
          );
          if (!resp.ok) {
            console.error(`[AgentChat] Failed to save session: ${resp.status}`);
            const retryCount = (saveRetryRef.current[payloadKey] || 0) + 1;
            if (retryCount <= 2) {
              saveRetryRef.current[payloadKey] = retryCount;
              queuedSaveRef.current = { sessionId: validSessionId, messages: messagesToSave };
              setTimeout(() => {
                if (!saveInFlightRef.current && queuedSaveRef.current) {
                  const next = queuedSaveRef.current;
                  queuedSaveRef.current = null;
                  void persistSessionSnapshot(next.sessionId, next.messages, shouldRefresh);
                }
              }, 800 * retryCount);
            }
            return;
          }
          lastSavedKeyRef.current = payloadKey;
          delete saveRetryRef.current[payloadKey];
          if (shouldRefresh) {
            refreshSessions();
          }
        } catch (error) {
          console.error('[AgentChat] Failed to save session snapshot:', error);
          const retryCount = (saveRetryRef.current[payloadKey] || 0) + 1;
          if (retryCount <= 2) {
            saveRetryRef.current[payloadKey] = retryCount;
            queuedSaveRef.current = { sessionId: validSessionId, messages: messagesToSave };
            setTimeout(() => {
              if (!saveInFlightRef.current && queuedSaveRef.current) {
                const next = queuedSaveRef.current;
                queuedSaveRef.current = null;
                void persistSessionSnapshot(next.sessionId, next.messages, shouldRefresh);
              }
            }, 800 * retryCount);
          }
        } finally {
          saveInFlightRef.current = null;
          if (queuedSaveRef.current) {
            const next = queuedSaveRef.current;
            queuedSaveRef.current = null;
            void persistSessionSnapshot(next.sessionId, next.messages, shouldRefresh);
          }
        }
      })();
      await saveInFlightRef.current;
    },
    [conversationId, buildSavePayload, refreshSessions]
  );

  const waitForPendingSave = useCallback(async () => {
    if (saveInFlightRef.current) {
      await saveInFlightRef.current;
    }
    if (pendingSaveRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (saveInFlightRef.current) {
        await saveInFlightRef.current;
      }
    }
  }, []);

  useEffect(() => {
    if (!pendingSaveRef.current) {
      return;
    }
    pendingSaveRef.current = false;
    const shouldRefresh = refreshAfterSaveRef.current;
    refreshAfterSaveRef.current = false;
    // 验证 conversationId 不为空
    if (conversationId && conversationId.trim() !== '') {
      void persistSessionSnapshot(conversationId, messages, shouldRefresh);
    } else {
      console.warn('[AgentChat] Skipping save: conversationId is empty');
    }
  }, [conversationId, messages, persistSessionSnapshot]);

  const saveCurrentSession = useCallback(() => {
    if (isProcessing || currentThoughtRef.current || currentAnswerRef.current) {
      pendingSaveRef.current = true;
      finalizeMessage();
      return;
    }
    pendingSaveRef.current = true;
    void persistSessionSnapshot(conversationId, messages);
  }, [conversationId, finalizeMessage, isProcessing, messages, persistSessionSnapshot]);

  const deleteSession = async (sessionId: string) => {
    try {
      const resp = await fetch(`${HISTORY_BASE}/api/agent/history/${sessionId}`, { 
        method: 'DELETE',
      });
      if (!resp.ok) throw new Error(`Failed to delete session: ${resp.status}`);

      // Clear active session memory on backend
      fetch(`${HISTORY_BASE}/api/agent/stream/session/${sessionId}`, {
        method: 'DELETE',
      }).catch(() => undefined);
      
      if (currentSessionId === sessionId) {
        const newId = `conv-${Date.now()}`;
        setMessages([]);
        setCurrentSessionId(newId);
        setConversationId(newId);
        finalizeStream();
      }
      refreshSessions();
    } catch (error) {
      console.error('[AgentChat] Failed to delete session:', error);
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
        console.log('[AgentChat] Duplicate message skipped (exact match):', contentKey.slice(0, 50));
        continue;
      }
      
      if (roleKey === 'assistant') {
        // 检查 Response 部分匹配
        if (seenContents.has(cleanContent)) {
          console.log('[AgentChat] Duplicate message skipped (response match):', cleanContent.slice(0, 50));
          continue;
        }
        
        // 检查包含关系：已存在的消息是否包含当前消息的 Response 部分
        let isDuplicate = false;
        for (const seen of seenContents) {
          if (seen.includes(cleanContent) || cleanContent.includes(seen)) {
            console.log('[AgentChat] Duplicate message skipped (contains match):', cleanContent.slice(0, 50));
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

  const renameSession = async (sessionId: string, title: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    try {
      await fetch(`${HISTORY_BASE}/api/agent/history/sessions/${sessionId}/title`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle }),
      });
      refreshSessions();
    } catch (error) {
      console.error('[AgentChat] Failed to rename session:', error);
    }
  };

  const loadSession = async (sessionId: string) => {
    if (isLoadingSession) {
      return;
    }
    setIsLoadingSession(true);
    // 先保存当前会话，确保未完成的内容被保存
    saveCurrentSession();
    await waitForPendingSave();

    try {
      const resp = await fetch(`${HISTORY_BASE}/api/agent/history/sessions/${sessionId}`);
      
      if (!resp.ok) {
        console.error(`[AgentChat] Failed to load session: ${resp.status} ${resp.statusText}`);
        // 如果加载失败，不清空当前消息，保持原状态
        return;
      }
      
      const data = await resp.json();
      
      // 检查返回的数据格式
      if (!data || !Array.isArray(data.messages)) {
        console.error('[AgentChat] Invalid session data format:', data);
        return;
      }
      
      // 🔧 改进：使用内容哈希生成稳定的消息 ID（与 autoLoadSession 保持一致）
      const generateMessageId = (content: string, role: string, index: number): string => {
        // 如果内容为空，使用索引作为 ID 的一部分，确保唯一性
        const contentForHash = content || `empty-${index}`;
        let hash = 2166136261;
        const str = `${role}:${contentForHash}:${index}`;
        for (let i = 0; i < str.length; i++) {
          hash ^= str.charCodeAt(i);
          hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
        const hashStr = (hash >>> 0).toString(16).slice(0, 12);
        return `msg-${hashStr}`;
      };
      
      // 过滤掉 tool 角色的消息（这些是内部消息，不应该显示给用户）
      const userVisibleMessages = (data.messages || []).filter(
        (m: any) => m.role === 'user' || m.role === 'assistant'
      );
      
      const loadedMessages: Message[] = userVisibleMessages.map((m: any, index: number) => ({
        id: generateMessageId(m.content || '', m.role || 'unknown', index),
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content || '',
        thought: m.thought || undefined,
        timestamp: new Date().toISOString(),
      }));

      const dedupedMessages = dedupeLoadedMessages(loadedMessages);
      
      // 只有在成功加载到消息时才更新状态
      if (dedupedMessages.length > 0 || userVisibleMessages.length === 0) {
        setMessages(dedupedMessages);
        setCurrentSessionId(sessionId);
        setConversationId(sessionId);
        // 清理流式状态，避免显示旧会话的流式内容
        finalizeStream();
      } else {
        console.warn('[AgentChat] Loaded session has no valid messages, keeping current state');
      }
    } catch (error) {
      console.error('[AgentChat] Failed to load session:', error);
      // 发生错误时，不清空当前消息，保持原状态
    } finally {
      setIsLoadingSession(false);
    }
  };

  const createNewSession = () => {
    saveCurrentSession();
    const newId = `conv-${Date.now()}`;
    setMessages([]);
    setCurrentSessionId(newId);
    setConversationId(newId);
    finalizeStream();
    refreshSessions();
  };

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      loadSession(sessionId);
      setIsSidebarOpen(false);
    },
    [loadSession]
  );

  const handleCreateSession = useCallback(() => {
    createNewSession();
    setIsSidebarOpen(false);
  }, [createNewSession]);

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
    console.log('[AgentChat] answerCompleteCount effect', {
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
        console.log('[AgentChat] Fallback finalize timeout');
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
    if (!input.trim() || isProcessing) return;
    
    // 检测用户是否要生成报告
    const isReportRequest = /(?:生成|创建|写)(?:一份|一个)?(?:关于)?(.+?)(?:的|的详细|的完整)?(?:报告|调研报告|研究报告)/.test(input);
    if (isReportRequest) {
      const topicMatch = input.match(/(?:生成|创建|写)(?:一份|一个)?(?:关于)?(.+?)(?:的|的详细|的完整)?(?:报告|调研报告|研究报告)/);
      if (topicMatch && topicMatch[1]) {
        const topic = topicMatch[1].trim();
        // 提前创建报告，这样 agent 生成内容时可以保存到报告中
        try {
          const result = await createReport(topic);
          // 将报告 ID 存储到 conversation context 中，以便后续保存内容
          sessionStorage.setItem(`pendingReport:${conversationId}`, JSON.stringify({
            reportId: result.reportId,
            mainId: result.mainId,
            topic
          }));
        } catch (err) {
          console.error('[AgentChat] 预创建报告失败:', err);
        }
      }
    }

    // 报告生成模式不需要 resumeId
    const isReportMode = isReportRequest;
    
    if (!isReportMode) {
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
    }

    const userMessage = input.trim();
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const userMessageEntry: Message = {
      id: uniqueId,
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    const nextMessages = [...messages, userMessageEntry];
    const isFirstMessage = messages.length === 0;

    // Add user message to UI
    setMessages(nextMessages);
    if (isFirstMessage) {
      // 确保 conversationId 有效
      let validConversationId = conversationId;
      if (!validConversationId || validConversationId.trim() === '') {
        validConversationId = `conv-${Date.now()}`;
        setConversationId(validConversationId);
      }
      if (!currentSessionId) {
        setCurrentSessionId(validConversationId);
      }
      void persistSessionSnapshot(validConversationId, nextMessages, true);
    }

    isFinalizedRef.current = false;
    shouldFinalizeRef.current = false; // 重置完成标记
    setInput('');

    try {
      await sendMessage(userMessage);
    } catch (error) {
      console.error('[AgentChat] Failed to send message:', error);
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
              Resume-AI
            </h1>
            <p className="text-sm text-gray-500">
              Thought Process · Streaming · Markdown · SSE
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isDesktop && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="flex items-center gap-2 text-sm px-3 py-1 rounded border border-gray-200 text-gray-500 hover:border-gray-300 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                历史
              </button>
            )}
            <button
              onClick={handleClearConversation}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 rounded border border-gray-200 hover:border-gray-300 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {isDesktop && (
          <aside className="w-[280px] shrink-0 border-r border-gray-200/50 bg-orange-50/50">
            <RecentSessions
              baseUrl={HISTORY_BASE}
              currentSessionId={currentSessionId}
              onSelectSession={handleSelectSession}
              onCreateSession={handleCreateSession}
              onDeleteSession={deleteSession}
              onRenameSession={renameSession}
              refreshKey={sessionsRefreshKey}
            />
          </aside>
        )}

        {!isDesktop && isSidebarOpen && (
          <div
            className="absolute inset-0 z-20 bg-black/30"
            onClick={() => setIsSidebarOpen(false)}
            role="button"
            tabIndex={-1}
          >
            <aside
              className="h-full w-[280px] bg-orange-50/50 shadow-xl border-r border-gray-200/50"
              onClick={(event) => event.stopPropagation()}
            >
              <RecentSessions
                baseUrl={HISTORY_BASE}
                currentSessionId={currentSessionId}
                onSelectSession={handleSelectSession}
                onCreateSession={handleCreateSession}
                onDeleteSession={deleteSession}
                onRenameSession={renameSession}
                refreshKey={sessionsRefreshKey}
              />
            </aside>
          </div>
        )}

        {/* Left: Chat */}
        <section className="flex-1 min-w-0 flex flex-col border-r border-gray-100">
          <main className="flex-1 overflow-y-auto px-6 py-8">
            {loadingResume && (
              <div className="text-sm text-gray-400 mb-4">正在加载简历...</div>
            )}
            {resumeError && (
              <div className="text-sm text-red-500 mb-4">{resumeError}</div>
            )}
            {isLoadingSession && (
              <div className="text-xs text-gray-400 mb-4">正在加载会话...</div>
            )}

            {messages.length === 0 && !isProcessing && (
              <div className="text-center py-20">
                <div className="text-5xl mb-4">✨</div>
                <p className="text-gray-600 text-lg mb-2">
                  输入消息开始对话
                </p>
                <p className="text-gray-400 text-sm mb-2">
                  体验 Thought Process · 流式输出 · Markdown 渲染
                </p>
                <p className="text-gray-500 text-sm mt-4">
                  例如：生成一份关于 AI 发展趋势的报告
                </p>
                <p className="text-gray-300 text-xs mt-2">
                  使用 SSE + CLTP 传输
                </p>
              </div>
            )}

            {/* 历史消息 */}
            {messages.map((msg, idx) => {
              // 检查这条消息是否有关联的报告
              const reportForMessage = generatedReports.find(r => r.messageId === msg.id);
              
              return (
                <Fragment key={msg.id || idx}>
                  <ChatMessage
                    message={msg}
                    isLatest={idx === messages.length - 1 && msg.role === 'assistant'}
                    isStreaming={false}
                  />
                  {/* 如果这条消息有报告，显示报告卡片 */}
                  {reportForMessage && msg.role === 'assistant' && (
                    <div className="my-4">
                      <ReportCard
                        reportId={reportForMessage.id}
                        title={reportForMessage.title}
                        subtitle="点击查看完整报告"
                        onClick={() => {
                          setSelectedReportId(reportForMessage.id);
                          setReportTitle(reportForMessage.title);
                        }}
                      />
                    </div>
                  )}
                </Fragment>
              );
            })}

            {/* 当前正在生成的消息 */}
            {isProcessing && (currentThought || currentAnswer) && (
              <>
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
                      console.log('[AgentChat] Typewriter completed, finalize stream');
                      shouldFinalizeRef.current = false;
                      finalizeMessage();
                      finalizeStream();
                      setTimeout(() => {
                        isFinalizedRef.current = false;
                      }, 100);
                    }
                  }}
                />
                {/* 如果正在生成报告内容，检测并创建报告 */}
                {currentAnswer.length > 500 && (
                  <ReportGenerationDetector
                    content={currentAnswer}
                    onReportCreated={(reportId, title) => {
                      // 当报告创建后，添加到列表（使用临时 ID，finalize 时会更新）
                      const tempMessageId = `current-${Date.now()}`;
                      setGeneratedReports(prev => {
                        // 检查是否已存在
                        if (prev.some(r => r.id === reportId)) {
                          return prev;
                        }
                        return [...prev, {
                          id: reportId,
                          title,
                          messageId: tempMessageId
                        }];
                      });
                    }}
                  />
                )}
              </>
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
                  placeholder={isProcessing ? '正在处理中，可以继续输入...' : '输入消息...（例如：生成一份关于 AI 发展趋势的报告）'}
                  className="flex-1 px-4 py-3 outline-none text-gray-700 placeholder-gray-400 bg-transparent"
                  disabled={isProcessing}
                />
                <div className="pr-2 py-2">
                  <button
                    type="submit"
                    disabled={!input.trim() || isProcessing}
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center
                      transition-all duration-200
                      ${!input.trim() || isProcessing
                        ? 'bg-gray-200 cursor-not-allowed'
                        : 'bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 hover:from-orange-600 hover:via-orange-700 hover:to-orange-800 shadow-sm hover:shadow-md'
                      }
                    `}
                    title={isProcessing ? '等待当前消息处理完成' : '发送消息'}
                  >
                    <ArrowUp
                      className={`w-5 h-5 ${!input.trim() || isProcessing
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

        {/* Right: Report Preview or Resume Preview */}
        <aside className="w-[45%] min-w-[420px] bg-slate-50 overflow-y-auto">
          <div className="border-b border-slate-200 bg-white px-6 py-4 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-700">
                  {selectedReportId ? '报告内容' : '简历预览'}
                </h2>
                {selectedReportId && reportTitle && (
                  <p className="text-xs text-slate-400 mt-1">{reportTitle}</p>
                )}
                {!selectedReportId && resumeData?.basic?.name && (
                  <p className="text-xs text-slate-400 mt-1">{resumeData.basic.name}</p>
                )}
              </div>
              {selectedReportId && (
                <button
                  onClick={() => {
                    setSelectedReportId(null);
                    setReportContent('');
                    setReportTitle('');
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                >
                  返回简历预览
                </button>
              )}
            </div>
          </div>
          <div className="p-6">
            {selectedReportId ? (
              // 显示报告内容
              <ReportContentView 
                reportId={selectedReportId}
                onContentLoaded={(content, title) => {
                  setReportContent(content);
                  if (title) setReportTitle(title);
                }}
              />
            ) : (
              // 显示简历预览
              <>
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
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

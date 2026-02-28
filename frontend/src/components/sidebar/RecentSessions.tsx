import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, MessageSquare, Pencil, Plus, RefreshCw, Trash2, X, Trash, AlertTriangle } from 'lucide-react';
import { SidebarTooltip } from './SidebarTooltip';
import CustomScrollbar from '../common/CustomScrollbar';
import { useEnvironment } from '@/contexts/EnvironmentContext';
import { useAuth } from '@/contexts/AuthContext';
import { isAgentEnabled } from '@/lib/runtimeEnv';

const PAGE_SIZE = 20;

type SessionMeta = {
  session_id: string;
  title?: string;
  created_at?: string;
  updated_at?: string;
  message_count?: number;
};

type Pagination = {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

interface RecentSessionsProps {
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => Promise<void> | void;
  onRenameSession: (sessionId: string, title: string) => Promise<void> | void;
  refreshKey?: number;
}

function toSingleLine(text: string) {
  return text
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function formatTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export function RecentSessions({
  currentSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onRenameSession,
  refreshKey = 0,
}: RecentSessionsProps) {
  const agentEnabled = isAgentEnabled();

  const { apiBaseUrl } = useEnvironment();  // 动态获取 API 地址
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deleteConfirmSessionId, setDeleteConfirmSessionId] = useState<string | null>(null);
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const getAuthHeaders = useCallback((extra: Record<string, string> = {}) => {
    const token = localStorage.getItem("auth_token");
    return token
      ? { ...extra, Authorization: `Bearer ${token}` }
      : { ...extra };
  }, []);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const parseErrorMessage = useCallback(async (resp: Response): Promise<string> => {
    const fallback = `请求失败（HTTP ${resp.status}）`;
    try {
      const data = await resp.clone().json();
      if (data?.message) return String(data.message);
      if (data?.detail?.message) return String(data.detail.message);
      if (typeof data?.detail === 'string') return data.detail;
      if (data?.error_message) return String(data.error_message);
      if (data?.error) return String(data.error);
    } catch {
      // ignore parse error
    }
    try {
      const text = await resp.text();
      if (text) return text.slice(0, 200);
    } catch {
      // ignore read error
    }
    return fallback;
  }, []);

  const hasNextPage = useMemo(() => {
    if (!pagination) return false;
    return pagination.page < pagination.total_pages;
  }, [pagination]);

  const fetchPage = useCallback(
    async (page: number, mode: 'replace' | 'append' = 'replace') => {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        setSessions([]);
        setPagination({
          total: 0,
          page: 1,
          page_size: PAGE_SIZE,
          total_pages: 1,
        });
        setErrorMessage(null);
        return;
      }
      const retries = [0, 1000, 2000];
      for (let i = 0; i < retries.length; i++) {
        try {
          if (retries[i] > 0) {
            await sleep(retries[i]);
          }
          const resp = await fetch(
            `${apiBaseUrl}/api/agent/history/sessions/list?page=${page}&page_size=${PAGE_SIZE}`,
            {
              cache: 'no-cache',
              headers: getAuthHeaders({
                'Cache-Control': 'no-cache',
              }),
            }
          );
          if (!resp.ok) {
            if (resp.status === 404) {
              // core native 模式可能未开放 history 列表接口，侧边栏静默降级
              if (mode === 'replace') {
                setSessions([]);
                setPagination({
                  total: 0,
                  page: 1,
                  page_size: PAGE_SIZE,
                  total_pages: 1,
                });
              }
              setErrorMessage(null);
              return;
            }
            const msg = await parseErrorMessage(resp);
            throw new Error(msg);
          }
          const data = await resp.json();
          const nextSessions = data.sessions || [];
          const nextPagination = data.pagination || {
            total: nextSessions.length,
            page: 1,
            page_size: PAGE_SIZE,
            total_pages: 1,
          };

          setSessions((prev) =>
            mode === 'replace' ? nextSessions : [...prev, ...nextSessions]
          );
          setPagination(nextPagination);
          setErrorMessage(null);
          return;
        } catch (error) {
          if (i === retries.length - 1) {
            const msg = error instanceof Error ? error.message : String(error);
            setErrorMessage(msg);
            console.error('[RecentSessions] Failed to fetch sessions:', error);
          }
        }
      }
    },
    [apiBaseUrl, getAuthHeaders, parseErrorMessage]
  );

  const refreshSessions = useCallback(async () => {
    setIsLoading(true);
    await fetchPage(1, 'replace');
    setIsLoading(false);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!pagination || isLoadingMore) return;
    const nextPage = pagination.page + 1;
    setIsLoadingMore(true);
    await fetchPage(nextPage, 'append');
    setIsLoadingMore(false);
  }, [fetchPage, isLoadingMore, pagination]);

  // refreshKey 变化或环境切换时刷新，避免双 effect 造成重复请求
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setSessions([]);
      setPagination({
        total: 0,
        page: 1,
        page_size: PAGE_SIZE,
        total_pages: 1,
      });
      setIsLoading(false);
      setErrorMessage(null);
      return;
    }
    refreshSessions();
  }, [apiBaseUrl, refreshKey, refreshSessions, isAuthenticated, authLoading]);

  useEffect(() => {
    if (!loadMoreRef.current || !listContainerRef.current) return;
    if (!hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          loadMore();
        }
      },
      {
        root: listContainerRef.current,
        rootMargin: '20px',
        threshold: 0,
      }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, loadMore]);

  const handleStartRename = (session: SessionMeta) => {
    setEditingSessionId(session.session_id);
    setEditingTitle(session.title || session.session_id);
  };

  const handleCancelRename = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const handleRename = async (sessionId: string) => {
    const trimmed = editingTitle.trim();
    if (!trimmed) return;
    await onRenameSession(sessionId, trimmed);
    handleCancelRename();
    refreshSessions();
  };

  const handleDeleteClick = (sessionId: string) => {
    setDeleteConfirmSessionId(sessionId);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmSessionId) return;
    setIsDeleting(true);
    try {
      await onDeleteSession(deleteConfirmSessionId);
      refreshSessions();
      setDeleteConfirmSessionId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAllClick = () => {
    if (sessions.length === 0) return;
    setDeleteAllConfirmOpen(true);
  };

  const handleConfirmDeleteAll = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/agent/history/sessions/all`, {
        method: 'DELETE',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete all sessions: ${response.status}`);
      }

      const data = await response.json();
      console.log('[RecentSessions] Deleted all sessions:', data);

      await refreshSessions();
      setDeleteAllConfirmOpen(false);

      if (currentSessionId) {
        onSelectSession('');
      }
    } catch (error) {
      console.error('[RecentSessions] Failed to delete all sessions:', error);
      alert('删除失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSession = (sessionId: string) => {
    onSelectSession(sessionId);
  };

  if (!agentEnabled) {
    return null;
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* 删除单个会话 - 自定义确认弹窗 */}
      {deleteConfirmSessionId != null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-session-title"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !isDeleting && setDeleteConfirmSessionId(null)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="delete-session-title" className="text-base font-semibold text-slate-900 dark:text-white">
                  删除会话
                </h3>
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                  确定要删除此会话吗？删除后无法恢复。
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => !isDeleting && setDeleteConfirmSessionId(null)}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    删除中
                  </span>
                ) : (
                  '确定删除'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除全部会话 - 自定义确认弹窗 */}
      {deleteAllConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-all-title"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !isLoading && setDeleteAllConfirmOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="delete-all-title" className="text-base font-semibold text-slate-900 dark:text-white">
                  删除全部会话
                </h3>
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                  确定要删除所有 {sessions.length} 个历史会话吗？此操作不可恢复。
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => !isLoading && setDeleteAllConfirmOpen(false)}
                disabled={isLoading}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAll}
                disabled={isLoading}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    删除中
                  </span>
                ) : (
                  '确定删除'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-3 pt-6 mb-2 flex items-center justify-between">
        <div className="text-xs font-normal text-gray-500 truncate whitespace-nowrap">
          历史会话
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onCreateSession}
            className="p-1 rounded hover:bg-gray-100/50 transition-colors text-gray-500 hover:text-gray-700"
            title="新建会话"
            aria-label="新建会话"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={refreshSessions}
            className="p-1 rounded hover:bg-gray-100/50 transition-colors text-gray-500 hover:text-gray-700"
            title="刷新"
            aria-label="刷新"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {sessions.length > 0 && (
            <button
              type="button"
              onClick={handleDeleteAllClick}
              className="p-1 rounded hover:bg-red-50 transition-colors text-gray-500 hover:text-red-600"
              title="删除所有会话"
              aria-label="删除所有会话"
            >
              <Trash className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="mt-2 flex items-center justify-center gap-1.5 py-2 text-xs text-slate-900">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>加载中</span>
        </div>
      ) : errorMessage ? (
        <div className="px-3 py-3">
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            历史会话加载失败：{errorMessage}
          </div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="px-3 py-4 text-xs text-gray-400">暂无历史会话</div>
      ) : (
        <CustomScrollbar 
          ref={listContainerRef as any} 
          id="sessions-list" 
          className="flex-1 overflow-x-hidden"
        >
          <div className="mt-2 space-y-1 px-2 w-full">
            {sessions.map((session) => {
              const name = toSingleLine(session.title || session.session_id);
              const isActive = session.session_id === currentSessionId;
              const timestamp = formatTime(session.updated_at || session.created_at);

              return (
                <div
                  key={session.session_id}
                  className={`group w-full min-w-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors text-left cursor-pointer ${
                    isActive
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-neutral-900 hover:text-gray-900 hover:bg-gray-100/50'
                  }`}
                  onClick={() => handleSelectSession(session.session_id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleSelectSession(session.session_id);
                    }
                  }}
                >
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive
                          ? 'text-indigo-600 opacity-80'
                          : 'text-gray-400 opacity-70 group-hover:opacity-100'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      {editingSessionId === session.session_id ? (
                        <input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleRename(session.session_id);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              handleCancelRename();
                            }
                          }}
                          className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          autoFocus
                        />
                      ) : (
                        <div className="truncate text-xs pr-2" title={name}>{name}</div>
                      )}
                      {timestamp && !editingSessionId && (
                        <div className="text-[9px] text-gray-400 mt-0.5 truncate">
                          {timestamp}
                        </div>
                      )}
                    </div>
                    {/* 操作按钮 - 只在 hover 或 active 时显示 */}
                    <div
                      className={`flex items-center gap-0.5 transition-opacity ${
                        isActive || editingSessionId === session.session_id
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {editingSessionId === session.session_id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRename(session.session_id)}
                            className="p-1 rounded hover:bg-green-50 text-gray-500 hover:text-green-600 transition-colors"
                            title="保存"
                            aria-label="保存"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelRename}
                            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                            title="取消"
                            aria-label="取消"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartRename(session)}
                            className="p-1 rounded hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors"
                            title="重命名"
                            aria-label="重命名"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(session.session_id)}
                            className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                            title="删除"
                            aria-label="删除"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
              );
            })}
          </div>
          <div ref={loadMoreRef} className="h-1" />
          {isLoadingMore && (
            <div className="flex items-center justify-center gap-1.5 py-2 text-xs text-slate-900">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>加载中</span>
            </div>
          )}
        </CustomScrollbar>
      )}
    </div>
  );
}

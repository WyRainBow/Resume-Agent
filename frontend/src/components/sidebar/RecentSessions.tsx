import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, MessageSquare, Pencil, Plus, RefreshCw, Trash2, X, Trash } from 'lucide-react';
import { SidebarTooltip } from './SidebarTooltip';

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
  baseUrl: string;
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
  baseUrl,
  currentSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onRenameSession,
  refreshKey = 0,
}: RecentSessionsProps) {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const hasNextPage = useMemo(() => {
    if (!pagination) return false;
    return pagination.page < pagination.total_pages;
  }, [pagination]);

  const fetchPage = useCallback(
    async (page: number, mode: 'replace' | 'append' = 'replace') => {
      try {
        const resp = await fetch(
          `${baseUrl}/api/agent/history/sessions/list?page=${page}&page_size=${PAGE_SIZE}`,
          {
            cache: 'no-cache',
            headers: {
              'Cache-Control': 'no-cache',
            },
          }
        );
        if (!resp.ok) throw new Error(`Failed to fetch sessions: ${resp.status}`);
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
      } catch (error) {
        console.error('[RecentSessions] Failed to fetch sessions:', error);
      }
    },
    [baseUrl]
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

  useEffect(() => {
    refreshSessions();
  }, [refreshKey, refreshSessions]);

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

  const handleDelete = async (sessionId: string) => {
    if (!window.confirm('确定要删除此会话吗？')) return;
    await onDeleteSession(sessionId);
    refreshSessions();
  };

  const handleSelectSession = (sessionId: string) => {
    onSelectSession(sessionId);
  };

  const handleDeleteAll = async () => {
    if (sessions.length === 0) return;
    
    const confirmed = window.confirm(
      `确定要删除所有 ${sessions.length} 个历史会话吗？此操作不可恢复！`
    );
    if (!confirmed) return;

    try {
      setIsLoading(true);
      const response = await fetch(`${baseUrl}/api/agent/history/sessions/all`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete all sessions: ${response.status}`);
      }

      const data = await response.json();
      console.log('[RecentSessions] Deleted all sessions:', data);
      
      // 刷新列表
      await refreshSessions();
      
      // 如果当前会话被删除，触发创建新会话
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

  return (
    <div className="h-full flex flex-col">
      {/* Header - 参考 sophia-pro 样式 */}
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
              onClick={handleDeleteAll}
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
        <div className="mt-2 flex items-center justify-center gap-1.5 py-2 text-xs text-orange-600">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>加载中</span>
        </div>
      ) : sessions.length === 0 ? (
        <div className="px-3 py-4 text-xs text-gray-400">暂无历史会话</div>
      ) : (
        <div ref={listContainerRef} className="flex-1 overflow-y-auto">
          <div className="mt-2 space-y-1 px-2">
            {sessions.map((session) => {
              const name = toSingleLine(session.title || session.session_id);
              const isActive = session.session_id === currentSessionId;
              const timestamp = formatTime(session.updated_at || session.created_at);

              return (
                <SidebarTooltip key={session.session_id} content={name} side="right">
                  <div
                    className={`group w-full min-w-0 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left cursor-pointer ${
                      isActive
                        ? 'bg-orange-50/80 text-orange-700'
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
                      className={`w-4 h-4 shrink-0 ${
                        isActive
                          ? 'text-orange-600 opacity-80'
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
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
                          autoFocus
                        />
                      ) : (
                        <div className="truncate text-sm">{name}</div>
                      )}
                      {timestamp && !editingSessionId && (
                        <div className="text-[10px] text-gray-400 mt-0.5 truncate">
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
                            className="p-1 rounded hover:bg-orange-50 text-gray-400 hover:text-orange-600 transition-colors"
                            title="重命名"
                            aria-label="重命名"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(session.session_id)}
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
                </SidebarTooltip>
              );
            })}
          </div>
          <div ref={loadMoreRef} className="h-1" />
          {isLoadingMore && (
            <div className="flex items-center justify-center gap-1.5 py-2 text-xs text-orange-600">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>加载中</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


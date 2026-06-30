export const MAX_SESSIONS_PER_USER = 10;

export type SessionLimits = {
  max_sessions: number;
  current_count: number;
  can_create: boolean;
};

export const DEFAULT_SESSION_LIMITS: SessionLimits = {
  max_sessions: MAX_SESSIONS_PER_USER,
  current_count: 0,
  can_create: true,
};

export function parseSessionLimits(data: unknown): SessionLimits {
  const limits = (data as { limits?: Partial<SessionLimits> } | null)?.limits;
  if (!limits) {
    return DEFAULT_SESSION_LIMITS;
  }

  const maxSessions =
    typeof limits.max_sessions === 'number'
      ? limits.max_sessions
      : MAX_SESSIONS_PER_USER;
  const currentCount =
    typeof limits.current_count === 'number' ? limits.current_count : 0;
  const canCreate =
    typeof limits.can_create === 'boolean'
      ? limits.can_create
      : currentCount < maxSessions;

  return {
    max_sessions: maxSessions,
    current_count: currentCount,
    can_create: canCreate,
  };
}

export function isSessionLimitExceededDetail(detail: unknown): boolean {
  if (!detail || typeof detail !== 'object') {
    return false;
  }
  return (detail as { code?: string }).code === 'SESSION_LIMIT_EXCEEDED';
}

export function isSessionLimitExceededResponse(
  status: number,
  body: unknown,
): boolean {
  if (status !== 403) {
    return false;
  }
  const payload = body as { detail?: unknown; code?: string } | null;
  if (payload?.code === 'SESSION_LIMIT_EXCEEDED') {
    return true;
  }
  if (isSessionLimitExceededDetail(payload?.detail)) {
    return true;
  }
  return false;
}

export function getSessionLimitMessage(limits?: Pick<SessionLimits, 'max_sessions'>) {
  const max = limits?.max_sessions ?? MAX_SESSIONS_PER_USER;
  return `历史会话已达上限（${max} 条），请先删除后再新建`;
}

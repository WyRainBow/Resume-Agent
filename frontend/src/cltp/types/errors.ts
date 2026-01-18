// CLTP 错误类型定义

export interface CLTPError extends Error {
  code: string;
  context?: Record<string, any>;
  recoverable?: boolean;
}

export function createCLTPError(
  message: string,
  code: string,
  context?: Record<string, any>,
  recoverable: boolean = false
): CLTPError {
  const error = new Error(message) as CLTPError;
  error.code = code;
  error.context = context;
  error.recoverable = recoverable;
  error.name = 'CLTPError';
  return error;
}

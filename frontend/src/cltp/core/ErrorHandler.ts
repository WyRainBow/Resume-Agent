/**
 * Unified error handling for CLTP session
 * 提供统一的错误处理和恢复机制
 */

import type { SessionEventEmitter } from './SessionEventEmitter';
import type { CLTPError } from '../types/errors';
import { createCLTPError } from '../utils/errors';

/**
 * Error categories for different handling strategies
 */
export type ErrorCategory =
  | 'validation' // Input validation errors
  | 'processing' // Chunk processing errors
  | 'state' // State management errors
  | 'storage' // Persistence errors
  | 'network' // Network/connection errors
  | 'aggregation' // Message aggregation errors
  | 'span' // Span management errors
  | 'system'; // System/internal errors

/**
 * Error context for tracking error sources
 */
export interface ErrorContext {
  module: string;
  operation: string;
  chunkId?: string;
  messageId?: string;
  spanId?: string;
  [K: string]: any;
}

/**
 * Unified error handler
 */
export class ErrorHandler<Payloads = any> {
  private readonly eventEmitter: SessionEventEmitter<Payloads>;

  constructor(eventEmitter: SessionEventEmitter<Payloads>) {
    this.eventEmitter = eventEmitter;
  }

  /**
   * Handle error with strategy-based processing
   */
  handleError(
    error: Error | CLTPError,
    category: ErrorCategory,
    context: ErrorContext
  ): CLTPError {
    const cltpError = this.normalizeToCLTPError(error, category, context);

    // Log error
    console.error(
      `[CLTP Error] ${category} in ${context.module}.${context.operation}:`,
      cltpError.message,
      context
    );

    // Emit error event
    this.eventEmitter.emit('error', cltpError);

    return cltpError;
  }

  /**
   * Normalize error to CLTPError
   */
  private normalizeToCLTPError(
    error: Error | CLTPError,
    category: ErrorCategory,
    context: ErrorContext
  ): CLTPError {
    if ('code' in error && 'context' in error) {
      // Already a CLTPError
      return error as CLTPError;
    }

    // Create CLTPError from regular Error
    const code = this.getErrorCode(category, error);
    return createCLTPError(
      error.message || 'Unknown error',
      code,
      {
        ...context,
        originalError: error.name,
        stack: error.stack,
      },
      this.isRecoverable(category, error)
    );
  }

  /**
   * Get error code based on category
   */
  private getErrorCode(category: ErrorCategory, error: Error): string {
    const baseCode = `CLTP_${category.toUpperCase()}`;
    if (error.name) {
      return `${baseCode}_${error.name}`;
    }
    return baseCode;
  }

  /**
   * Determine if error is recoverable
   */
  private isRecoverable(category: ErrorCategory, error: Error): boolean {
    // Network and processing errors are generally recoverable
    return category === 'network' || category === 'processing';
  }
}

/**
 * Built-in Channel Implementations for OpenManus
 * 提供 plain 和 think 频道的验证和聚合逻辑
 *
 * 关键保护：文本内容的完整性
 * - plain 和 think 频道的 reduce 函数必须保证文本内容的完整性
 * - 直接拼接文本，不进行任何处理
 */

import type { ChannelRegistration } from '../types/adapters';
import type { ContentCLChunk } from '../types/chunks';
import type {
  PlainChannelPayload,
  ThinkChannelPayload,
} from '../types/channels';

/**
 * Plain channel implementation
 * 处理普通文本输出（对应现有的 answer）
 *
 * 关键：reduce 函数必须保证文本内容原样，不进行任何修改
 */
export const plainChannel: ChannelRegistration<'plain', PlainChannelPayload> = {
  name: 'plain',
  initialValue: { text: '' },
  validate: (payload: unknown): asserts payload is PlainChannelPayload => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Plain channel payload must be an object');
    }
    const p = payload as any;
    // 允许 text 为字符串或 undefined（流式传输时可能为空）
    if (p.text !== undefined && typeof p.text !== 'string') {
      throw new Error(
        'Plain channel payload text property must be a string or undefined'
      );
    }
  },
  reduce: <P extends Record<string, any>>(
    prev: PlainChannelPayload,
    chunk: ContentCLChunk<P>
  ): PlainChannelPayload => {
    // 关键：直接提取文本内容，保持原样
    const chunkPayload = chunk.metadata.payload as PlainChannelPayload;
    const chunkText = chunkPayload.text || '';

    // 简单字符串拼接，保持原样，不进行任何处理
    return {
      text: prev.text + chunkText,
    };
  },
};

/**
 * Think channel implementation
 * 处理思考过程（对应现有的 thought）
 *
 * 关键：reduce 函数必须保证文本内容原样，不进行任何修改
 */
export const thinkChannel: ChannelRegistration<'think', ThinkChannelPayload> = {
  name: 'think',
  initialValue: { text: '' },
  validate: (payload: unknown): asserts payload is ThinkChannelPayload => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Think channel payload must be an object');
    }
    const p = payload as any;
    // 允许 text 为字符串或 undefined（流式传输时可能为空）
    if (p.text !== undefined && typeof p.text !== 'string') {
      throw new Error(
        'Think channel payload text property must be a string or undefined'
      );
    }
  },
  reduce: <P extends Record<string, any>>(
    prev: ThinkChannelPayload,
    chunk: ContentCLChunk<P>
  ): ThinkChannelPayload => {
    // 关键：直接提取文本内容，保持原样
    const chunkPayload = chunk.metadata.payload as ThinkChannelPayload;
    const chunkText = chunkPayload.text || '';

    // 简单字符串拼接，保持原样，不进行任何处理
    return {
      text: prev.text + chunkText,
    };
  },
};

/**
 * Output channel implementation (可选，未来扩展)
 * 处理结构化输出（JSON 等）
 */
export const outputChannel: ChannelRegistration<'output', { text?: string; data?: any }> = {
  name: 'output',
  initialValue: { text: undefined, data: undefined },
  validate: (payload: unknown): asserts payload is { text?: string; data?: any } => {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Output channel payload must be an object');
    }
    const p = payload as any;
    if (p.text !== undefined && typeof p.text !== 'string') {
      throw new Error('Output channel text property must be a string');
    }
  },
  reduce: <P extends Record<string, any>>(
    prev: { text?: string; data?: any },
    chunk: ContentCLChunk<P>
  ): { text?: string; data?: any } => {
    const chunkPayload = chunk.metadata.payload as { text?: string; data?: any };
    return {
      text: chunkPayload.text !== undefined
        ? (prev.text || '') + chunkPayload.text
        : prev.text,
      data: chunkPayload.data !== undefined ? chunkPayload.data : prev.data,
    };
  },
};

/**
 * Get all built-in channel registrations for OpenManus
 */
export const getBuiltInChannels = (): ChannelRegistration<string, any>[] => [
  plainChannel,
  thinkChannel,
  outputChannel,
];

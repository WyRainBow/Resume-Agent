// ID 生成工具

/**
 * 生成唯一的 chunk ID
 */
export function generateChunkId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 生成唯一的 message ID
 */
export function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 生成唯一的 span ID
 */
export function generateSpanId(): string {
  return `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

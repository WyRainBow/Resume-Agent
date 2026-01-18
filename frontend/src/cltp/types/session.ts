// 会话状态相关类型定义
// 根据API文档中的Session State部分实现

import type { ContentCLChunk, SpanName } from './chunks';
import type { CLMessage } from './messages';

// Re-export SpanName for convenience
export type { SpanName };

// content 聚合的"工作集"
export interface AggregationWork<Payloads = Record<string, any>> {
  clmessageId: string;
  parentCLSpanId: string | null;
  channel: string;
  /** 原始分片，按 sequence 升序（允许不连续） */
  payloadPieces: ContentCLChunk<Payloads>[];
  /** 增量 reduce 的快照 */
  reducedPayload: Payloads[keyof Payloads];
  /** 是否已收到任何分片的 done:true */
  done: boolean;
  /** 聚合起止时间，用于调试/性能 */
  startedAt?: number;
  lastUpdatedAt: number;
  /** finalize 理由：normal/ interrupted / closed（可选） */
  reason?: 'normal' | 'interrupted' | 'closed';
}

// span 节点抽象（start/end 合并为一个节点）
export interface SpanNode {
  // SpanChunk 中的 clspanId，不用 chunk id 或 clmessageId，因为 start 和 end 的 id/clmessageId 不一样，不便于关联
  id: string;
  parentCLSpanId: string | null;
  /** 对应协议里的 name（run/plan/procedure/task/step/plain/think/hitl/tool_calling/output） */
  name: SpanName;
  status: 'open' | 'closed';
  outcome?: 'error';
  error?: { message: string; [k: string]: any };

  startedAt?: string; // 由 span:start 的 timestamp 决定
  endedAt?: string; // 由 span:end 的 timestamp 决定
}

export interface SpanTree {
  rootIds: string[];
  nodes: Record<string, SpanNode>;
  children: Record<string, string[]>;
}

// 会话状态
export interface SessionState<Payloads = any> {
  /** span 节点，id -> 节点 */
  spans: Record<string, SpanNode>;
  /** 父子关系索引：parentSpanId -> childIds(有序，包含 span 和 message) */
  spanChildren: Record<string, string[]>;
  /** 消息体：messageId -> AnyMessage */
  messages: Record<string, CLMessage<Payloads>>;
  /**
   * 正在聚合的 content 消息工作集：clmessageId -> 聚合状态
   * final 之后会从 aggregations 删除，并写入 messages/spanChildren
   */
  aggregations: Record<string, AggregationWork<Payloads>>;
  /** span消息映射：clspanId -> [startMessageId, endMessageId] */
  spanMessageMapping: Record<string, [string, string | undefined]>;
  /** 历史/实时的游标，用于断点续传（由服务端定义语义） */
  since?: string;
  /** 连接态（仅反映当前传输层通道状态） */
  connected: boolean;
  /** 最近一次心跳的时间戳（ms since epoch），用于健康检查/重连策略 */
  lastHeartbeatAt?: number;
}

// 会话快照
export interface ConversationSnapshot<Payloads = any> {
  messages: CLMessage<Payloads>[];
  since?: string;
}

// 历史数据载荷
export interface HistoryPayload<Payloads = any> {
  messages: CLMessage<Payloads>[];
  since?: string;
}

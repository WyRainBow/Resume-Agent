// CLMessage 类型定义
// 根据协议文档中的 CLMessage 模型实现

import type { SpanName } from './chunks';

export interface SpanMessage {
  // 类型："范围"
  type: 'span';
  // 状态
  status: // 范围开始
    | 'start'
    // 范围结束，只要发送了 start span message，必须发送 end span message 以闭合范围
    | 'end';
  // message id，start 和 end chunk 的 id 不同
  id: string;
  // 范围 id，start 和 end chunk 的 clspanId 相同
  clspanId: string;
  // 父 span id，为 null 则为顶级范围
  parentCLSpanId: string | null;
  // 时间戳
  timestamp: string;
  // 元信息
  metadata: {
    // 范围的名称
    name: SpanName;
    // 范围的结果，仅当 status 为 end 时存在该属性
    outcome?: 'error';
    // 范围中的错误，仅当 outcome 存在且为 error 时存在该属性
    error?: {
      message: string;
      [key: string]: any;
    };
  };
}

export interface ContentMessage<Payloads = Record<string, any>> {
  // 类型："内容"
  type: 'content';
  // message id
  id: string;
  // 父 span id (notification 类型的 message 为 null)
  parentCLSpanId: string | null;
  // 时间戳
  timestamp: string;
  // 元信息
  metadata: {
    // 频道
    channel: keyof Payloads & string;
    // 不同频道自行定义要携带的数据
    payload: Payloads[keyof Payloads];
    // 是否发送完毕
    done: boolean;
  };
}

export interface UserMessage<Payloads = Record<string, any>> {
  type: 'user';
  id: string;
  timestamp: string;
  // 属于哪个 span
  parentCLSpanId: string | null;
  metadata: {
    action: keyof Payloads & string;
    // 不同频道自行定义要携带的数据
    payload: Payloads[keyof Payloads];
  };
}

// 联合类型：所有可能的 message 类型
export type AnyMessage<Payloads = any> =
  | SpanMessage
  | ContentMessage<Payloads>
  | UserMessage;

// Alias for backward compatibility
export type CLMessage<Payloads = any> = AnyMessage<Payloads>;

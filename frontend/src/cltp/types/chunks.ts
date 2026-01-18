// CLChunk 类型定义
// 根据协议文档中的 CLChunk 模型实现

// Span 名称类型
export type SpanName =
  /* START - agent 生命周期钩子 */
  // LLMs 运行，从 LLMs 吐出第一个 token 开始，到 LLMs 吐出最后一个 token 结束，都属于 run 的范围。该范围意味着 ai 的全部生命周期
  | 'run'
  // 任务规划
  | 'plan'
  // agent 执行过程。该范围意味着 agent 开始 loop，如果是 ReAct 范式，意味着 steps 的开始与结束
  | 'procedure'
  // agent 的具体执行任务，是 procedure 的子集
  | 'task'
  // agent 执行的一步。该范围意味着 agent 的某一次 loop，如果是 ReAct 范式，意味着一次"ReAct"
  | 'step'
  /* END - agent 生命周期钩子 */

  /* START - 承载 content 块的范围类型 */
  // 最普通的文字，单纯的自然语言
  | 'plain'
  // 思考
  | 'think'
  // human in the loop
  | 'hitl'
  // 工具调用
  | 'tool_calling'
  // 输出
  | 'output'
  | 'user';
/* END - 承载 content 块的范围类型 */

export interface SpanCLChunk {
  // 类型："范围"
  type: 'span';
  // 状态
  status: // 范围开始
    | 'start'
    // 范围结束，只要发送了 start span chunk，必须发送 end span chunk 以闭合范围
    | 'end';
  // chunk id
  id: string;
  // 父 span id，为 null 则为顶级范围
  parentCLSpanId: string | null;
  // 所属消息 id，span 类型的 chunk 单独成 message，所以 messageId 应与 id 相同
  clmessageId: string;
  // 因为 start 和 end chunk 不聚合，二者的 id/clmessageId 也不同，所以需要一个 start 和 end 相同的 id 来关联一对 span
  clspanId: string;
  // chunk 在所属消息中的序号，span 类型的 chunk 单独成 message，所以 sequence 恒为 0
  sequence: 0;
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

export interface ContentCLChunk<Payloads = Record<string, any>> {
  // 类型："内容"
  type: 'content';
  // chunk id
  id: string;
  // 父 span id (notification 类型的 chunk 为 null)
  parentCLSpanId: string | null;
  // 所属消息 id
  clmessageId: string;
  // chunk 在所属消息中的序号
  sequence: number;
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

export interface HeartbeatChunk {
  // 类型："心跳"
  type: 'heartbeat';
  // chunk id
  id: string;
  // 时间戳
  timestamp: string;
}

// 联合类型：所有可能的 chunk 类型
export type CLChunk<Payloads = Record<string, any>> =
  | SpanCLChunk
  | ContentCLChunk<Payloads>
  | HeartbeatChunk;

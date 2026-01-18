// 频道载荷类型定义

export interface PlainChannelPayload {
  text: string;
}

export interface ThinkChannelPayload {
  text: string;
}

export interface OutputChannelPayload {
  text?: string;
  data?: any;
}

// 默认的 Payloads 类型（用于 OpenManus）
export interface DefaultPayloads {
  plain: PlainChannelPayload;
  think: ThinkChannelPayload;
  output: OutputChannelPayload;
}

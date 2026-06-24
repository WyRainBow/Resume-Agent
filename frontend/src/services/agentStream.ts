import { getApiBaseUrl } from "@/lib/runtimeEnv";

export interface AgentStreamEvent {
  id: string;
  type: string;
  data: any;
  timestamp: string;
}

export interface AgentStreamPayload {
  message: string;
  conversation_id?: string | null;
  resume_data?: any;
  model?: string;
}

export interface AgentStreamHandlers {
  onEvent?: (event: AgentStreamEvent) => void;
  onError?: (error: Error) => void;
  onDone?: () => void;
  signal?: AbortSignal;
  baseUrl?: string;
  headers?: Record<string, string>;
  /** 流式读取的空闲超时（毫秒）：超过该时长未收到任何数据块即判定连接中断。
   *  后端每 55s 发心跳，故 60s 余量足够；传 <=0 或不传则不启用。 */
  idleTimeoutMs?: number;
  onResumePatch?: (patch: {
    patch_id: string
    paths:    string[]
    before:   Record<string, any>
    after:    Record<string, any>
    summary:  string
  }) => void;
  onResumeGenerated?: (data: {
    resume:  Record<string, any>
    summary: string
  }) => void;
}

function extractEventFields(rawBlock: string): {
  id: string;
  eventType: string;
  dataLines: string[];
} {
  const lines = rawBlock.split("\n");
  let id = "";
  let eventType = "";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("id:")) {
      id = line.slice(3).trim();
    } else if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  return { id, eventType, dataLines };
}

function parseBlock(rawBlock: string): AgentStreamEvent | null {
  const block = rawBlock.trim();
  if (!block) return null;

  const { id, eventType, dataLines } = extractEventFields(block);
  if (dataLines.length === 0) return null;

  const rawData = dataLines.join("\n").trim();
  if (!rawData) return null;

  try {
    const parsed = JSON.parse(rawData);
    const payload = parsed?.data ?? parsed;
    const type = String(parsed?.type || eventType || payload?.type || "message");
    return {
      id: String(id || parsed?.id || crypto.randomUUID()),
      type,
      data: payload,
      timestamp: String(parsed?.timestamp || new Date().toISOString()),
    };
  } catch {
    return {
      id: String(id || crypto.randomUUID()),
      type: eventType || "message",
      data: { content: rawData },
      timestamp: new Date().toISOString(),
    };
  }
}

function isDoneEvent(event: AgentStreamEvent): boolean {
  if (event.type === "done") return true;
  if (event.type === "status") {
    const status = String(
      event.data?.status || event.data?.content || event.data?.result || "",
    ).toLowerCase();
    return status === "complete" || status === "done";
  }
  return false;
}

export async function streamAgent(
  payload: AgentStreamPayload,
  handlers: AgentStreamHandlers = {},
): Promise<void> {
  const {
    onEvent,
    onError,
    onDone,
    signal,
    baseUrl = getApiBaseUrl(),
    headers = {},
    idleTimeoutMs = 0,
  } = handlers;

  let doneEmitted = false;
  const emitDone = () => {
    if (doneEmitted) return;
    doneEmitted = true;
    onEvent?.({
      id: crypto.randomUUID(),
      type: "done",
      data: {},
      timestamp: new Date().toISOString(),
    });
    onDone?.();
  };

  try {
    const response = await fetch(`${baseUrl}/api/agent/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...headers,
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `SSE request failed: ${response.status} ${response.statusText}${body ? ` - ${body.slice(0, 300)}` : ""}`,
      );
    }

    if (!response.body) {
      throw new Error("SSE response has no body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // 空闲看门狗：每个数据块（含后端心跳）到达即重置；超过 idleTimeoutMs 仍无任何块，
    // 判定为静默断流，取消 reader 并以超时错误退出，避免前端一直卡在“生成中”。
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const clearIdle = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };
    const readChunk = (): Promise<ReadableStreamReadResult<Uint8Array>> => {
      if (idleTimeoutMs <= 0) return reader.read();
      return new Promise((resolve, reject) => {
        idleTimer = setTimeout(() => {
          reader.cancel().catch(() => {});
          reject(
            new Error(
              `流式响应空闲超过 ${Math.round(idleTimeoutMs / 1000)} 秒，连接可能已中断，请重试`,
            ),
          );
        }, idleTimeoutMs);
        reader.read().then(
          (result) => {
            clearIdle();
            resolve(result);
          },
          (error) => {
            clearIdle();
            reject(error);
          },
        );
      });
    };

    while (true) {
      const { done, value } = await readChunk();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";

      for (const block of blocks) {
        const parsed = parseBlock(block);
        if (!parsed) continue;
        onEvent?.(parsed);
        if (isDoneEvent(parsed)) {
          emitDone();
        }
        if (parsed.type === 'resume_patch' && handlers.onResumePatch) {
          handlers.onResumePatch(parsed.data)
        }
        if (parsed.type === 'resume_generated' && handlers.onResumeGenerated) {
          handlers.onResumeGenerated(parsed.data)
        }
      }
    }

    if (buffer.trim()) {
      const parsed = parseBlock(buffer);
      if (parsed) {
        onEvent?.(parsed);
        if (isDoneEvent(parsed)) {
          emitDone();
        }
      }
    }

    emitDone();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return;
    }
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
    throw err;
  }
}

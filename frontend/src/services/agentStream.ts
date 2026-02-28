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
}

export interface AgentStreamHandlers {
  onEvent?: (event: AgentStreamEvent) => void;
  onError?: (error: Error) => void;
  onDone?: () => void;
  signal?: AbortSignal;
  baseUrl?: string;
  headers?: Record<string, string>;
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

    while (true) {
      const { done, value } = await reader.read();
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

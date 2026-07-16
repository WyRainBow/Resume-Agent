export type SequenceSource = "arrival" | "server";
export type RunCancelReason =
  | "user_stop"
  | "session_switch"
  | "superseded"
  | "transport_abort"
  | "unknown";

export interface CanonicalEventBase {
  eventId: string;
  runId: string;
  seq: number;
  sequenceSource: SequenceSource;
  at: number;
}

export type CanonicalConversationEvent = CanonicalEventBase &
  (
    | {
        type: "thought.upserted";
        stepId: number;
        nodeId: string;
        content: string;
        phase?: string;
        complete: boolean;
      }
    | {
        type: "tool.started";
        stepId: number;
        toolCallId: string;
        toolName: string;
        args: Record<string, unknown>;
      }
    | {
        type: "tool.completed";
        stepId: number;
        toolCallId: string;
        toolName: string;
        outcome: "success" | "error";
        result: unknown;
        structuredData?: Record<string, unknown>;
      }
    | {
        type: "tool.progressed";
        toolCallId: string;
        stageId: string;
        current?: number;
        total?: number;
        label?: string;
        summary?: string;
        stages?: string[];
      }
    | {
        type: "response.reset";
      }
    | {
        type: "response.updated";
        content: string;
        delta?: string;
        complete: boolean;
      }
    | {
        type: "run.sourceCompleted";
      }
    | {
        type: "run.observed";
        sourceType: string;
      }
    | {
        type: "artifact.upserted";
        artifactId: string;
        kind: string;
        payload: Record<string, unknown>;
      }
    | {
        type: "suggestions.updated";
        items: Array<Record<string, unknown>>;
      }
    | {
        type: "run.cancelled";
        reason: RunCancelReason;
        message?: string;
      }
    | {
        type: "run.failed";
        message: string;
      }
  );

import type { AgentStreamEvent } from "@/services/agentStream";

import type { CanonicalConversationEvent } from "./events";

export interface AgentEventAdapter {
  normalize(event: AgentStreamEvent): CanonicalConversationEvent[];
}

function eventPayload(event: AgentStreamEvent): Record<string, unknown> {
  const outer = event.data;
  if (!outer || typeof outer !== "object") return {};
  return outer as Record<string, unknown>;
}

function eventTime(timestamp: string): number {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function createAgentEventAdapter(): AgentEventAdapter {
  return {
    normalize(event) {
      if (!event.runId || typeof event.seq !== "number") return [];
      const payload = eventPayload(event);
      const base = () => ({
        eventId: event.id,
        runId: event.runId!,
        seq: event.seq!,
        sequenceSource: "server" as const,
        at: eventTime(event.timestamp),
      });
      const observed = (): CanonicalConversationEvent[] => [
        { ...base(), type: "run.observed", sourceType: event.type },
      ];

      if (event.type === "thought" || event.type === "thought_chunk") {
        const content =
          typeof payload.content === "string" ? payload.content : "";
        const stepId = payload.step_id;
        if (!content.trim() || typeof stepId !== "number") return observed();

        const nodeId =
          typeof payload.node_id === "string" && payload.node_id.trim()
            ? payload.node_id.trim()
            : `thought:step-${stepId}`;

        const phase =
          typeof payload.phase === "string" ? payload.phase : undefined;
        const thought: CanonicalConversationEvent = {
          ...base(),
          type: "thought.upserted",
          stepId,
          nodeId,
          content,
          phase,
          complete:
            typeof payload.is_complete === "boolean"
              ? payload.is_complete
              : true,
        };
        return [thought];
      }

      if (event.type === "tool_call") {
        const stepId = payload.step_id;
        const toolCallId = payload.tool_call_id;
        const toolName = payload.tool;
        if (
          typeof stepId !== "number" ||
          typeof toolCallId !== "string" ||
          typeof toolName !== "string"
        ) {
          return observed();
        }
        const args =
          payload.args && typeof payload.args === "object"
            ? (payload.args as Record<string, unknown>)
            : {};
        return [
          {
            ...base(),
            type: "tool.started",
            stepId,
            toolCallId,
            toolName,
            args,
          },
        ];
      }

      if (event.type === "tool_result" || event.type === "tool_error") {
        const stepId = payload.step_id;
        const toolCallId = payload.tool_call_id;
        const toolName = payload.tool;
        if (
          typeof stepId !== "number" ||
          typeof toolCallId !== "string" ||
          typeof toolName !== "string"
        ) {
          return observed();
        }
        const structuredData =
          payload.structured_data && typeof payload.structured_data === "object"
            ? (payload.structured_data as Record<string, unknown>)
            : undefined;
        return [
          {
            ...base(),
            type: "tool.completed",
            stepId,
            toolCallId,
            toolName,
            outcome: event.type === "tool_error" ? "error" : "success",
            result: payload.result,
            structuredData,
          },
        ];
      }

      if (event.type === "tool_progress") {
        const toolCallId = payload.tool_call_id;
        const stageId = payload.stage_id;
        if (typeof toolCallId !== "string" || typeof stageId !== "string") {
          return observed();
        }
        return [
          {
            ...base(),
            type: "tool.progressed",
            toolCallId,
            stageId,
            current:
              typeof payload.current === "number" ? payload.current : undefined,
            total:
              typeof payload.total === "number" ? payload.total : undefined,
            label:
              typeof payload.label === "string" ? payload.label : undefined,
            summary:
              typeof payload.summary === "string" ? payload.summary : undefined,
            stages: Array.isArray(payload.stages)
              ? payload.stages.filter(
                  (stage): stage is string => typeof stage === "string",
                )
              : undefined,
          },
        ];
      }

      if (event.type === "answer_reset") {
        return [{ ...base(), type: "response.reset" }];
      }

      if (event.type === "answer" || event.type === "answer_chunk") {
        const content =
          typeof payload.content === "string"
            ? payload.content
            : typeof payload.result === "string"
              ? payload.result
              : typeof payload.text === "string"
                ? payload.text
                : "";
        const delta =
          typeof payload.delta === "string" && payload.delta
            ? payload.delta
            : undefined;
        if (!content && !delta) return observed();
        return [
          {
            ...base(),
            type: "response.updated",
            content,
            delta,
            complete: Boolean(payload.is_complete),
          },
        ];
      }

      if (event.type === "done") {
        return [{ ...base(), type: "run.sourceCompleted" }];
      }

      if (
        event.type === "resume_patch" ||
        event.type === "resume_generated"
      ) {
        const artifactId =
          typeof payload.patch_id === "string" && payload.patch_id
            ? payload.patch_id
            : event.id;
        return [
          {
            ...base(),
            type: "artifact.upserted",
            artifactId,
            kind: event.type,
            payload,
          },
        ];
      }

      if (event.type === "suggestions") {
        const items = Array.isArray(payload.items)
          ? payload.items.filter(
              (item): item is Record<string, unknown> =>
                Boolean(item) && typeof item === "object",
            )
          : [];
        return [{ ...base(), type: "suggestions.updated", items }];
      }

      if (event.type === "error" || event.type === "agent_error") {
        const message =
          typeof payload.content === "string"
            ? payload.content
            : typeof payload.error_details === "string"
              ? payload.error_details
              : typeof payload.error_message === "string"
                ? payload.error_message
                : "流式请求失败，请稍后重试。";
        if (message === "Execution stopped due to session switch") {
          return [
            {
              ...base(),
              type: "run.cancelled",
              reason: "session_switch",
              message,
            },
          ];
        }
        if (message === "Execution stopped by user") {
          return [
            {
              ...base(),
              type: "run.cancelled",
              reason: "user_stop",
              message,
            },
          ];
        }
        return [{ ...base(), type: "run.failed", message }];
      }

      return observed();
    },
  };
}

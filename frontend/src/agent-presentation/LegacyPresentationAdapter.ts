import type { AgentProcessNode } from "@/types/chat";

import type {
  ConversationProcessNode,
  ConversationRunState,
} from "./model";

const TOOL_LABELS: Record<string, string> = {
  list_resumes: "查看简历列表",
  get_resume_detail: "获取简历详情",
  cv_analyzer_agent: "简历诊断",
  cv_editor_agent: "修改简历",
  cv_reader_agent: "读取简历",
  generate_resume: "生成简历",
  show_resume: "选择简历",
  ask_user_question: "确认补充信息",
  // 与 ask_user_question 同语义的另一注册名（backend/agent/tool/ask_human.py），
  // 漏映射会兜底成 generic「执行工具」（2026-07-15 实测）。
  ask_human: "确认补充信息",
};

function toolSummary(node: Extract<ConversationProcessNode, { kind: "tool" }>) {
  const structured = node.structuredData;
  if (structured?.type === "resume_list") {
    const count = Array.isArray(structured.resumes) ? structured.resumes.length : 0;
    return count > 0 ? `找到 ${count} 份可用简历` : "简历库中暂无可用简历";
  }
  if (structured?.type === "resume_loaded") {
    const resume = structured.resume;
    const name =
      resume && typeof resume === "object"
        ? (resume as Record<string, unknown>).name
        : undefined;
    return typeof name === "string" && name.trim()
      ? `已加载《${name.trim()}》完整内容`
      : "简历详情已加载";
  }
  if (structured?.type === "resume_diagnosis") return "诊断完成";
  if (structured?.type === "resume_generated") return "简历已生成";
  if (
    structured?.type === "resume_patch" ||
    structured?.type === "resume_edit_diff"
  ) {
    // 后端为每次修改生成了具体摘要（cv_editor_agent_tool 的
    // 「修改了 实习经历「联想」的描述」），优先透传——连续多次修改的
    // 工具卡才能实时区分各改了什么，与 patch 面板行文案同源（问题 D）。
    const summary = (structured as Record<string, unknown>).summary;
    if (typeof summary === "string" && summary.trim()) return summary.trim();
    return "修改方案已生成";
  }
  // 无匹配 structured 的兜底不再返回「执行成功/执行失败」——卡片 badge 已
  // 显示同样状态文案，摘要行重复无信息量；undefined 时摘要行不渲染。
  return undefined;
}

function projectProcessNode(node: ConversationProcessNode): AgentProcessNode {
  if (node.kind === "thought") {
    return {
      id: node.id,
      kind: "thought",
      stepId: node.stepId,
      content: node.content,
    };
  }
  const progress = node.progress;
  const legacyProgress =
    progress?.current != null &&
    progress.total != null &&
    progress.label &&
    progress.summary != null &&
    progress.stages
      ? {
          current: progress.current,
          total: progress.total,
          label: progress.label,
          summary: progress.summary,
          stages: progress.stages,
        }
      : undefined;
  return {
    id: node.id,
    kind: "tool",
    stepId: node.stepId,
    toolCallId: node.toolCallId,
    toolName: node.toolName,
    label: TOOL_LABELS[node.toolName] || "执行工具",
    status: node.status,
    progress: node.status === "running" ? legacyProgress : undefined,
    summary: node.status === "running" ? undefined : toolSummary(node),
  };
}

export function projectLegacyProcessNodes(
  nodes: ConversationProcessNode[],
): AgentProcessNode[] {
  return nodes.map(projectProcessNode);
}

export interface LegacyStreamState {
  thought: string;
  answer: string;
  processNodes: AgentProcessNode[];
}

export function projectLegacyStreamState(
  state: ConversationRunState,
): LegacyStreamState {
  const processNodes = projectLegacyProcessNodes(state.process);
  return {
    thought: processNodes
      .filter(
        (node): node is Extract<AgentProcessNode, { kind: "thought" }> =>
          node.kind === "thought",
      )
      .map((node) => node.content.trim())
      .filter(Boolean)
      .join("\n\n"),
    answer: state.response.sourceText,
    processNodes,
  };
}

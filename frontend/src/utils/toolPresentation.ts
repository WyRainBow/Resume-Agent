export type StructuredToolPresentation =
  | "process_only"
  | "resume_loaded_side_effect"
  | "artifact";

/**
 * Tool execution is always owned by AgentProcessTimeline. Structured events only
 * survive this classifier when they represent a business artifact or a required
 * client-side side effect.
 */
export function classifyStructuredToolPresentation(
  structuredType: string,
): StructuredToolPresentation {
  if (structuredType === "resume_list" || structuredType === "resume_detail") {
    return "process_only";
  }
  if (structuredType === "resume_loaded") return "resume_loaded_side_effect";
  // resume_patch 有专属渲染（live 走 ResumeContext.pendingPatches、历史走
  // ConversationArtifactStack.patchItems 的 ResumeDiffCard），通用注册表永不
  // 兜底——否则 FallbackJsonCard 会在专属面板旁泄露裸 JSON（2026-07-15 实测）。
  if (structuredType === "resume_patch") return "process_only";
  // resume_selector 是 show_resume 的「效果信号」（会话无已加载简历时让前端弹
  // 选择面板），不是展示卡：面板由工具名经 onShowResumeSelector 驱动，与本
  // 结构化 type 无关；不归类会走 FallbackJsonCard 泄露内部 type 名 + 裸 JSON。
  if (structuredType === "resume_selector") return "process_only";
  return "artifact";
}

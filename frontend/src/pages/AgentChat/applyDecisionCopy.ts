/**
 * 应用/拒绝 patch 后的用户气泡文案（从 CocoChat 抽出，便于单测与集中维护）。
 *
 * 复用每条 patch 现成的 summary（如「修改了 教育经历「北京大学」的描述」），
 * 让气泡说清「具体改了什么」，而不是干巴巴的「我应用了 N 处修改」。
 * 传入的是【本批新处理】的 summary（非全会话累计），所以数字不会越点越大。
 */
export function buildApplyDecisionCopy(
  appliedSummaries: string[],
  rejectedCount: number,
): string {
  const summaries = appliedSummaries
    .map((s) => (s || "").trim())
    .filter(Boolean);
  let head: string;
  if (summaries.length === 0) {
    // summary 缺失兜底：回到计数文案，不至于空气泡
    head = `我应用了 ${appliedSummaries.length} 处修改`;
  } else if (summaries.length === 1) {
    // summary 以动词开头（修改了/新增了/删除了），前缀「我」即成完整句：
    // 「我修改了 教育经历「北京大学」的描述」
    head = `我${summaries[0]}`;
  } else {
    head = `我应用了这几处修改：\n${summaries.map((s) => `· ${s}`).join("\n")}`;
  }
  return rejectedCount > 0 ? `${head}\n（另有 ${rejectedCount} 处先不改）` : head;
}

/** 全部拒绝一批 patch 时的用户气泡文案。 */
export function buildRejectDecisionCopy(rejectedCount: number): string {
  return rejectedCount === 1
    ? "这处修改我先不改了"
    : `这 ${rejectedCount} 处修改我先不改了`;
}

import type { JDAnalysisResult, JDRecord } from '@/services/jdAnalysis'

function formatTitle(jd: JDRecord | null | undefined): string {
  return jd?.title?.trim() || '未命名岗位'
}

function formatCompany(jd: JDRecord | null | undefined): string {
  return jd?.company_name?.trim() || '未知公司'
}

function toBulletList(items: string[]): string {
  const cleaned = items.map((item) => item.trim()).filter(Boolean)
  if (!cleaned.length) return '- 暂无'
  return cleaned.map((item) => `- ${item}`).join('\n')
}

function toInlineList(items: string[]): string {
  const cleaned = items.map((item) => item.trim()).filter(Boolean)
  if (!cleaned.length) return '暂无'
  return cleaned.join(' / ')
}

export function buildJDIntentAcknowledgement(input: string): string {
  return [
    '已识别为 **JD 分析** 请求，已打开右侧 JD 分析抽屉。',
    '',
    `你的需求是：${input.trim() || '岗位分析'}`,
    '',
    '接下来可以直接选择已保存 JD，或粘贴岗位链接 / 岗位文本后点击 **运行分析**。',
  ].join('\n')
}

export function buildJDSavedMessage(jd: JDRecord): string {
  return `已保存 JD：**${formatTitle(jd)}** / ${formatCompany(jd)}。`
}

export function buildJDRunUserMessage(jd: JDRecord): string {
  return `请基于岗位「${formatTitle(jd)}」分析我当前已加载的简历，并输出匹配报告、Patch 和学习路径。`
}

export function buildJDAnalysisStartMessage(jd: JDRecord): string {
  return [
    `开始分析 **${formatTitle(jd)}** / ${formatCompany(jd)}。`,
    '',
    '我会在右侧抽屉展示阶段进度，并在这里同步结果摘要。',
  ].join('\n')
}

export function buildJDAnalysisResultMessage(
  jd: JDRecord,
  result: JDAnalysisResult,
): string {
  const match = result.report.match
  return [
    `已完成 **${formatTitle(jd)}** / ${formatCompany(jd)} 的 JD 分析。`,
    '',
    `**匹配度：${result.match_score}**`,
    '',
    match.summary,
    '',
    '**核心缺口**',
    toBulletList(match.core_gaps),
    '',
    '**优先修改项**',
    toBulletList(match.priority_updates),
    '',
    `**当前必补技术栈**：${toInlineList(match.current_must_have_stack)}`,
    '',
    `**未来储备技术栈**：${toInlineList(match.future_stack)}`,
    '',
    '右侧抽屉里已经生成对应 Patch 和学习路径，可以继续逐模块应用。',
  ].join('\n')
}

export function buildJDAnalysisErrorMessage(
  jd: JDRecord | null | undefined,
  message: string,
): string {
  return `JD 分析失败：**${formatTitle(jd)}**。${message}`
}

export function buildJDResumeSavedMessage(name: string): string {
  return `当前简历 **${name || '未命名简历'}** 已保存到数据库。`
}

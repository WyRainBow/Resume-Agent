/** 与 `index.html` 默认 `<title>` 保持一致，离开时恢复浏览器标签文案 */
export const DEFAULT_APP_DOCUMENT_TITLE = 'Resume Agent - AI智能简历生成器'

export function formatProblemTabTitle(problemTitle: string): string {
  return `${problemTitle} · ${DEFAULT_APP_DOCUMENT_TITLE}`
}

export function formatProblemListTabTitle(): string {
  return `题库 · ${DEFAULT_APP_DOCUMENT_TITLE}`
}

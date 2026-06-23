/**
 * 更新日志数据。最新版本放在数组第一项。
 * 内容保持简短：只写新增了什么、修复了什么。
 */
export type ChangelogEntry = {
  version: string
  date: string
  added?: string[]
  fixed?: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.1.0',
    date: '2026-06-23',
    added: [
      '全新登录页与账户中心（头像、套餐、额度）',
      'AI 简历额度套餐页',
      '打开工作台自动渲染预览',
    ],
    fixed: [
      '头像不显示的问题',
      '登录后页面闪烁',
      '未登录也能预览 PDF（导出才需登录）',
    ],
  },
]

export const LATEST_CHANGELOG = CHANGELOG[0]

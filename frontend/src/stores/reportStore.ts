/**
 * 报告 Store - 管理报告状态和 pendingPrompt
 * 使用简单的状态管理，不依赖 zustand
 */
let pendingPrompt: string | null = null

export const useReportStore = {
  getPendingPrompt: () => pendingPrompt,
  setPendingPrompt: (prompt: string | null) => {
    pendingPrompt = prompt
    if (prompt) {
      sessionStorage.setItem('report-pending-prompt', prompt)
    } else {
      sessionStorage.removeItem('report-pending-prompt')
    }
  },
  clearPendingPrompt: () => {
    pendingPrompt = null
    sessionStorage.removeItem('report-pending-prompt')
  },
  reset: () => {
    pendingPrompt = null
    sessionStorage.removeItem('report-pending-prompt')
  },
}

// 初始化时从 sessionStorage 恢复
if (typeof window !== 'undefined') {
  const stored = sessionStorage.getItem('report-pending-prompt')
  if (stored) {
    pendingPrompt = stored
  }
}

/**
 * 首页 hero 输入框 → 对话页（/agent/new）的图片交接。
 * File 对象无法放进 sessionStorage，这里用模块级内存传递：
 * 同一 SPA 客户端导航（无整页刷新）内存变量存活，导航到对话页后取用即清。
 * 文本仍走 sessionStorage['agent_initial_text']（可跨刷新，更稳）。
 */
let pendingImages: File[] = []

export function setHeroHandoffImages(files: File[]): void {
  pendingImages = files
}

export function hasHeroHandoffImages(): boolean {
  return pendingImages.length > 0
}

/** 取出并清空（消费一次） */
export function takeHeroHandoffImages(): File[] {
  const files = pendingImages
  pendingImages = []
  return files
}

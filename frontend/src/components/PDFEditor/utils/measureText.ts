/**
 * 文字宽度测量工具
 * 使用 Canvas 精确测量文字渲染宽度
 */

// 缓存 canvas 实例，避免重复创建
let measureCanvas: HTMLCanvasElement | null = null
let measureCtx: CanvasRenderingContext2D | null = null

/**
 * 获取测量用的 Canvas 上下文
 */
const getMeasureContext = (): CanvasRenderingContext2D | null => {
  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas')
    measureCtx = measureCanvas.getContext('2d')
  }
  return measureCtx
}

/**
 * 测量文字的渲染宽度
 * @param text 要测量的文字
 * @param fontSize 字体大小（px）
 * @param fontFamily 字体族
 * @returns 文字渲染宽度（px）
 */
export const measureTextWidth = (
  text: string,
  fontSize: number,
  fontFamily: string = 'sans-serif'
): number => {
  if (!text) return 0
  
  const ctx = getMeasureContext()
  if (!ctx) {
    // fallback: 粗略估算（中文约等于字体大小，英文约 0.6 倍）
    const chineseCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length
    const otherCount = text.length - chineseCount
    return chineseCount * fontSize + otherCount * fontSize * 0.6
  }
  
  ctx.font = `${fontSize}px ${fontFamily}`
  return ctx.measureText(text).width
}

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

  // 检查 fontSize 是否有效
  if (typeof fontSize !== 'number' || fontSize <= 0) {
    console.warn('Invalid fontSize provided to measureTextWidth:', fontSize)
    fontSize = 12 // 默认字体大小
  }

  const ctx = getMeasureContext()
  if (!ctx) {
    // fallback: 粗略估算（中文约等于字体大小，英文约 0.6 倍）
    const chineseCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length
    const otherCount = text.length - chineseCount
    return chineseCount * fontSize + otherCount * fontSize * 0.6
  }

  ctx.font = `${fontSize}px ${fontFamily}`
  const measuredWidth = ctx.measureText(text).width
  
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/1e500651-6ec2-4818-b441-0e92d146bc59',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'measureText.ts:44',message:'measureTextWidth',data:{text,fontSize,fontFamily,measuredWidth},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  
  return measuredWidth
}

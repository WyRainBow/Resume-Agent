/**
 * 坐标转换工具
 * 处理 PDF 坐标系与屏幕坐标系之间的转换
 */

import type { TextItem, TextPosition } from '../types'

// PDF 点 (pt) 到 像素 (px) 的转换比率 (96 DPI)
export const PT_TO_PX_RATIO = 96 / 72

/**
 * 将 PDF 点坐标转换为 Canvas 像素坐标
 */
export const ptToPx = (pt: number, scale: number = 1): number => {
  return pt * PT_TO_PX_RATIO * scale
}

/**
 * 将 Canvas 像素坐标转换为 PDF 点坐标
 */
export const pxToPt = (px: number, scale: number = 1): number => {
  return px / (PT_TO_PX_RATIO * scale)
}

/**
 * 从 PDF.js TextItem 计算文本位置
 * PDF.js 的 transform 数组格式: [scaleX, skewX, skewY, scaleY, x, y]
 * 注意：PDF 坐标系原点在左下角，Y 轴向上
 */
export const calculateTextPosition = (
  item: TextItem,
  pageHeight: number,
  scale: number
): TextPosition => {
  // 检查必要的参数
  if (!item || !item.transform || item.transform.length < 6) {
    console.error('Invalid text item for position calculation:', item)
    // 返回默认位置
    return {
      left: 0,
      top: 0,
      width: 100,
      height: 12,
      fontSize: 12,
    }
  }

  const [scaleX, , , scaleY, x, y] = item.transform

  // PDF Y 坐标是从底部算起的，需要转换为从顶部算起
  // fontSize 约等于 scaleY 的绝对值
  const fontSize = Math.abs(scaleY) || 12

  // 转换坐标
  const left = (x || 0) * scale
  const width = (item.width || 0) * scale
  const height = fontSize * scale
  // PDF 的 y 是基线位置，需要减去字体高度得到顶部位置
  const top = (pageHeight - (y || 0) - fontSize) * scale

  // 确保所有值都是有效的数字
  const position: TextPosition = {
    left: isNaN(left) ? 0 : left,
    top: isNaN(top) ? 0 : top,
    width: isNaN(width) ? 100 : width,
    height: isNaN(height) ? 12 : height,
    fontSize: isNaN(height) ? 12 : height,
  }

  return position
}

/**
 * 将 HEX 颜色转换为 PDF RGB (0-1 范围)
 */
export const hexToPdfRgb = (hex: string): { r: number; g: number; b: number } => {
  const cleanHex = hex.replace('#', '')
  const r = parseInt(cleanHex.slice(0, 2), 16) / 255
  const g = parseInt(cleanHex.slice(2, 4), 16) / 255
  const b = parseInt(cleanHex.slice(4, 6), 16) / 255
  return { r, g, b }
}

/**
 * 生成唯一 ID
 */
export const generateId = (): string => {
  return `edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

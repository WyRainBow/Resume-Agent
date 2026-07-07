/**
 * 页面尺寸常量与换算 —— 移植自 Resume-Matcher lib/constants/page-dimensions.ts
 */
import type { PageSize, MarginSettings } from './settings'

export const PAGE_DIMENSIONS = {
  A4: { width: 210, height: 297 },
  LETTER: { width: 215.9, height: 279.4 },
} as const

/** Convert millimeters to pixels at 96 DPI (standard screen resolution) */
export function mmToPx(mm: number): number {
  return (mm / 25.4) * 96
}

/** Get the printable content area dimensions after accounting for margins */
export function getContentArea(
  pageSize: PageSize,
  margins: MarginSettings
): { width: number; height: number } {
  const page = PAGE_DIMENSIONS[pageSize]
  return {
    width: page.width - margins.left - margins.right,
    height: page.height - margins.top - margins.bottom,
  }
}

/** Get the printable content area in pixels */
export function getContentAreaPx(
  pageSize: PageSize,
  margins: MarginSettings
): { width: number; height: number } {
  const area = getContentArea(pageSize, margins)
  return {
    width: mmToPx(area.width),
    height: mmToPx(area.height),
  }
}

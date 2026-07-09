/**
 * 单页容器 —— 移植自 Resume-Matcher components/preview/page-container.tsx。
 * 按真实 mm 尺寸渲染一页,内容按 contentOffset/contentEnd 裁切,支持边距虚线可视化。
 */
import React from 'react'
import type { PageSize, MarginSettings } from '../settings'
import { PAGE_DIMENSIONS, mmToPx } from '../pageDimensions'

interface PageContainerProps {
  pageSize: PageSize
  margins: MarginSettings
  pageNumber: number
  totalPages: number
  scale: number
  showMarginGuides: boolean
  children: React.ReactNode
  contentOffset?: number
  contentEnd?: number
}

export function PageContainer({
  pageSize,
  margins,
  pageNumber,
  totalPages,
  scale,
  showMarginGuides,
  children,
  contentOffset = 0,
  contentEnd,
}: PageContainerProps) {
  const pageDims = PAGE_DIMENSIONS[pageSize]
  const pageWidthPx = mmToPx(pageDims.width)
  const pageHeightPx = mmToPx(pageDims.height)

  const marginTopPx = mmToPx(margins.top)
  const marginBottomPx = mmToPx(margins.bottom)
  const marginLeftPx = mmToPx(margins.left)
  const marginRightPx = mmToPx(margins.right)

  const contentWidth = pageWidthPx - marginLeftPx - marginRightPx
  const maxContentHeight = pageHeightPx - marginTopPx - marginBottomPx

  // Limit visible height so content that belongs to the next page never shows here
  const actualContentHeight = contentEnd
    ? Math.min(maxContentHeight, contentEnd - contentOffset)
    : maxContentHeight

  return (
    <div className="relative flex flex-col items-center">
      {/* Page wrapper with scale transform */}
      <div
        className="relative bg-white border-2 border-black shadow-[6px_6px_0px_0px_#000000] origin-top"
        style={{
          width: pageWidthPx,
          height: pageHeightPx,
          transform: `scale(${scale})`,
          marginBottom: `${pageHeightPx * scale - pageHeightPx + 16}px`,
        }}
      >
        {/* Margin guides overlay */}
        {showMarginGuides && (
          <div
            className="absolute pointer-events-none z-10"
            style={{
              top: marginTopPx,
              left: marginLeftPx,
              width: contentWidth,
              height: maxContentHeight,
              border: '1px dashed rgba(29, 78, 216, 0.5)',
            }}
          >
            {/* Corner markers */}
            <div className="absolute -top-1 -left-1 w-2 h-2 border-t border-l border-blue-500" />
            <div className="absolute -top-1 -right-1 w-2 h-2 border-t border-r border-blue-500" />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b border-l border-blue-500" />
            <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b border-r border-blue-500" />
          </div>
        )}

        {/* Content area with clipping - uses actualContentHeight to prevent content overlap */}
        <div
          className="absolute overflow-hidden"
          style={{
            top: marginTopPx,
            left: marginLeftPx,
            width: contentWidth,
            height: actualContentHeight,
          }}
        >
          {/* Content positioned based on page offset */}
          <div
            className="absolute left-0 right-0"
            style={{
              top: -contentOffset,
              width: contentWidth,
            }}
          >
            {children}
          </div>
        </div>

        {/* Page number indicator */}
        <div
          className="absolute bottom-2 right-3 font-mono text-[10px] text-[#878E99] uppercase tracking-wider"
          style={{ transform: `scale(${1 / scale})`, transformOrigin: 'bottom right' }}
        >
          第 {pageNumber} 页 · 共 {totalPages} 页
        </div>
      </div>
    </div>
  )
}

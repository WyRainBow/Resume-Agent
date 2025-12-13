/**
 * TextLayer 管理 Hook
 * 负责从 PDF 页面提取文本内容和位置信息
 */

import { useState, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { TextItem } from '../types'

interface UseTextLayerResult {
  textItems: TextItem[]
  loading: boolean
  error: string | null
}

export const useTextLayer = (
  page: pdfjsLib.PDFPageProxy | null
): UseTextLayerResult => {
  const [textItems, setTextItems] = useState<TextItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!page) {
      setTextItems([])
      return
    }

    const extractText = async () => {
      setLoading(true)
      setError(null)

      try {
        const textContent = await page.getTextContent()
        
        // 将 PDF.js 的 TextItem 转换为我们的格式
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: TextItem[] = textContent.items
          .filter((item: any) => 
            'str' in item && typeof item.str === 'string' && item.str.trim().length > 0
          )
          .map((item: any) => ({
            str: item.str,
            dir: item.dir || 'ltr',
            width: item.width || 0,
            height: item.height || 0,
            transform: item.transform || [1, 0, 0, 1, 0, 0],
            fontName: item.fontName || '',
            hasEOL: item.hasEOL || false,
          }))

        setTextItems(items)
      } catch (err) {
        console.error('提取文本失败:', err)
        setError(err instanceof Error ? err.message : '提取失败')
      } finally {
        setLoading(false)
      }
    }

    extractText()
  }, [page])

  return { textItems, loading, error }
}

/**
 * PDF 缓存管理器
 * 负责管理 PDF 页面、渲染结果和文本层的缓存
 */

import * as pdfjsLib from 'pdfjs-dist'

interface CachedPage {
  page: pdfjsLib.PDFPageProxy
  viewport: pdfjsLib.PageViewport
  lastUsed: number
  renderCount: number
}

interface CachedRender {
  canvas: HTMLCanvasElement
  imageData: ImageBitmap | null
  lastUsed: number
  scale: number
}

interface CacheOptions {
  maxPageCache: number
  maxRenderCache: number
  ttl: number // 缓存存活时间（毫秒）
}

class PDFCacheManager {
  private pageCache = new Map<number, CachedPage>()
  private renderCache = new Map<string, CachedRender>()
  private options: CacheOptions
  private cleanupTimer?: number
  private preloadQueue: number[] = []
  private isPreloading = false
  private accessOrder: Map<string, number> = new Map()
  private lastAccessTime = 0

  constructor(options: Partial<CacheOptions> = {}) {
    this.options = {
      maxPageCache: 10,
      maxRenderCache: 20,
      ttl: 5 * 60 * 1000, // 5分钟
      ...options
    }

    // 智能预加载
    this.preloadQueue = []
    this.isPreloading = false

    // 定期清理过期缓存
    this.startCleanupTimer()
  }

  /**
   * 获取缓存的页面
   */
  getPage(pageNumber: number): CachedPage | null {
    const cached = this.pageCache.get(pageNumber)
    if (cached) {
      cached.lastUsed = Date.now()
      cached.renderCount++
      return cached
    }
    return null
  }

  /**
   * 缓存页面
   */
  cachePage(pageNumber: number, page: pdfjsLib.PDFPageProxy, viewport: pdfjsLib.PageViewport): void {
    // 如果缓存已满，删除最旧的项
    if (this.pageCache.size >= this.options.maxPageCache) {
      this.evictOldestPage()
    }

    this.pageCache.set(pageNumber, {
      page,
      viewport,
      lastUsed: Date.now(),
      renderCount: 1
    })
  }

  /**
   * 获取缓存的渲染结果
   */
  getRender(pageNumber: number, scale: number): CachedRender | null {
    const key = `${pageNumber}@${scale}`
    const cached = this.renderCache.get(key)
    if (cached && Date.now() - cached.lastUsed < this.options.ttl) {
      cached.lastUsed = Date.now()
      return cached
    }
    // 清理过期的缓存
    if (cached) {
      this.renderCache.delete(key)
    }
    return null
  }

  /**
   * 缓存渲染结果
   */
  async cacheRender(
    pageNumber: number,
    scale: number,
    canvas: HTMLCanvasElement
  ): Promise<void> {
    const key = `${pageNumber}@${scale}`

    // 如果缓存已满，删除最旧的项
    if (this.renderCache.size >= this.options.maxRenderCache) {
      this.evictOldestRender()
    }

    // 创建 ImageBitmap 以提高后续渲染性能
    let imageData: ImageBitmap | null = null
    try {
      if ('createImageBitmap' in window && 'OffscreenCanvas' in window) {
        imageData = await createImageBitmap(canvas)
      }
    } catch (err) {
      console.warn('无法创建 ImageBitmap:', err)
    }

    this.renderCache.set(key, {
      canvas: canvas.cloneNode(true) as HTMLCanvasElement,
      imageData,
      lastUsed: Date.now(),
      scale
    })
  }

  /**
   * 预加载页面
   */
  async preloadPages(
    pdfDoc: pdfjsLib.PDFDocumentProxy,
    startPage: number,
    count: number,
    scale: number
  ): Promise<void> {
    const promises: Promise<void>[] = []

    for (let i = 0; i < count; i++) {
      const pageNumber = startPage + i
      if (pageNumber <= pdfDoc.numPages && !this.pageCache.has(pageNumber)) {
        promises.push(this.loadAndCachePage(pdfDoc, pageNumber, scale))
      }
    }

    await Promise.all(promises)
  }

  /**
   * 加载并缓存单个页面
   */
  private async loadAndCachePage(
    pdfDoc: pdfjsLib.PDFDocumentProxy,
    pageNumber: number,
    scale: number
  ): Promise<void> {
    try {
      const page = await pdfDoc.getPage(pageNumber)
      const viewport = page.getViewport({ scale })
      this.cachePage(pageNumber, page, viewport)
    } catch (err) {
      console.error(`预加载页面 ${pageNumber} 失败:`, err)
    }
  }

  /**
   * 删除最旧的页面缓存
   */
  private evictOldestPage(): void {
    let oldestTime = Date.now()
    let oldestPage = -1

    for (const [pageNumber, cached] of this.pageCache) {
      if (cached.lastUsed < oldestTime) {
        oldestTime = cached.lastUsed
        oldestPage = pageNumber
      }
    }

    if (oldestPage !== -1) {
      this.pageCache.delete(oldestPage)
    }
  }

  /**
   * 删除最旧的渲染缓存
   */
  private evictOldestRender(): void {
    let oldestTime = Date.now()
    let oldestKey = ''

    for (const [key, cached] of this.renderCache) {
      if (cached.lastUsed < oldestTime) {
        oldestTime = cached.lastUsed
        oldestKey = key
      }
    }

    if (oldestKey) {
      const cached = this.renderCache.get(oldestKey)
      if (cached?.imageData) {
        cached.imageData.close()
      }
      this.renderCache.delete(oldestKey)
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now()

    // 清理页面缓存
    for (const [pageNumber, cached] of this.pageCache) {
      if (now - cached.lastUsed > this.options.ttl) {
        this.pageCache.delete(pageNumber)
      }
    }

    // 清理渲染缓存
    for (const [key, cached] of this.renderCache) {
      if (now - cached.lastUsed > this.options.ttl) {
        if (cached.imageData) {
          cached.imageData.close()
        }
        this.renderCache.delete(key)
      }
    }
  }

  /**
   * 启动定期清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = window.setInterval(() => {
      this.cleanup()
    }, 60000) // 每分钟清理一次
  }

  /**
   * 停止缓存管理器
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    // 清理所有 ImageBitmap
    for (const cached of this.renderCache.values()) {
      if (cached.imageData) {
        cached.imageData.close()
      }
    }

    this.pageCache.clear()
    this.renderCache.clear()
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    return {
      pageCacheSize: this.pageCache.size,
      renderCacheSize: this.renderCache.size,
      totalPages: this.options.maxPageCache,
      totalRenders: this.options.maxRenderCache
    }
  }
}

// 创建单例实例
export const pdfCacheManager = new PDFCacheManager()

// 导出类供测试使用
export { PDFCacheManager }
import axios from 'axios'
import type { Resume } from '@/types/resume'
import { DEFAULT_RESUME_TEMPLATE } from '@/data/defaultTemplate'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export async function aiTest(provider: 'zhipu' | 'doubao', prompt: string) {
  const url = `${API_BASE}/api/ai/test`
  const { data } = await axios.post(url, { provider, prompt })
  return data as { provider: string; result: string }
}

export async function generateResume(provider: 'zhipu' | 'doubao', instruction: string, locale: 'zh' | 'en' = 'zh') {
  const url = `${API_BASE}/api/resume/generate`
  const { data } = await axios.post(url, { provider, instruction, locale })
  return data as { provider: string; resume: Resume }
}

/**
 * 流式生成简历 - Markdown 输出 + JSON 数据
 * 真正的流式输出，逐字显示
 */
export async function generateResumeStream(
  instruction: string,
  locale: 'zh' | 'en' = 'zh',
  callbacks: {
    onMarkdown: (chunk: string) => void
    onStatus: (status: 'streaming' | 'parsing') => void
    onComplete: (resume: Resume) => void
    onError: (error: string) => void
  }
) {
  const url = `${API_BASE}/api/resume/generate/stream`
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'doubao', instruction, locale })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    
    if (!reader) {
      throw new Error('无法获取响应流')
    }
    
    let buffer = ''
    callbacks.onStatus('streaming')
    
    // 处理 SSE 消息
    const processLine = (line: string) => {
      if (!line.startsWith('data: ')) return
      
      const data = line.slice(6).trim()
      if (data === '[DONE]') return
      
      try {
        const parsed = JSON.parse(data)
        
        if (parsed.type === 'markdown' && parsed.content) {
          // 立即调用回调，触发 UI 更新
          callbacks.onMarkdown(parsed.content)
        }
        
        if (parsed.type === 'status' && parsed.content === 'parsing') {
          callbacks.onStatus('parsing')
        }
        
        if (parsed.type === 'json' && parsed.content) {
          callbacks.onComplete(parsed.content as Resume)
        }
        
        if (parsed.type === 'error') {
          callbacks.onError(parsed.content || '未知错误')
        }
      } catch {
        // 忽略 JSON 解析错误
      }
    }
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // SSE 消息以 \n\n 分隔，处理完整的消息
      const messages = buffer.split('\n\n')
      // 最后一个可能是不完整的，保留在 buffer 中
      buffer = messages.pop() || ''

      // 处理每个完整的消息
      for (const message of messages) {
        const lines = message.split('\n')
        for (const line of lines) {
          processLine(line)
        }
      }
    }
    
    // 处理剩余的 buffer
    if (buffer.trim()) {
      const lines = buffer.split('\n')
      for (const line of lines) {
        processLine(line)
      }
    }
  } catch (error) {
    callbacks.onError(error instanceof Error ? error.message : '流式请求失败')
  }
}

export async function renderPDF(resume: Resume, _useDemo: boolean = false, sectionOrder?: string[]): Promise<Blob> {
  // 检查缓存
  const cacheKey = getCacheKey(resume, sectionOrder)
  const cached = getPdfCache(cacheKey)
  if (cached) {
    console.log('[PDF Cache] 命中缓存，直接返回')
    return cached
  }

  // 使用非流式端点进行简单的PDF渲染
  const url = `${API_BASE}/api/pdf/render`
  // 将 experience 映射为 internships（因为数据存在 internships 字段）
  const mappedOrder = sectionOrder?.map(s => s === 'experience' ? 'internships' : s)
  const { data } = await axios.post(url, { resume, section_order: mappedOrder }, { responseType: 'blob' })

  // 存入缓存
  const blob = data as Blob
  setPdfCache(cacheKey, blob)
  console.log('[PDF Cache] 新PDF已缓存')

  return blob
}

/**
 * 流式渲染PDF，提供实时进度（带缓存支持）
 */
export async function renderPDFStream(
  resume: Resume,
  sectionOrder?: string[],
  onProgress?: (progress: string) => void,
  onPdf?: (pdfData: ArrayBuffer) => void,
  onError?: (error: string) => void
): Promise<Blob> {
  console.log('[API] 开始流式渲染PDF', { resume, sectionOrder })
  // 检查缓存
  const cacheKey = getCacheKey(resume, sectionOrder)
  const cached = getPdfCache(cacheKey)
  if (cached) {
    onProgress?.('从缓存加载...')
    return cached
  }

  onProgress?.('开始生成PDF...')

  const url = `${API_BASE}/api/pdf/render/stream`
  // 将 experience 映射为 internships（因为数据存在 internships 字段）
  const mappedOrder = sectionOrder?.map(s => s === 'experience' ? 'internships' : s)

  console.log('[API] 发送请求到:', url)
  console.log('[API] 请求数据:', { resume, section_order: mappedOrder })

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    },
    body: JSON.stringify({ resume, section_order: mappedOrder })
  })

  console.log('[API] 响应状态:', response.status, response.statusText)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[API] 响应错误:', errorText)
    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
  }

  const reader = response.body?.getReader()
  const decoder = new TextDecoder()

  if (!reader) {
    throw new Error('无法获取响应流')
  }

  console.log('[API] 开始读取响应流')

  let buffer = ''
  let pdfData: Uint8Array | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    console.log('[API] 收到数据块:', chunk.length, '字节')
    buffer += chunk

    // SSE格式：事件之间用双换行符分隔
    // 但单个事件可能跨越多个数据块
    const events = buffer.split('\n\n')
    buffer = events.pop() || ''  // 保留最后一个可能不完整的事件
    console.log('[API] 发现事件数:', events.length)
    console.log('[API] 剩余缓冲区长度:', buffer.length)

    for (const event of events) {
      // 每个事件可能有多行，我们查找包含 data: 的行
      const lines = event.split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6)
            console.log('[API] JSON数据:', jsonStr.substring(0, 200))
            const data = JSON.parse(jsonStr)

            if (data.event === 'progress') {
              onProgress?.(data.data)
            } else if (data.event === 'pdf') {
              // 接收PDF的十六进制数据
              const hexData = data.data
              console.log('[API] 收到PDF事件，数据长度:', hexData?.length || 0)

              // 验证hex数据
              if (!hexData || hexData.length === 0) {
                console.error('[API] PDF数据为空')
                throw new Error('PDF数据为空')
              }

              try {
                // 确保hex字符串长度为偶数
                const normalizedHex = hexData.length % 2 === 0 ? hexData : '0' + hexData
                const matches = normalizedHex.match(/.{2}/g)
                if (!matches) {
                  console.error('[API] PDF数据格式错误，无法分割成字节')
                  throw new Error('PDF数据格式错误')
                }

                pdfData = new Uint8Array(matches.map(byte => parseInt(byte, 16)))
                console.log('[API] PDF数据转换完成，大小:', pdfData.length, '字节')
              } catch (error) {
                console.error('[API] PDF数据转换失败:', error)
                throw new Error(`PDF数据转换失败: ${error.message}`)
              }
            } else if (data.event === 'error') {
              onError?.(data.data)
              throw new Error(data.data)
            }
          } catch (e) {
            console.error('解析SSE数据失败:', e)
          }
        }
      }
    }
  }

  // 处理缓冲区中剩余的数据（可能是不完整的最后一个事件）
  if (buffer && buffer.length > 0) {
    console.log('[API] 处理剩余缓冲区数据，长度:', buffer.length)
    console.log('[API] 缓冲区内容前500字符:', buffer.substring(0, 500))

    // 查找PDF数据的十六进制字符串
    // PDF事件格式通常是: event: pdf\ndata: <hex>\n\n
    const pdfEventMatch = buffer.match(/event:\s*pdf\s*\ndata:\s*([a-fA-F0-9]+)/s);

    if (pdfEventMatch) {
      const hexData = pdfEventMatch[1];
      console.log('[API] 收到PDF事件，数据长度:', hexData.length)

      try {
        const normalizedHex = hexData.length % 2 === 0 ? hexData : '0' + hexData
        const matches = normalizedHex.match(/.{2}/g)
        if (!matches) {
          console.error('[API] PDF数据格式错误')
          throw new Error('PDF数据格式错误')
        }

        pdfData = new Uint8Array(matches.map(byte => parseInt(byte, 16)))
        console.log('[API] PDF数据转换完成，大小:', pdfData.length, '字节')
      } catch (error) {
        console.error('[API] PDF数据转换失败:', error)
        throw new Error(`PDF数据转换失败: ${error.message}`)
      }
    } else {
      console.log('[API] 未找到PDF事件')
    }
  }

  if (!pdfData) {
    throw new Error('未收到PDF数据')
  }

  console.log('[API] PDF数据处理完成，创建Blob')
  onPdf?.(pdfData.buffer)

  // 创建blob并缓存
  const blob = new Blob([pdfData], { type: 'application/pdf' })
  console.log('[API] Blob创建成功，大小:', blob.size, '字节')

  setPdfCache(cacheKey, blob)
  console.log('[PDF Cache] 新PDF已缓存')

  return blob
}

export async function rewriteResume(provider: 'zhipu' | 'gemini' | 'doubao', resume: Resume, path: string, instruction: string) {
  const url = `${API_BASE}/api/resume/rewrite`
  const { data } = await axios.post(url, { provider, resume, path, instruction })
  return data as { resume: Resume }
}

/**
 * 流式 AI 改写 - 实时显示生成内容
 */
export async function rewriteResumeStream(
  provider: 'zhipu' | 'gemini' | 'doubao',
  resume: Resume,
  path: string,
  instruction: string,
  onChunk: (chunk: string) => void,
  onComplete?: () => void,
  onError?: (error: string) => void
) {
  const url = `${API_BASE}/api/resume/rewrite/stream`
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, resume, path, instruction })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    
    if (!reader) {
      throw new Error('无法获取响应流')
    }
    
    let buffer = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            onComplete?.()
            return
          }
          try {
            const parsed = JSON.parse(data)
            if (parsed.content) {
              onChunk(parsed.content)
            }
            if (parsed.error) {
              onError?.(parsed.error)
              return
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
    
    onComplete?.()
  } catch (error) {
    onError?.(error instanceof Error ? error.message : '流式请求失败')
  }
}

export async function formatResumeText(provider: 'zhipu' | 'gemini', text: string, useAi: boolean = true) {
  const url = `${API_BASE}/api/resume/format`
  const { data } = await axios.post(url, { text, provider, use_ai: useAi })
  return data as { success: boolean; data: Resume | null; method: string; error: string | null }
}

/**
 * 获取 API Key 配置状态
 */
export async function getKeysStatus() {
  const url = `${API_BASE}/api/config/keys`
  const { data } = await axios.get(url)
  return data as {
    zhipu: { configured: boolean; preview: string }
    gemini: { configured: boolean; preview: string }
  }
}

/**
 * 保存 API Key
 */
export async function saveKeys(zhipuKey?: string, geminiKey?: string) {
  const url = `${API_BASE}/api/config/keys`
  const { data } = await axios.post(url, { 
    zhipu_key: zhipuKey, 
    gemini_key: geminiKey 
  })
  return data as { success: boolean; message: string }
}

/**
 * PDF 缓存管理（使用 Map 实现简单的内存缓存）
 */
const pdfCache = new Map<string, { blob: Blob; timestamp: number }>()
const PDF_CACHE_MAX_SIZE = 10
const PDF_CACHE_TTL = 10 * 60 * 1000 // 10分钟

function getCacheKey(resume: Resume, sectionOrder?: string[]): string {
  const data = {
    resume,
    sectionOrder: sectionOrder || []
  }
  // 先用 encodeURIComponent 处理中文字符，再使用 btoa
  const jsonString = JSON.stringify(data)
  try {
    return btoa(encodeURIComponent(jsonString)).slice(0, 100)
  } catch (error) {
    // 如果 btoa 仍然失败，使用简单哈希
    let hash = 0
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return `hash_${Math.abs(hash)}`
  }
}

/**
 * 清理过期的PDF缓存
 */
function cleanExpiredCache(): void {
  const now = Date.now()
  for (const [key, value] of pdfCache.entries()) {
    if (now - value.timestamp > PDF_CACHE_TTL) {
      pdfCache.delete(key)
    }
  }
}

/**
 * 添加或更新PDF缓存
 */
function setPdfCache(key: string, blob: Blob): void {
  cleanExpiredCache()

  // 如果缓存已满，删除最旧的条目
  if (pdfCache.size >= PDF_CACHE_MAX_SIZE) {
    const oldestKey = pdfCache.keys().next().value
    pdfCache.delete(oldestKey)
  }

  pdfCache.set(key, {
    blob,
    timestamp: Date.now()
  })
}

/**
 * 获取缓存的PDF
 */
function getPdfCache(key: string): Blob | null {
  const cached = pdfCache.get(key)
  if (!cached) return null

  const now = Date.now()
  if (now - cached.timestamp > PDF_CACHE_TTL) {
    pdfCache.delete(key)
    return null
  }

  return cached.blob
}

/**
 * 获取默认简历模板
 *
 * 使用前端内嵌的模板，不依赖后端
 * 用户数据保存在浏览器 localStorage 中
 */
export function getDefaultTemplate(): Resume {
  return structuredClone(DEFAULT_RESUME_TEMPLATE)
}

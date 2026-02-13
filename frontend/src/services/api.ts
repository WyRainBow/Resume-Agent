import axios from 'axios'
import { getApiBaseUrl } from '@/lib/runtimeEnv'
import type { Resume } from '@/types/resume'
import type { ResumeData } from '@/pages/Workspace/v2/types'
import { DEFAULT_RESUME_TEMPLATE } from '@/data/defaultTemplate'

export async function aiTest(provider: 'zhipu' | 'doubao', prompt: string) {
  const url = `${getApiBaseUrl()}/api/ai/test`
  const { data } = await axios.post(url, { provider, prompt })
  return data as { provider: string; result: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }
}

export async function generateResume(provider: 'zhipu' | 'doubao', instruction: string, locale: 'zh' | 'en' = 'zh') {
  const url = `${getApiBaseUrl()}/api/resume/generate`
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
  const url = `${getApiBaseUrl()}/api/resume/generate/stream`
  
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
  const traceId = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const mappedOrder = sectionOrder?.map(s => s === 'experience' ? 'internships' : s)
  console.log('[PDF TRACE][renderPDF:start]', {
    traceId,
    sectionOrder: mappedOrder,
    resumeKeys: Object.keys((resume || {}) as any).slice(0, 20),
  })

  // 使用非流式端点进行简单的PDF渲染
  const url = `${getApiBaseUrl()}/api/pdf/render`
  const { data } = await axios.post(
    url,
    { resume, section_order: mappedOrder },
    {
      responseType: 'blob',
      headers: {
        'X-PDF-Trace-Id': traceId,
        'X-PDF-Trace-Source': 'api.renderPDF',
      },
    }
  )
  console.log('[PDF TRACE][renderPDF:done]', { traceId, size: (data as Blob).size })
  return data as Blob
}

/**
 * 流式渲染PDF，提供实时进度
 */
export async function renderPDFStream(
  resume: Resume,
  sectionOrder?: string[],
  onProgress?: (progress: string) => void,
  onPdf?: (pdfData: ArrayBuffer) => void,
  onError?: (error: string) => void,
  context?: {
    sessionId?: string
    resumeId?: string
    traceId?: string
    source?: string
    trigger?: string
  }
): Promise<Blob> {
  const traceId = context?.traceId || `pdfs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const traceSource = context?.source || 'api.renderPDFStream'
  const traceTrigger = context?.trigger || 'unknown'
  const callerStack = new Error().stack?.split('\n').slice(2, 6).join(' <- ')

  console.log('[PDF TRACE][stream:start]', {
    traceId,
    traceSource,
    traceTrigger,
    sessionId: context?.sessionId,
    resumeId: context?.resumeId,
    sectionOrder,
    callerStack,
  })

  onProgress?.('开始生成PDF...')

  const url = `${getApiBaseUrl()}/api/pdf/render/stream`
  // 将 experience 映射为 internships（因为数据存在 internships 字段）
  const mappedOrder = sectionOrder?.map(s => s === 'experience' ? 'internships' : s)

  console.log('[PDF TRACE][stream:request]', {
    traceId,
    traceSource,
    traceTrigger,
    url,
    sessionId: context?.sessionId,
    resumeId: context?.resumeId,
    mappedOrder,
  })

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...(context?.sessionId ? { 'X-Agent-Session-Id': context.sessionId } : {}),
      ...(context?.resumeId ? { 'X-Agent-Resume-Id': context.resumeId } : {}),
      'X-PDF-Trace-Id': traceId,
      'X-PDF-Trace-Source': traceSource,
      'X-PDF-Trace-Trigger': traceTrigger,
    },
    body: JSON.stringify({ resume, section_order: mappedOrder })
  })

  console.log('[PDF TRACE][stream:response]', {
    traceId,
    status: response.status,
    statusText: response.statusText,
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[PDF TRACE][stream:http-error]', { traceId, errorText })
    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
  }

  const reader = response.body?.getReader()
  const decoder = new TextDecoder()

  if (!reader) {
    throw new Error('无法获取响应流')
  }

  console.log('[PDF TRACE][stream:read-start]', { traceId })

  let buffer = ''
  let pdfData: Uint8Array | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    console.log('[PDF TRACE][stream:chunk]', { traceId, chunkBytes: chunk.length })
    buffer += chunk

    // SSE格式：事件之间用双换行符分隔
    // 但单个事件可能跨越多个数据块
    const events = buffer.split('\n\n')
    buffer = events.pop() || ''  // 保留最后一个可能不完整的事件
    console.log('[PDF TRACE][stream:buffer]', { traceId, events: events.length, bufferLen: buffer.length })

    for (const event of events) {
      // SSE 格式：先解析 event: 行，再解析 data: 行
      const lines = event.split('\n')
      let eventType: string | null = null
      let eventData: string | null = null

      // 先解析 event: 和 data: 行
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          eventData = line.slice(6).trim()
        }
      }

      // 根据事件类型处理数据
      if (eventType && eventData !== null) {
        try {
          if (eventType === 'progress') {
            // progress 事件的 data 是纯字符串
            onProgress?.(eventData)
          } else if (eventType === 'error') {
            // error 事件的 data 是纯字符串
            console.error('[PDF TRACE][stream:event-error]', { traceId, eventData })
            onError?.(eventData)
            throw new Error(eventData)
          } else if (eventType === 'pdf') {
            // pdf 事件的 data 是十六进制字符串
            const hexData = eventData
            console.log('[PDF TRACE][stream:event-pdf]', { traceId, hexLen: hexData?.length || 0 })

            // 验证hex数据
            if (!hexData || hexData.length === 0) {
              console.error('[PDF TRACE][stream:pdf-empty]', { traceId })
              throw new Error('PDF数据为空')
            }

            try {
              // 确保hex字符串长度为偶数
              const normalizedHex = hexData.length % 2 === 0 ? hexData : '0' + hexData
              const matches = normalizedHex.match(/.{2}/g)
              if (!matches) {
                console.error('[PDF TRACE][stream:pdf-format-invalid]', { traceId })
                throw new Error('PDF数据格式错误')
              }

              pdfData = new Uint8Array(matches.map(byte => parseInt(byte, 16)))
              console.log('[PDF TRACE][stream:pdf-parsed]', { traceId, bytes: pdfData.length })
            } catch (error) {
              console.error('[PDF TRACE][stream:pdf-parse-failed]', { traceId, error })
              throw new Error(`PDF数据转换失败: ${error instanceof Error ? error.message : String(error)}`)
            }
          }
        } catch (e) {
          // 如果是 error 事件，重新抛出以便上层处理
          if (eventType === 'error') {
            throw e
          }
          console.error('[PDF TRACE][stream:sse-parse-failed]', { traceId, error: e })
        }
      }
    }
  }

  // 处理缓冲区中剩余的数据（可能是不完整的最后一个事件）
  if (buffer && buffer.length > 0) {
    console.log('[PDF TRACE][stream:tail-buffer]', {
      traceId,
      length: buffer.length,
      preview: buffer.substring(0, 200),
    })

    // 解析剩余缓冲区中的事件
    const lines = buffer.split('\n')
    let eventType: string | null = null
    let eventData: string | null = null

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        eventData = line.slice(6).trim()
      }
    }

    if (eventType === 'error' && eventData) {
      // 处理错误事件
      console.error('[PDF TRACE][stream:tail-error]', { traceId, eventData })
      onError?.(eventData)
      throw new Error(eventData)
    } else if (eventType === 'pdf' && eventData) {
      // 处理PDF事件
      const hexData = eventData
      console.log('[PDF TRACE][stream:tail-pdf]', { traceId, hexLen: hexData.length })

      try {
        const normalizedHex = hexData.length % 2 === 0 ? hexData : '0' + hexData
        const matches = normalizedHex.match(/.{2}/g)
        if (!matches) {
          console.error('[PDF TRACE][stream:tail-pdf-format-invalid]', { traceId })
          throw new Error('PDF数据格式错误')
        }

        pdfData = new Uint8Array(matches.map(byte => parseInt(byte, 16)))
        console.log('[PDF TRACE][stream:tail-pdf-parsed]', { traceId, bytes: pdfData.length })
      } catch (error) {
        console.error('[PDF TRACE][stream:tail-pdf-parse-failed]', { traceId, error })
        throw new Error(`PDF数据转换失败: ${error instanceof Error ? error.message : String(error)}`)
      }
    } else if (eventType === 'progress' && eventData) {
      // 处理进度事件
      onProgress?.(eventData)
    } else {
      console.log('[PDF TRACE][stream:tail-no-event]', { traceId })
    }
  }

  if (!pdfData) {
    throw new Error('未收到PDF数据')
  }

  console.log('[PDF TRACE][stream:pdf-ready]', { traceId })
  onPdf?.(pdfData.buffer as ArrayBuffer)

  // 创建 blob 返回
  const blob = new Blob([pdfData.buffer as ArrayBuffer], { type: 'application/pdf' })
  console.log('[PDF TRACE][stream:done]', { traceId, blobSize: blob.size })

  return blob
}

export async function rewriteResume(provider: 'zhipu' | 'doubao', resume: Resume, path: string, instruction: string) {
  const url = `${getApiBaseUrl()}/api/resume/rewrite`
  const { data } = await axios.post(url, { provider, resume, path, instruction })
  return data as { resume: Resume }
}

/**
 * 流式 AI 改写 - 实时显示生成内容
 */
export async function rewriteResumeStream(
  provider: 'zhipu' | 'doubao' | 'deepseek',
  resume: Resume,
  path: string,
  instruction: string,
  onChunk: (chunk: string) => void,
  onComplete?: () => void,
  onError?: (error: string) => void,
  signal?: AbortSignal
) {
  const url = `${getApiBaseUrl()}/api/resume/rewrite/stream`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, resume, path, instruction }),
      signal  // 添加 AbortSignal
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
    
    // 处理 SSE 消息
    const processLine = (line: string) => {
      if (!line.startsWith('data: ')) return
      
      const data = line.slice(6).trim()
      if (data === '[DONE]') {
        onComplete?.()
        return
      }
      
      try {
        const parsed = JSON.parse(data)
        if (parsed.content) {
          // 立即调用回调，触发 UI 更新
          onChunk(parsed.content)
        }
        if (parsed.error) {
          onError?.(parsed.error)
          return
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
    
    onComplete?.()
  } catch (error) {
    onError?.(error instanceof Error ? error.message : '流式请求失败')
  }
}

export async function formatResumeText(provider: 'zhipu' | 'doubao', text: string, useAi: boolean = true) {
  const url = `${getApiBaseUrl()}/api/resume/format`
  const { data } = await axios.post(url, { text, provider, use_ai: useAi })
  return data as { success: boolean; data: Resume | null; method: string; error: string | null }
}

/**
 * 获取默认简历模板
 *
 * 使用前端内嵌的模板，不依赖后端
 * 用户数据保存在浏览器 localStorage 中
 */
export function getDefaultTemplate(): ResumeData {
  return structuredClone(DEFAULT_RESUME_TEMPLATE)
}

/**
 * 编译 LaTeX 源代码为 PDF（流式）
 * 使用 slager 原版样式，与 slager.link 完全一致
 */
export async function compileLatexStream(
  latexContent: string,
  onProgress?: (progress: string) => void,
  onPdf?: (pdfData: ArrayBuffer) => void,
  onError?: (error: string) => void
): Promise<Blob> {
  console.log('[API] 开始编译 LaTeX，内容长度:', latexContent.length)
  
  onProgress?.('开始编译 LaTeX...')
  
  const url = `${getApiBaseUrl()}/api/pdf/compile-latex/stream`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    },
    body: JSON.stringify({ latex_content: latexContent })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
  }
  
  const reader = response.body?.getReader()
  const decoder = new TextDecoder()
  
  if (!reader) {
    throw new Error('无法获取响应流')
  }
  
  let buffer = ''
  let pdfData: Uint8Array | null = null
  
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    
    const chunk = decoder.decode(value, { stream: true })
    buffer += chunk
    
    const events = buffer.split('\n\n')
    buffer = events.pop() || ''
    
    for (const event of events) {
      const lines = event.split('\n')
      let eventType: string | null = null
      let eventData: string | null = null

      // 先解析 event: 和 data: 行
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          eventData = line.slice(6).trim()
        }
      }

      // 根据事件类型处理数据
      if (eventType && eventData !== null) {
        try {
          if (eventType === 'progress') {
            // progress 事件的 data 是纯字符串
            onProgress?.(eventData)
          } else if (eventType === 'error') {
            // error 事件的 data 是纯字符串
            console.error('[API] 收到错误事件:', eventData)
            onError?.(eventData)
            throw new Error(eventData)
          } else if (eventType === 'pdf') {
            // pdf 事件的 data 是十六进制字符串
            const hexData = eventData
            console.log('[API] 收到 PDF 数据，长度:', hexData?.length || 0)
            
            const normalizedHex = hexData.length % 2 === 0 ? hexData : '0' + hexData
            const matches = normalizedHex.match(/.{2}/g)
            if (matches) {
              pdfData = new Uint8Array(matches.map((byte: string) => parseInt(byte, 16)))
            }
          }
        } catch (e) {
          // 如果是 error 事件，重新抛出以便上层处理
          if (eventType === 'error') {
            throw e
          }
          console.error('解析 SSE 数据失败:', e)
        }
      }
    }
  }
  
  // 处理剩余缓冲区
  if (buffer && !pdfData) {
    const lines = buffer.split('\n')
    let eventType: string | null = null
    let eventData: string | null = null

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        eventData = line.slice(6).trim()
      }
    }

    if (eventType === 'error' && eventData) {
      console.error('[API] 收到错误事件:', eventData)
      onError?.(eventData)
      throw new Error(eventData)
    } else if (eventType === 'pdf' && eventData) {
      const hexData = eventData
      const normalizedHex = hexData.length % 2 === 0 ? hexData : '0' + hexData
      const matches = normalizedHex.match(/.{2}/g)
      if (matches) {
        pdfData = new Uint8Array(matches.map((byte: string) => parseInt(byte, 16)))
      }
    } else if (eventType === 'progress' && eventData) {
      onProgress?.(eventData)
    }
  }
  
  if (!pdfData) {
    throw new Error('未收到 PDF 数据')
  }
  
  onPdf?.(pdfData.buffer as ArrayBuffer)
  
  const blob = new Blob([pdfData.buffer as ArrayBuffer], { type: 'application/pdf' })
  console.log('[API] LaTeX 编译完成，PDF 大小:', blob.size, '字节')
  
  return blob
}

// ======================
// 报告相关 API
// ======================

export interface CreateReportResponse {
  reportId: string
  mainId: string
  conversation_id: string
}

export interface ReportDetail {
  id: string
  title: string
  main_id: string
  conversation_id: string | null
  created_at: string | null
  updated_at: string | null
}

export interface ReportListItem {
  id: string
  title: string
  created_at: string | null
  updated_at: string | null
}

export interface ReportListResponse {
  items: ReportListItem[]
  total: number
}

export interface DocumentContent {
  content: string
  updated_at: string | null
}

export interface ReportListItem {
  id: string
  title: string
  created_at: string | null
  updated_at: string | null
}

export interface ReportListResponse {
  items: ReportListItem[]
  total: number
}

/**
 * 创建报告
 */
export async function createReport(topic: string, title?: string): Promise<CreateReportResponse> {
  const url = `${getApiBaseUrl()}/api/reports/`
  const { data } = await axios.post(url, { topic, title })
  return data as CreateReportResponse
}

/**
 * 获取报告详情
 */
export async function getReport(reportId: string): Promise<ReportDetail> {
  const url = `${getApiBaseUrl()}/api/reports/${reportId}`
  const { data } = await axios.get(url)
  return data as ReportDetail
}

/**
 * 确保报告有关联的对话
 */
export async function ensureReportConversation(reportId: string): Promise<{ conversation_id: string }> {
  const url = `${getApiBaseUrl()}/api/reports/${reportId}/ensure-conversation`
  const { data } = await axios.post(url)
  return data as { conversation_id: string }
}

/**
 * 获取文档内容
 */
export async function getDocumentContent(documentId: string): Promise<DocumentContent> {
  const url = `${getApiBaseUrl()}/api/documents/${documentId}/content`
  const { data } = await axios.get(url)
  return data as DocumentContent
}

/**
 * 获取报告列表
 */
export async function listReports(page: number = 1, pageSize: number = 20): Promise<ReportListResponse> {
  const url = `${getApiBaseUrl()}/api/reports/`
  const { data } = await axios.get(url, { params: { page, page_size: pageSize } })
  return data as ReportListResponse
}

/**
 * 更新文档内容
 */
export async function updateDocumentContent(documentId: string, content: string): Promise<{ success: boolean }> {
  const url = `${getApiBaseUrl()}/api/documents/${documentId}/content`
  const { data } = await axios.post(url, { content })
  return data as { success: boolean }
}

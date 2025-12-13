import axios from 'axios'
import type { Resume } from '@/types/resume'
import { DEFAULT_RESUME_TEMPLATE } from '@/data/defaultTemplate'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'

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
      
      // #region agent log
      readCount++
      const rawChunk = decoder.decode(value, { stream: true })
      fetch('http://127.0.0.1:7243/ingest/1e500651-6ec2-4818-b441-0e92d146bc59',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:reader.read',message:'reader.read() called',data:{readNum:readCount,chunkSize:value?.length||0,rawChunkLength:rawChunk.length,messageCountInChunk:rawChunk.split('\\n\\n').length-1},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
      buffer += rawChunk
      // #endregion
      
      // SSE 消息以 \n\n 分隔，处理完整的消息
      const messages = buffer.split('\n\n')
      // 最后一个可能是不完整的，保留在 buffer 中
      buffer = messages.pop() || ''
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/1e500651-6ec2-4818-b441-0e92d146bc59',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:splitMessages',message:'messages split',data:{readNum:readCount,messagesCount:messages.length,bufferRemaining:buffer.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
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
  const url = `${API_BASE}/api/pdf/render`
  // 将 experience 映射为 internships（因为数据存在 internships 字段）
  const mappedOrder = sectionOrder?.map(s => s === 'experience' ? 'internships' : s)
  const { data } = await axios.post(url, { resume, section_order: mappedOrder }, { responseType: 'blob' })
  return data as Blob
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
 * 获取默认简历模板
 * 
 * 使用前端内嵌的模板，不依赖后端
 * 用户数据保存在浏览器 localStorage 中
 */
export function getDefaultTemplate(): Resume {
  return structuredClone(DEFAULT_RESUME_TEMPLATE)
}

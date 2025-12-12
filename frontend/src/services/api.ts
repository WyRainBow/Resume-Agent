import axios from 'axios'
import type { Resume } from '@/types/resume'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'

export async function aiTest(provider: 'zhipu' | 'gemini' | 'mock', prompt: string) {
  const url = `${API_BASE}/api/ai/test`
  const { data } = await axios.post(url, { provider, prompt })
  return data as { provider: string; result: string }
}

export async function generateResume(provider: 'zhipu' | 'gemini' | 'mock', instruction: string, locale: 'zh' | 'en' = 'zh') {
  const url = `${API_BASE}/api/resume/generate`
  const { data } = await axios.post(url, { provider, instruction, locale })
  return data as { provider: string; resume: Resume }
}

export async function renderPDF(resume: Resume, useDemo: boolean = false, sectionOrder?: string[]): Promise<Blob> {
  const url = `${API_BASE}/api/pdf/render`
  // 将 experience 映射为 internships（因为数据存在 internships 字段）
  const mappedOrder = sectionOrder?.map(s => s === 'experience' ? 'internships' : s)
  const { data } = await axios.post(url, { resume, demo: useDemo, section_order: mappedOrder }, { responseType: 'blob' })
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
 */
export async function getDefaultTemplate() {
  const url = `${API_BASE}/api/resume/template`
  const { data } = await axios.get(url)
  return data as Resume
}

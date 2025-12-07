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

export async function renderPDF(resume: Resume, useDemo: boolean = false): Promise<Blob> {
  const url = `${API_BASE}/api/pdf/render`
  const { data } = await axios.post(url, { resume, demo: useDemo }, { responseType: 'blob' })
  return data as Blob
}

export async function rewriteResume(provider: 'zhipu' | 'gemini', resume: Resume, path: string, instruction: string) {
  const url = `${API_BASE}/api/resume/rewrite`
  const { data } = await axios.post(url, { provider, resume, path, instruction })
  return data as { resume: Resume }
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

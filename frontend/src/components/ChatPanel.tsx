import React, { useState, useEffect } from 'react'
import { aiTest, generateResume, formatResumeText } from '@/services/api'
import type { Resume } from '@/types/resume'

type Props = {
  onResume: (resume: Resume) => void
  onLoadDemo?: () => void
  pdfBlob?: Blob | null
  initialInstruction?: string | null
  onGoHome?: () => void
}

export default function ChatPanel({ onResume, onLoadDemo, pdfBlob, initialInstruction, onGoHome }: Props) {
  const [provider, setProvider] = useState<'zhipu' | 'gemini'>('zhipu')
  const [logs, setLogs] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [resumeJson, setResumeJson] = useState<string>('')
  const [jsonError, setJsonError] = useState<string>('')
  const [resumeText, setResumeText] = useState<string>('')
  const [formatting, setFormatting] = useState(false)
  const [currentInstruction, setCurrentInstruction] = useState<string>('')

  /**
   * 从首页传入指令时，自动触发 AI 生成
   */
  useEffect(() => {
    if (initialInstruction) {
      setCurrentInstruction(initialInstruction)
      // 自动触发生成
      handleAutoGenerate(initialInstruction)
    }
  }, [initialInstruction])

  async function handleAutoGenerate(instruction: string) {
    setAiGenerating(true)
    setJsonError('')
    setLogs(prev => `${prev}\n[自动生成] 正在根据首页输入生成简历...`)
    try {
      const r = await generateResume(provider, instruction, 'zh')
      const jsonStr = JSON.stringify(r.resume, null, 2)
      setResumeJson(jsonStr)
      setLogs(prev => `${prev}\n[AI 生成成功:${r.provider}]\n已生成 JSON 数据`)
      // 自动触发 PDF 生成
      onResume(r.resume)
    } catch (e: any) {
      const errorDetail = e?.response?.data ? JSON.stringify(e.response.data, null, 2) : formatAxiosError(e)
      setLogs(prev => `${prev}\n[AI 生成错误]\n${errorDetail}`)
    } finally {
      setAiGenerating(false)
    }
  }

  function formatAxiosError(err: any) {
    const detail = err?.response?.data?.detail
    if (detail) return `[${err?.response?.status}] ${detail}`
    return err?.message || String(err)
  }

  async function handleTest() {
    setLoading(true)
    try {
      const r = await aiTest(provider, '你好，简要介绍一下你自己（10字以内）')
      // 完整显示 API 返回结果
      const fullResult = JSON.stringify(r, null, 2)
      setLogs(prev => `${prev}\n[AI测试:${r.provider}]\n完整返回结果:\n${fullResult}`)
    } catch (e: any) {
      const errorDetail = e?.response?.data ? JSON.stringify(e.response.data, null, 2) : formatAxiosError(e)
      setLogs(prev => `${prev}\n[AI测试错误]\n完整错误信息:\n${errorDetail}`)
    } finally {
      setLoading(false)
    }
  }


  /* 格式化文本为 JSON（多层降级） */
  async function handleFormatText() {
    if (!resumeText.trim()) {
      alert('请输入简历文本内容')
      return
    }
    
    setFormatting(true)
    setJsonError('')
    try {
      /* 调用新的多层降级 API */
      const result = await formatResumeText(provider, resumeText, true)
      
      if (result.success && result.data) {
        const jsonStr = JSON.stringify(result.data, null, 2)
        setResumeJson(jsonStr)
        
        /* 根据使用的方法显示不同的日志 */
        const methodNames: Record<string, string> = {
          'json-repair': 'JSON 修复',
          'regex': '正则提取',
          'smart': '智能解析',
          'ai': 'AI 解析'
        }
        const methodName = methodNames[result.method] || result.method
        setLogs(prev => `${prev}\n[格式化成功:使用 ${methodName}]\n已将文本转换为 JSON`)
      } else {
        setLogs(prev => `${prev}\n[格式化失败]\n${result.error || '未知错误'}`)
        alert(`格式化失败：${result.error || '未知错误'}`)
      }
    } catch (e: any) {
      const errorDetail = e?.response?.data ? JSON.stringify(e.response.data, null, 2) : formatAxiosError(e)
      setLogs(prev => `${prev}\n[格式化错误]\n${errorDetail}`)
      alert('格式化失败，请查看日志')
    } finally {
      setFormatting(false)
    }
  }

  /* 生成简历 PDF */
  async function handleGeneratePDF() {
    if (!resumeJson.trim()) {
      alert('请先点击 "AI 生成" 生成简历数据')
      return
    }
    
    /* 验证 JSON 格式 */
    try {
      const resume = JSON.parse(resumeJson)
      setPdfGenerating(true)
      setJsonError('')
      
      onResume(resume)
      setLogs(prev => `${prev}\n[生成简历]\n开始渲染 PDF`)
    } catch (e: any) {
      setJsonError('JSON 格式错误，请检查并修正')
      setLogs(prev => `${prev}\n[JSON 错误]\n${e.message}`)
      alert('JSON 格式错误，请检查并修正')
    } finally {
      setPdfGenerating(false)
    }
  }

  return (
    <div style={{ 
      padding: 'clamp(16px, 3vw, 24px)', 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      color: 'white',
      boxSizing: 'border-box',
      minHeight: 0
    }}>
      <label style={{ 
        fontSize: 'clamp(12px, 1.5vw, 13px)', 
        color: 'rgba(255, 255, 255, 0.9)', 
        marginBottom: 8,
        fontWeight: 500
      }}>
        模型提供方
      </label>
      <select
        value={provider}
        onChange={e => setProvider(e.target.value as any)}
        style={{ 
          padding: 'clamp(10px, 2vw, 12px) clamp(12px, 2vw, 16px)', 
          marginBottom: 'clamp(16px, 2.5vw, 20px)',
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '12px',
          color: 'white',
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.3s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)'
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(167, 139, 250, 0.3)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        <option value="zhipu" style={{ background: '#764ba2', color: 'white' }}>智谱</option>
        <option value="gemini" style={{ background: '#764ba2', color: 'white' }}>Gemini</option>
      </select>

      {/* 当前指令显示 */}
      {currentInstruction && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(167, 139, 250, 0.15)',
          border: '1px solid rgba(167, 139, 250, 0.3)',
          borderRadius: '12px',
          marginBottom: '16px',
          fontSize: '14px',
          color: '#c4b5fd'
        }}>
          <span style={{ opacity: 0.7 }}>当前生成指令：</span>
          <span style={{ fontWeight: 500 }}>{currentInstruction}</span>
        </div>
      )}

      {/* AI 生成状态 */}
      {aiGenerating && (
        <div style={{
          padding: '16px',
          background: 'rgba(236, 72, 153, 0.15)',
          border: '1px solid rgba(236, 72, 153, 0.3)',
          borderRadius: '12px',
          marginBottom: '16px',
          textAlign: 'center',
          color: '#f472b6'
        }}>
          <div style={{ fontSize: '20px', marginBottom: '8px' }}>✨</div>
          <div>AI 正在生成简历...</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'clamp(8px, 1.5vw, 12px)', marginBottom: 'clamp(16px, 2.5vw, 20px)', flexWrap: 'wrap' }}>
        <button 
          onClick={handleGeneratePDF} 
          disabled={pdfGenerating || !resumeJson.trim()} 
          style={{ 
            flex: '1 1 auto',
            minWidth: '120px',
            padding: 'clamp(12px, 2vw, 14px) clamp(16px, 2.5vw, 20px)', 
            fontWeight: 600,
            fontSize: 'clamp(12px, 1.75vw, 14px)',
            background: (pdfGenerating || !resumeJson.trim()) 
              ? 'rgba(255, 255, 255, 0.1)' 
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: 'clamp(8px, 1.5vw, 12px)',
            color: 'white',
            cursor: (pdfGenerating || !resumeJson.trim()) ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
            opacity: (pdfGenerating || !resumeJson.trim()) ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!pdfGenerating && resumeJson.trim()) {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)'
            }
          }}
          onMouseLeave={(e) => {
            if (!pdfGenerating && resumeJson.trim()) {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)'
            }
          }}
        >
          {pdfGenerating ? '渲染中...' : '生成简历'}
        </button>
      </div>

      {/* 文本输入区域 */}
      <div style={{ 
        marginTop: 16,
        padding: 'clamp(12px, 2vw, 16px)',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 'clamp(8px, 1.5vw, 12px)',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{ 
          fontSize: 'clamp(12px, 1.5vw, 13px)', 
          color: 'rgba(255, 255, 255, 0.9)', 
          marginBottom: 8,
          fontWeight: 500
        }}>
          输入完整简历内容（纯文本）
        </div>
        <textarea
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              const placeholder = '例如：\n张三\n13800138000\n工作经历：2020-2023 腾讯 后端工程师\n负责微服务架构设计\n技能：Java、Go、Redis'
              if (!resumeText || placeholder.startsWith(resumeText)) {
                e.preventDefault()
                setResumeText(placeholder)
              }
            }
          }}
          placeholder='例如：（TAB 补全）&#10;张三&#10;13800138000&#10;工作经历：2020-2023 腾讯 后端工程师&#10;负责微服务架构设计&#10;技能：Java、Go、Redis'
          style={{ 
            width: '100%', 
            minHeight: '120px',
            maxHeight: '200px',
            padding: 'clamp(10px, 1.5vw, 12px)', 
            background: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 'clamp(6px, 1vw, 8px)',
            color: 'white',
            fontSize: 'clamp(12px, 1.5vw, 13px)',
            fontFamily: 'inherit',
            resize: 'vertical',
            marginBottom: 12
          }}
        />
        <button
          onClick={handleFormatText}
          disabled={formatting || !resumeText.trim()}
          style={{
            width: '100%',
            padding: 'clamp(10px, 1.75vw, 12px)',
            background: (formatting || !resumeText.trim())
              ? 'rgba(255, 255, 255, 0.1)'
              : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: 'none',
            borderRadius: 'clamp(6px, 1vw, 8px)',
            color: 'white',
            cursor: (formatting || !resumeText.trim()) ? 'not-allowed' : 'pointer',
            fontSize: 'clamp(12px, 1.5vw, 13px)',
            fontWeight: 600,
            transition: 'all 0.3s ease',
            opacity: (formatting || !resumeText.trim()) ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!formatting && resumeText.trim()) {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)'
            }
          }}
          onMouseLeave={(e) => {
            if (!formatting && resumeText.trim()) {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }
          }}
        >
          {formatting ? '格式化中...' : '格式化为 JSON'}
        </button>
      </div>

      {/* JSON 编辑区域 */}
      <div style={{ 
        fontSize: 'clamp(12px, 1.5vw, 13px)', 
        color: 'rgba(255, 255, 255, 0.9)', 
        marginBottom: 8,
        marginTop: 16,
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        简历 JSON 数据
        {jsonError && (
          <span style={{ color: '#ff6b6b', fontSize: '12px' }}>({jsonError})</span>
        )}
      </div>
      <textarea
        value={resumeJson}
        onChange={(e) => {
          setResumeJson(e.target.value)
          setJsonError('')
        }}
        placeholder='点击 "AI 生成" 按钮后，这里将显示 AI 生成的 JSON 数据，您可以编辑修改'
        style={{ 
          width: '100%', 
          minHeight: '200px',
          maxHeight: '300px',
          padding: 'clamp(12px, 2vw, 16px)', 
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(10px)',
          border: jsonError ? '1px solid #ff6b6b' : '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: 'clamp(8px, 1.5vw, 12px)',
          color: 'white',
          fontSize: 'clamp(11px, 1.5vw, 13px)',
          fontFamily: 'Monaco, Consolas, "Courier New", monospace',
          resize: 'vertical',
          marginBottom: 16
        }}
      />

      <div style={{ 
        fontSize: 'clamp(12px, 1.5vw, 13px)', 
        color: 'rgba(255, 255, 255, 0.9)', 
        marginBottom: 8,
        fontWeight: 500
      }}>
        日志
      </div>
      <textarea
        value={logs}
        readOnly
        style={{ 
          flex: 1, 
          width: '100%', 
          minHeight: '100px',
          padding: 'clamp(12px, 2vw, 16px)', 
          background: 'rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: 'clamp(8px, 1.5vw, 12px)',
          color: 'rgba(255, 255, 255, 0.9)',
          fontSize: 'clamp(11px, 1.5vw, 12px)',
          fontFamily: 'Monaco, Menlo, "Courier New", monospace',
          resize: 'none',
          outline: 'none',
          lineHeight: '1.6'
        }}
      />
    </div>
  )
}


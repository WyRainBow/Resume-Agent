import React, { useState } from 'react'
import { aiTest, generateResume } from '@/services/api'
import type { Resume } from '@/types/resume'

type Props = {
  onResume: (resume: Resume) => void
  onLoadDemo?: () => void
}

export default function ChatPanel({ onResume, onLoadDemo }: Props) {
  const [provider, setProvider] = useState<'zhipu' | 'gemini'>('zhipu')
  const [instruction, setInstruction] = useState('3年后端，Java/Go，投递后端工程师，擅长高并发与微服务')
  const [logs, setLogs] = useState<string>('')
  const [loading, setLoading] = useState(false)

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

  // 仅保留联通测试按钮，先验证 AI 是否可用；生成简历按钮暂时隐藏
  async function handleGenerate() {
    setLoading(true)
    try {
      const r = await generateResume(provider, instruction, 'zh')
      // 完整显示 API 返回结果
      const fullResult = JSON.stringify(r, null, 2)
      setLogs(prev => `${prev}\n[生成成功:${r.provider}]\n完整返回结果:\n${fullResult}`)
      onResume(r.resume)
    } catch (e: any) {
      const errorDetail = e?.response?.data ? JSON.stringify(e.response.data, null, 2) : formatAxiosError(e)
      setLogs(prev => `${prev}\n[生成错误]\n完整错误信息:\n${errorDetail}`)
    } finally {
      setLoading(false)
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
      <div style={{ 
        marginBottom: 'clamp(16px, 3vw, 24px)', 
        fontWeight: 700, 
        fontSize: 'clamp(16px, 2.5vw, 20px)',
        background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        textShadow: '0 2px 10px rgba(167, 139, 250, 0.3)',
        whiteSpace: 'nowrap'
      }}>
        ✨ AI 对话 / 生成区
      </div>

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

      <label style={{ 
        fontSize: 'clamp(12px, 1.5vw, 13px)', 
        color: 'rgba(255, 255, 255, 0.9)', 
        marginBottom: 8,
        fontWeight: 500
      }}>
        一句话说明（岗位/年限/技术栈/亮点）
      </label>
      <textarea
        value={instruction}
        onChange={e => setInstruction(e.target.value)}
        placeholder="例如：4年前端，React/TS/Node，有B端大屏经验，投递前端工程师"
        style={{ 
          width: '100%', 
          height: 'clamp(100px, 15vh, 120px)', 
          padding: 'clamp(12px, 2vw, 16px)', 
          marginBottom: 'clamp(16px, 2.5vw, 20px)',
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: 'clamp(8px, 1.5vw, 12px)',
          color: 'white',
          fontSize: 'clamp(13px, 1.75vw, 14px)',
          resize: 'none',
          outline: 'none',
          transition: 'all 0.3s ease',
          fontFamily: 'inherit'
        }}
        onFocus={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'
          e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(167, 139, 250, 0.2)'
        }}
        onBlur={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      />

      <div style={{ display: 'flex', gap: 'clamp(8px, 1.5vw, 12px)', marginBottom: 'clamp(16px, 2.5vw, 20px)', flexWrap: 'wrap' }}>
        {onLoadDemo && (
          <button
            onClick={onLoadDemo}
            disabled={loading}
            style={{
              flex: '1 1 auto',
              minWidth: '120px',
              padding: 'clamp(12px, 2vw, 14px) clamp(16px, 2.5vw, 20px)',
              fontWeight: 600,
              fontSize: 'clamp(12px, 1.75vw, 14px)',
              background: loading
                ? 'rgba(255, 255, 255, 0.1)'
                : 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              border: 'none',
              borderRadius: 'clamp(8px, 1.5vw, 12px)',
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
              opacity: loading ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(139, 92, 246, 0.6)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(139, 92, 246, 0.4)'
            }}
          >
            {loading ? '加载中...' : '加载 Demo 模板'}
          </button>
        )}
        <button 
          onClick={handleTest} 
          disabled={loading} 
          style={{ 
            flex: '1 1 auto',
            minWidth: '120px',
            padding: 'clamp(12px, 2vw, 14px) clamp(16px, 2.5vw, 20px)', 
            fontWeight: 600,
            fontSize: 'clamp(12px, 1.75vw, 14px)',
            background: loading 
              ? 'rgba(255, 255, 255, 0.1)' 
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '12px',
            color: 'white',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
            opacity: loading ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)'
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)'
            }
          }}
        >
          {loading ? '⏳ 测试中...' : '🔌 AI 联通测试'}
        </button>
        <button 
          onClick={handleGenerate} 
          disabled={loading} 
          style={{ 
            flex: '1 1 auto',
            minWidth: '120px',
            padding: 'clamp(12px, 2vw, 14px) clamp(16px, 2.5vw, 20px)', 
            fontWeight: 600,
            fontSize: 'clamp(12px, 1.75vw, 14px)',
            background: loading 
              ? 'rgba(255, 255, 255, 0.1)' 
              : 'linear-gradient(135deg, #ec4899 0%, #f093fb 100%)',
            border: 'none',
            borderRadius: 'clamp(8px, 1.5vw, 12px)',
            color: 'white',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 15px rgba(236, 72, 153, 0.4)',
            opacity: loading ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(236, 72, 153, 0.6)'
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(236, 72, 153, 0.4)'
            }
          }}
        >
          {loading ? '生成中...' : '生成简历'}
        </button>
      </div>

      <div style={{ 
        fontSize: 'clamp(12px, 1.5vw, 13px)', 
        color: 'rgba(255, 255, 255, 0.9)', 
        marginBottom: 8,
        fontWeight: 500
      }}>
        📋 日志
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


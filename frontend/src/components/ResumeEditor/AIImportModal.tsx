/**
 * AI 导入弹窗组件
 */
import React, { useState, useEffect, useRef } from 'react'
import type { AIImportModalProps } from './types'
import { aiImportPlaceholders } from './constants'

export function AIImportModal({
  isOpen,
  sectionType,
  sectionTitle,
  onClose,
  onSave
}: AIImportModalProps) {
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsedData, setParsedData] = useState<any>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [finalTime, setFinalTime] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  // 计时器逻辑
  useEffect(() => {
    if (parsing) {
      setElapsedTime(0)
      setFinalTime(null)
      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTimeRef.current)
      }, 100)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
      if (startTimeRef.current > 0) {
        setFinalTime(Date.now() - startTimeRef.current)
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [parsing])

  // 重置状态
  useEffect(() => {
    if (!isOpen) {
      setText('')
      setParsedData(null)
      setFinalTime(null)
    }
  }, [isOpen])

  // AI 解析
  const handleParse = async () => {
    if (!text.trim()) return
    setParsing(true)
    setParsedData(null)
    
    try {
      const response = await fetch('/api/resume/parse-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          section_type: sectionType
        })
      })
      
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || '解析失败')
      }
      
      const result = await response.json()
      setParsedData(result.data)
    } catch (err: any) {
      alert('解析失败: ' + err.message)
    } finally {
      setParsing(false)
    }
  }

  // 保存数据
  const handleSave = () => {
    if (parsedData) {
      onSave(parsedData)
      onClose()
    }
  }

  const formatTime = (ms: number) => `${(ms / 1000).toFixed(1)}s`
  const getTimeColor = (ms: number) => {
    if (ms < 2000) return '#10b981'
    if (ms < 5000) return '#f59e0b'
    return '#ef4444'
  }
  
  if (!isOpen) return null
  
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }} onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          borderRadius: '16px',
          padding: '24px',
          width: '90%',
          maxWidth: '500px',
          border: '1px solid rgba(167, 139, 250, 0.3)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: 'white', fontSize: '18px' }}>
            ✨ AI 导入 - {sectionTitle}
          </h3>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '20px',
              cursor: 'pointer',
            }}
          >×</button>
        </div>
        
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', marginBottom: '12px' }}>
          粘贴或输入该模块的文本内容，AI 将自动解析并填充
        </p>
        
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              const placeholder = aiImportPlaceholders[sectionType] || ''
              if (placeholder && (!text || placeholder.startsWith(text))) {
                e.preventDefault()
                setText(placeholder)
              }
            }
          }}
          placeholder={(aiImportPlaceholders[sectionType] || '请输入文本内容...') + '（TAB 补全）'}
          style={{
            width: '100%',
            minHeight: '180px',
            padding: '12px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            color: 'white',
            fontSize: '14px',
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.6)'}
          onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
        />
        
        {/* 解析结果预览 */}
        {parsedData && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '8px',
          }}>
            <div style={{ color: '#10b981', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
              ✅ 解析成功！预览：
            </div>
            <pre style={{
              margin: 0,
              color: 'rgba(255,255,255,0.8)',
              fontSize: '12px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: '150px',
              overflow: 'auto',
            }}>
              {JSON.stringify(parsedData, null, 2)}
            </pre>
          </div>
        )}
        
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              color: 'rgba(255,255,255,0.8)',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          
          {/* 解析按钮 */}
          {!parsedData && (
            <button
              onClick={handleParse}
              disabled={!text.trim() || parsing}
              style={{
                padding: '10px 24px',
                background: parsing ? 'rgba(167, 139, 250, 0.3)' : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                cursor: parsing || !text.trim() ? 'not-allowed' : 'pointer',
                opacity: !text.trim() ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {parsing ? '🔄 解析中...' : '✨ AI 解析'}
              {parsing && (
                <span style={{ fontSize: '12px', color: getTimeColor(elapsedTime), fontWeight: 500, minWidth: '40px' }}>
                  {formatTime(elapsedTime)}
                </span>
              )}
            </button>
          )}
          
          {/* 保存按钮 */}
          {parsedData && (
            <>
              <button
                onClick={() => { setParsedData(null); setFinalTime(null) }}
                style={{
                  padding: '10px 20px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                重新解析
              </button>
              <button
                onClick={handleSave}
                style={{
                  padding: '10px 24px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                保存简历
                {finalTime !== null && (
                  <span style={{ fontSize: '12px', color: getTimeColor(finalTime), fontWeight: 500 }}>
                    {formatTime(finalTime)}
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

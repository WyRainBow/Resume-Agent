/**
 * AI改写对话框组件
 * 选中文字后弹出，支持与AI对话修改内容
 */
import React, { useState, useRef, useEffect } from 'react'

interface Props {
  isOpen: boolean
  selectedText: string
  position: { x: number; y: number }
  onClose: () => void
  onApply: (newText: string) => void
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function AIRewriteDialog({ isOpen, selectedText, position, onClose, onApply }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [rewrittenText, setRewrittenText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 打开时初始化
  useEffect(() => {
    if (isOpen) {
      setMessages([])
      setInput('')
      setRewrittenText('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, selectedText])

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      // 构建提示词
      const systemPrompt = `你是一个专业的简历优化助手。用户选中了简历中的一段文字，希望你帮助改写。

选中的原文：
"${selectedText}"

请根据用户的要求改写这段文字。只返回改写后的文字，不要添加额外的解释。`

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage }
          ]
        })
      })

      if (!response.ok) {
        throw new Error('AI服务请求失败')
      }

      const data = await response.json()
      const aiResponse = data.content || data.message || ''
      
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }])
      setRewrittenText(aiResponse)
    } catch (error) {
      console.error('AI请求失败:', error)
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '抱歉，AI服务暂时不可用，请稍后重试。' 
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* 遮罩层 */}
      <div 
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.3)',
          zIndex: 9998,
        }}
      />
      
      {/* 对话框 */}
      <div style={{
        position: 'fixed',
        left: Math.min(position.x, window.innerWidth - 420),
        top: Math.min(Math.max(position.y, 10), window.innerHeight - 400),
        width: '400px',
        background: '#1e1b4b',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        zIndex: 9999,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.15)',
      }}>
        {/* 标题栏 */}
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>✨</span>
            <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>AI 改写助手</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            ×
          </button>
        </div>

        {/* 原文展示 */}
        <div style={{
          padding: '12px 16px',
          background: 'rgba(0, 0, 0, 0.2)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginBottom: '6px' }}>
            📝 选中的文字
          </div>
          <div style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: '13px',
            lineHeight: 1.5,
            maxHeight: '60px',
            overflow: 'auto',
          }}>
            "{selectedText}"
          </div>
        </div>

        {/* 对话区域 */}
        <div style={{
          overflowY: 'auto',
          padding: '12px 16px',
          minHeight: '120px',
          maxHeight: '180px',
        }}>
          {messages.length === 0 ? (
            <div style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: '13px',
              textAlign: 'center',
              padding: '20px',
            }}>
              💡 告诉我你想如何修改这段文字<br/>
              例如："更加专业"、"突出量化成果"、"简洁一些"
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: '12px',
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.role === 'user' 
                    ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' 
                    : 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  fontSize: '13px',
                  lineHeight: 1.5,
                }}>
                  {msg.content}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div style={{
              display: 'flex',
              justifyContent: 'flex-start',
              marginBottom: '12px',
            }}>
              <div style={{
                padding: '10px 14px',
                borderRadius: '14px 14px 14px 4px',
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'rgba(255,255,255,0.6)',
                fontSize: '13px',
              }}>
                ⏳ 思考中...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(0, 0, 0, 0.2)',
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入修改意图，如：更专业、更简洁..."
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 14px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                color: 'white',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{
                padding: '10px 16px',
                background: loading || !input.trim() 
                  ? 'rgba(255,255,255,0.1)' 
                  : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none',
                borderRadius: '10px',
                color: 'white',
                fontSize: '13px',
                fontWeight: 500,
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              发送
            </button>
          </div>
        </div>

        {/* 应用按钮 */}
        {rewrittenText && (
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            gap: '8px',
          }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                color: 'white',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              取消
            </button>
            <button
              onClick={() => onApply(rewrittenText)}
              style={{
                flex: 1,
                padding: '12px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
                borderRadius: '10px',
                color: 'white',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
              }}
            >
              ✓ 应用修改
            </button>
          </div>
        )}
      </div>
    </>
  )
}

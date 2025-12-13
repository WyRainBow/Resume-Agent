/**
 * AI 输出视图组件
 * 显示 AI 流式生成的 Markdown 简历内容
 * 使用打字机效果逐字显示
 */
import React, { useEffect, useRef, useState } from 'react'
import { TimerDisplay } from '../../../hooks/useTimer'

interface Props {
  content: string  // 后端累积的全部内容
  status: 'idle' | 'streaming' | 'parsing' | 'done' | 'error'
  onUpdatePreview: () => void
  errorMessage?: string
  // 计时器相关
  elapsedTime: number
  finalTime: number | null
  formatTime: (ms: number) => string
  getTimeColor: (ms: number) => string
}

// 打字机效果配置
const CHARS_PER_FRAME = 3  // 每帧显示的字符数，可调节速度

// 简单的 Markdown 渲染函数
function renderMarkdown(text: string): string {
  if (!text) return ''
  
  let html = text
    // 转义 HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // 一级标题
    .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
    // 二级标题
    .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    // 三级标题
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    // 分割线
    .replace(/^---$/gm, '<hr class="md-hr" />')
    // 粗体
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // 斜体
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 无序列表项
    .replace(/^- (.+)$/gm, '<li class="md-li">$1</li>')
    // 换行
    .replace(/\n/g, '<br />')
  
  // 将连续的 li 包装在 ul 中
  html = html.replace(/(<li class="md-li">.*?<\/li>(<br \/>)?)+/g, (match) => {
    return '<ul class="md-ul">' + match.replace(/<br \/>/g, '') + '</ul>'
  })
  
  return html
}

export default function AIOutputView({ 
  content, 
  status, 
  onUpdatePreview, 
  errorMessage,
  elapsedTime,
  finalTime,
  formatTime,
  getTimeColor,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null)
  
  // 打字机效果状态
  const [displayedContent, setDisplayedContent] = useState('')
  const displayedLengthRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)
  
  // 打字机效果：逐字显示内容
  useEffect(() => {
    // 如果有新内容需要显示
    if (content.length > displayedLengthRef.current) {
      const animate = () => {
        if (displayedLengthRef.current < content.length) {
          // 每帧显示若干字符
          const charsToAdd = Math.min(CHARS_PER_FRAME, content.length - displayedLengthRef.current)
          displayedLengthRef.current += charsToAdd
          setDisplayedContent(content.slice(0, displayedLengthRef.current))
          animationFrameRef.current = requestAnimationFrame(animate)
        }
      }
      animationFrameRef.current = requestAnimationFrame(animate)
    }
    
    // 清理函数
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [content])
  
  // 当 status 变为 idle 时重置
  useEffect(() => {
    if (status === 'idle') {
      displayedLengthRef.current = 0
      setDisplayedContent('')
    }
  }, [status])
  
  // 自动滚动到底部
  useEffect(() => {
    if (contentRef.current && (status === 'streaming' || status === 'parsing')) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [displayedContent, status])
  
  const isLoading = status === 'streaming' || status === 'parsing'
  const canUpdatePreview = status === 'done'
  // 是否显示打字光标（正在输入且还有内容待显示）
  const showCursor = isLoading || (displayedLengthRef.current < content.length)
  
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(0, 0, 0, 0.2)',
    }}>
      {/* 顶部状态栏 */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255, 255, 255, 0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>
            {status === 'streaming' ? '✨' : status === 'parsing' ? '⚙️' : status === 'done' ? '✅' : status === 'error' ? '❌' : '📝'}
          </span>
          <span style={{ color: 'white', fontSize: '14px', fontWeight: 500 }}>
            {status === 'idle' && 'AI 输出'}
            {status === 'streaming' && 'AI 正在生成简历...'}
            {status === 'parsing' && '正在解析为结构化数据...'}
            {status === 'done' && '生成完成！'}
            {status === 'error' && '生成失败'}
          </span>
          {/* 计时器显示 */}
          <TimerDisplay
            loading={isLoading}
            elapsedTime={elapsedTime}
            finalTime={finalTime}
            formatTime={formatTime}
            getTimeColor={getTimeColor}
          />
          {isLoading && (
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              borderTopColor: '#a78bfa',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
          )}
        </div>
        
        <button
          onClick={onUpdatePreview}
          disabled={!canUpdatePreview}
          style={{
            padding: '8px 20px',
            background: canUpdatePreview 
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              : 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontSize: '13px',
            fontWeight: 600,
            cursor: canUpdatePreview ? 'pointer' : 'not-allowed',
            opacity: canUpdatePreview ? 1 : 0.5,
            transition: 'all 0.3s ease',
          }}
        >
          更新预览
        </button>
      </div>
      
      {/* 内容区域 */}
      <div 
        ref={contentRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px 32px',
        }}
      >
        {!content && status === 'idle' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'rgba(255, 255, 255, 0.5)',
          }}>
            <span style={{ fontSize: '48px', marginBottom: '16px' }}>📄</span>
            <span>等待 AI 生成简历内容...</span>
          </div>
        )}
        
        {(displayedContent || content) && (
          <div 
            className="markdown-content"
            style={{
              color: 'white',
              lineHeight: 1.8,
              fontSize: '14px',
            }}
          >
            <span dangerouslySetInnerHTML={{ __html: renderMarkdown(displayedContent) }} />
            {/* 打字机光标 */}
            {showCursor && <span className="typing-cursor" />}
          </div>
        )}
        
        {status === 'error' && (
          <div style={{
            marginTop: '16px',
            padding: '16px',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#fca5a5',
          }}>
            {errorMessage || '生成过程中出现错误，请重试'}
          </div>
        )}
      </div>
      
      {/* 样式 */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        
        .typing-cursor {
          display: inline-block;
          width: 2px;
          height: 1.1em;
          background: #a78bfa;
          margin-left: 2px;
          vertical-align: text-bottom;
          animation: blink 0.8s infinite;
        }
        
        .markdown-content .md-h1 {
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 16px 0;
          color: #f0abfc;
        }
        
        .markdown-content .md-h2 {
          font-size: 18px;
          font-weight: 600;
          margin: 24px 0 12px 0;
          color: #c4b5fd;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 8px;
        }
        
        .markdown-content .md-h3 {
          font-size: 15px;
          font-weight: 600;
          margin: 16px 0 8px 0;
          color: white;
        }
        
        .markdown-content .md-hr {
          border: none;
          border-top: 1px solid rgba(255, 255, 255, 0.15);
          margin: 20px 0;
        }
        
        .markdown-content .md-ul {
          margin: 8px 0;
          padding-left: 24px;
          list-style: none;
        }
        
        .markdown-content .md-li {
          position: relative;
          margin: 6px 0;
          color: rgba(255, 255, 255, 0.9);
        }
        
        .markdown-content .md-li::before {
          content: '•';
          position: absolute;
          left: -16px;
          color: #a78bfa;
        }
        
        .markdown-content strong {
          color: #fbbf24;
        }
        
        .markdown-content em {
          color: rgba(255, 255, 255, 0.7);
          font-style: italic;
        }
      `}</style>
    </div>
  )
}

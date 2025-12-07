import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LandingPage() {
  const navigate = useNavigate()
  const [instruction, setInstruction] = useState('')
  const [isHovering, setIsHovering] = useState(false)

  const handleGenerate = () => {
    if (!instruction.trim()) return
    // 将指令存储到 sessionStorage，功能页会读取并自动生成
    sessionStorage.setItem('resume_instruction', instruction)
    navigate('/workspace')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleGenerate()
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* 背景装饰 */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.1) 0%, transparent 50%)',
        pointerEvents: 'none'
      }} />
      
      {/* 导航栏 */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        padding: '20px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 100
      }}>
        <div style={{
          fontSize: '24px',
          fontWeight: 700,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '28px' }}>😄</span>
          Resume Agent
        </div>
        <button
          onClick={() => navigate('/workspace')}
          style={{
            padding: '10px 24px',
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '12px',
            color: 'white',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.25)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.15)'
          }}
        >
          进入工作区 →
        </button>
      </nav>

      {/* 主内容区 */}
      <div style={{
        maxWidth: '800px',
        width: '100%',
        textAlign: 'center',
        zIndex: 1
      }}>
        {/* 标题 */}
        <h1 style={{
          fontSize: 'clamp(36px, 6vw, 64px)',
          fontWeight: 800,
          color: 'white',
          marginBottom: '16px',
          lineHeight: 1.2,
          textShadow: '0 4px 20px rgba(0,0,0,0.2)'
        }}>
          The <span style={{ 
            background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>Pro Agent</span> for Resume
        </h1>

        {/* 副标题 */}
        <p style={{
          fontSize: 'clamp(16px, 2.5vw, 20px)',
          color: 'rgba(255,255,255,0.9)',
          marginBottom: '48px',
          lineHeight: 1.6
        }}>
          一句话描述。AI 自动生成专业简历 PDF
        </p>

        {/* 输入区域 */}
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          borderRadius: '24px',
          padding: '8px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          transition: 'all 0.3s ease',
          transform: isHovering ? 'translateY(-4px)' : 'translateY(0)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 16px'
          }}>
            <span style={{ fontSize: '20px', color: '#667eea' }}>✨</span>
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsHovering(true)}
              onBlur={() => setIsHovering(false)}
              placeholder="3年后端、Java/Go、投递后端工程师、擅长高并发与微服务"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: '16px',
                color: '#1a1a2e',
                background: 'transparent',
                padding: '12px 0'
              }}
            />
            <button
              onClick={handleGenerate}
              disabled={!instruction.trim()}
              style={{
                padding: '14px 32px',
                background: instruction.trim() 
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : '#e0e0e0',
                border: 'none',
                borderRadius: '16px',
                color: 'white',
                fontSize: '15px',
                fontWeight: 600,
                cursor: instruction.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s ease',
                boxShadow: instruction.trim() 
                  ? '0 4px 15px rgba(102, 126, 234, 0.4)'
                  : 'none',
                whiteSpace: 'nowrap'
              }}
            >
              生成简历 →
            </button>
          </div>
        </div>

        {/* 提示文字 */}
        <p style={{
          marginTop: '24px',
          fontSize: '14px',
          color: 'rgba(255,255,255,0.7)'
        }}>
          输入你的岗位、年限、技术栈、亮点等。AI 将为你生成专业简历
        </p>

        {/* 特性展示 */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '32px',
          marginTop: '64px',
          flexWrap: 'wrap'
        }}>
          {[
            { icon: '⚡', title: '快速生成', desc: '一句话描述。秒级生成' },
            { icon: '🎨', title: '专业排版', desc: 'LaTeX 精美模板' },
            { icon: '📥', title: '一键下载', desc: '直接导出 PDF' }
          ].map((item, index) => (
            <div key={index} style={{
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              padding: '24px 32px',
              minWidth: '160px',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>{item.icon}</div>
              <div style={{ 
                color: 'white', 
                fontWeight: 600, 
                fontSize: '16px',
                marginBottom: '4px'
              }}>{item.title}</div>
              <div style={{ 
                color: 'rgba(255,255,255,0.7)', 
                fontSize: '13px' 
              }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 底部 */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        color: 'rgba(255,255,255,0.5)',
        fontSize: '13px'
      }}>
        Powered by AI · LaTeX · React
      </div>
    </div>
  )
}

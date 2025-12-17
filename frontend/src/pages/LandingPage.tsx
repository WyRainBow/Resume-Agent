import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LandingPage() {
  const navigate = useNavigate()
  const [instruction, setInstruction] = useState('')
  const [isHovering, setIsHovering] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  const placeholderText = '3年后端、Java/Go、投递后端工程师、擅长高并发与微服务（TAB 补全）'

  useEffect(() => {
    setIsVisible(true)
  }, [])

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
    // Tab 键补全 placeholder
    if (e.key === 'Tab') {
      e.preventDefault()
      // 如果输入框为空，或者当前输入是 placeholder 的前缀，则补全
      if (!instruction || placeholderText.startsWith(instruction)) {
        setInstruction(placeholderText)
      }
    }
  }

  return (
    <div className="landing-container">
      {/* 动态背景粒子 */}
      <div className="bg-particles">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 20}s`,
              animationDuration: `${15 + Math.random() * 10}s`
            }}
          />
        ))}
      </div>

      {/* 光晕效果 */}
      <div className="glow-effect glow-1" />
      <div className="glow-effect glow-2" />
      <div className="glow-effect glow-3" />

      {/* 导航栏 */}
      <nav className={`navbar ${isVisible ? 'nav-visible' : ''}`}>
        <div className="nav-brand">
          <div className="brand-logo">
            <div className="logo-inner" />
          </div>
          <span className="brand-text">Resume Agent</span>
        </div>
        <button
          onClick={() => navigate('/workspace')}
          className="nav-button"
        >
          <span>进入工作区</span>
          <svg className="button-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M1 8H15M15 8L8 1M15 8L8 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </nav>

      {/* 主内容区 */}
      <div className="main-content">
        {/* 左侧标题区域 */}
        <div className={`title-section ${isVisible ? 'title-visible' : ''}`}>
          <div className="subtitle-badge">
            <span className="badge-dot" />
            <span>AI 驱动的专业简历生成器</span>
          </div>

          <h1 className="main-title">
            The <span className="highlight">Pro Agent</span> for Resume
          </h1>

          <p className="description">
            一句话描述您的职业背景、AI 即刻为您生成专业精美的简历 PDF
          </p>

          {/* 统计数据 */}
          <div className="stats-row">
            <div className="stat-item">
              <span className="stat-number">10K+</span>
              <span className="stat-label">简历已生成</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-number">95%</span>
              <span className="stat-label">用户满意度</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-number">&lt;1min</span>
              <span className="stat-label">生成时间</span>
            </div>
          </div>
        </div>

        {/* 右侧输入区域 */}
        <div className={`input-section ${isVisible ? 'input-visible' : ''}`}>
          <div className={`input-card ${isHovering ? 'card-hovered' : ''}`}>
            <div className="input-header">
              <span className="input-icon">✨</span>
              <span className="input-label">开始创建您的简历</span>
            </div>

            <div className="input-wrapper">
              <input
                type="text"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsHovering(true)}
                onBlur={() => setIsHovering(false)}
                placeholder={placeholderText}
                className="text-input"
              />
              <div className={`input-glow ${instruction.trim() ? 'glow-active' : ''}`} />
            </div>

            <button
              onClick={handleGenerate}
              disabled={!instruction.trim()}
              className={`generate-button ${instruction.trim() ? 'button-active' : 'button-inactive'}`}
            >
              <span className="button-text">生成简历</span>
              <div className="button-ripple" />
            </button>

            <div className="input-hints">
              <span className="hint-item">💡 按 TAB 键快速填充示例</span>
              <span className="hint-item">⌘ Enter 立即生成</span>
            </div>
          </div>

          {/* 浮动功能卡片 */}
          <div className="feature-cards">
            <div className="feature-card card-1">
              <div className="card-icon">⚡</div>
              <div className="card-content">
                <h3>闪电生成</h3>
                <p>秒级响应、即刻获得</p>
              </div>
            </div>
            <div className="feature-card card-2">
              <div className="card-icon">🎨</div>
              <div className="card-content">
                <h3>专业设计</h3>
                <p>LaTeX 精美排版</p>
              </div>
            </div>
            <div className="feature-card card-3">
              <div className="card-icon">📥</div>
              <div className="card-content">
                <h3>即用即下</h3>
                <p>PDF 格式直接导出</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 底部信息 */}
      <div className="footer">
        <div className="footer-divider" />
        <span className="footer-text">
          Powered by Advanced AI · LaTeX Engine · Modern React
        </span>
      </div>

      <style>{`
        .landing-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          position: relative;
          overflow: hidden;
        }

        /* 背景粒子动画 */
        .bg-particles {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: hidden;
        }

        .particle {
          position: absolute;
          width: 4px;
          height: 4px;
          background: rgba(255, 255, 255, 0.5);
          border-radius: 50%;
          animation: float linear infinite;
        }

        @keyframes float {
          from {
            transform: translateY(100vh) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          to {
            transform: translateY(-100vh) rotate(720deg);
            opacity: 0;
          }
        }

        /* 光晕效果 */
        .glow-effect {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          pointer-events: none;
          opacity: 0.3;
        }

        .glow-1 {
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
          top: -200px;
          right: -200px;
          animation: glow-pulse 8s ease-in-out infinite;
        }

        .glow-2 {
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(255, 236, 210, 0.3) 0%, transparent 70%);
          bottom: -100px;
          left: -100px;
          animation: glow-pulse 8s ease-in-out infinite 2s;
        }

        .glow-3 {
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(252, 182, 159, 0.3) 0%, transparent 70%);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: glow-pulse 8s ease-in-out infinite 4s;
        }

        @keyframes glow-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }

        /* 导航栏 */
        .navbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          padding: 20px 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 100;
          opacity: 0;
          transform: translateY(-20px);
          transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .nav-visible {
          opacity: 1;
          transform: translateY(0);
        }

        .nav-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-logo {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
          border-radius: 12px;
          position: relative;
          overflow: hidden;
        }

        .logo-inner {
          position: absolute;
          inset: 3px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 9px;
        }

        .brand-text {
          font-size: 22px;
          font-weight: 700;
          color: white;
          letter-spacing: -0.5px;
        }

        .nav-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 12px;
          color: white;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .nav-button:hover {
          background: rgba(255, 255, 255, 0.25);
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        }

        .button-arrow {
          transition: transform 0.3s ease;
        }

        .nav-button:hover .button-arrow {
          transform: translateX(4px);
        }

        /* 主内容区 */
        .main-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 80px;
          max-width: 1200px;
          width: 100%;
          margin-top: 80px;
          position: relative;
          z-index: 1;
        }

        /* 标题区域 */
        .title-section {
          opacity: 0;
          transform: translateX(-50px);
          transition: all 1s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .title-visible {
          opacity: 1;
          transform: translateX(0);
        }

        .subtitle-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 100px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 13px;
          margin-bottom: 24px;
        }

        .badge-dot {
          width: 6px;
          height: 6px;
          background: #4ade80;
          border-radius: 50%;
          animation: pulse-dot 2s ease-in-out infinite;
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.5); }
        }

        .main-title {
          font-size: clamp(40px, 6vw, 64px);
          font-weight: 800;
          color: white;
          line-height: 1.1;
          margin-bottom: 24px;
          letter-spacing: -1px;
        }

        .highlight {
          background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .description {
          font-size: 18px;
          color: rgba(255, 255, 255, 0.85);
          line-height: 1.6;
          margin-bottom: 40px;
        }

        .stats-row {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .stat-item {
          text-align: center;
        }

        .stat-number {
          display: block;
          font-size: 24px;
          font-weight: 700;
          color: white;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
        }

        .stat-divider {
          width: 1px;
          height: 40px;
          background: rgba(255, 255, 255, 0.2);
        }

        /* 输入区域 */
        .input-section {
          position: relative;
          opacity: 0;
          transform: translateX(50px);
          transition: all 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s;
        }

        .input-visible {
          opacity: 1;
          transform: translateX(0);
        }

        .input-card {
          background: rgba(255, 255, 255, 0.95);
          border-radius: 24px;
          padding: 32px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .card-hovered {
          transform: translateY(-8px);
          box-shadow: 0 35px 60px -12px rgba(0, 0, 0, 0.35);
        }

        .input-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .input-icon {
          font-size: 24px;
        }

        .input-label {
          font-size: 18px;
          font-weight: 600;
          color: #1a1a2e;
        }

        .input-wrapper {
          position: relative;
          margin-bottom: 24px;
        }

        .text-input {
          width: 100%;
          box-sizing: border-box;
          padding: 16px 20px;
          background: #f8fafc;
          border: 2px solid #e2e8f0;
          border-radius: 16px;
          font-size: 14px;
          color: #1a1a2e;
          outline: none;
          transition: all 0.3s ease;
        }

        .text-input:focus {
          background: white;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .text-input::placeholder {
          color: #94a3b8;
        }

        .input-glow {
          position: absolute;
          inset: -2px;
          border-radius: 16px;
          background: linear-gradient(135deg, #667eea, #764ba2, #f093fb);
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: -1;
        }

        .glow-active {
          opacity: 1;
        }

        .generate-button {
          width: 100%;
          padding: 16px 32px;
          border: none;
          border-radius: 16px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
        }

        .button-active {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
        }

        .button-active:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 35px rgba(102, 126, 234, 0.5);
        }

        .button-inactive {
          background: #e2e8f0;
          color: #94a3b8;
          cursor: not-allowed;
        }

        .button-ripple {
          position: absolute;
          inset: 0;
          background: linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.2) 50%, transparent 70%);
          transform: translateX(-100%);
          transition: transform 0.6s;
        }

        .button-active:hover .button-ripple {
          transform: translateX(100%);
        }

        .input-hints {
          display: flex;
          justify-content: space-between;
          margin-top: 16px;
        }

        .hint-item {
          font-size: 12px;
          color: #64748b;
        }

        /* 功能卡片 */
        .feature-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-top: 32px;
        }

        .feature-card {
          background: rgba(255, 255, 255, 0.9);
          border-radius: 16px;
          padding: 20px;
          text-align: center;
          transition: all 0.3s ease;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .feature-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2);
        }

        .card-icon {
          font-size: 32px;
          margin-bottom: 12px;
        }

        .card-content h3 {
          font-size: 14px;
          font-weight: 600;
          color: #1a1a2e;
          margin-bottom: 4px;
        }

        .card-content p {
          font-size: 12px;
          color: #64748b;
        }

        .card-1:hover {
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
        }

        .card-2:hover {
          background: linear-gradient(135deg, rgba(240, 147, 251, 0.1), rgba(245, 87, 108, 0.1));
        }

        .card-3:hover {
          background: linear-gradient(135deg, rgba(79, 172, 254, 0.1), rgba(0, 242, 254, 0.1));
        }

        /* 底部 */
        .footer {
          position: absolute;
          bottom: 40px;
          text-align: center;
        }

        .footer-divider {
          width: 60px;
          height: 1px;
          background: rgba(255, 255, 255, 0.3);
          margin: 0 auto 16px;
        }

        .footer-text {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        /* 响应式设计 */
        @media (max-width: 1024px) {
          .main-content {
            grid-template-columns: 1fr;
            gap: 60px;
            padding-top: 60px;
          }

          .stats-row {
            justify-content: center;
          }

          .feature-cards {
            grid-template-columns: 1fr;
            gap: 12px;
          }
        }

        @media (max-width: 640px) {
          .navbar {
            padding: 16px 24px;
          }

          .brand-text {
            font-size: 18px;
          }

          .main-title {
            font-size: 36px;
          }

          .input-card {
            padding: 24px;
          }

          .stats-row {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
import { useState } from 'react'
import type { Resume } from '../types/resume'

interface Props {
  isOpen: boolean
  onClose: () => void
  onImport: (resume: Resume) => void
}

export default function AIImportDialog({ isOpen, onClose, onImport }: Props) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleImport = async () => {
    if (!text.trim()) {
      setError('请输入简历内容')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/resume/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() })
      })

      if (!response.ok) {
        throw new Error('解析失败')
      }

      const data = await response.json()
      onImport(data.resume)
      setText('')
      onClose()
    } catch (err) {
      setError('AI 解析失败，请检查内容格式或稍后重试')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '600px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* 标题栏 */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: 600 }}>
              ✨ AI 智能导入
            </h2>
            <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
              粘贴简历文本，AI 自动解析并生成结构化数据
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* 内容区 */}
        <div style={{ flex: 1, padding: '20px 24px', overflow: 'auto' }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`请粘贴您的简历内容，例如：

姓名：张三
电话：13800138000
邮箱：zhangsan@example.com
求职意向：后端开发工程师

教育经历：
XX大学 - 计算机科学与技术 - 本科 - 2020.09-2024.06

工作/实习经历：
XX公司 - 后端开发实习生 - 2023.06-2023.09
- 参与项目开发
- 完成xxx功能

项目经历：
XX项目 - 核心开发 - 2023.01-2023.06
- 项目描述...
- 技术实现...

专业技能：
- 编程语言：Java, Python, Go
- 数据库：MySQL, Redis`}
            style={{
              width: '100%',
              height: '300px',
              padding: '16px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              color: 'white',
              fontSize: '14px',
              lineHeight: 1.6,
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(102, 126, 234, 0.6)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)'
            }}
          />

          {error && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px 14px',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                color: '#fca5a5',
                fontSize: '13px',
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <div
            style={{
              marginTop: '16px',
              padding: '12px 16px',
              background: 'rgba(102, 126, 234, 0.1)',
              borderRadius: '8px',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '12px',
              lineHeight: 1.6,
            }}
          >
            💡 <strong>提示：</strong>支持各种格式的简历文本，AI 会自动识别并提取以下信息：
            <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
              <li>基本信息（姓名、联系方式、求职意向）</li>
              <li>教育经历</li>
              <li>工作/实习经历</li>
              <li>项目经历</li>
              <li>专业技能</li>
              <li>荣誉奖项</li>
            </ul>
          </div>
        </div>

        {/* 底部按钮 */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={loading || !text.trim()}
            style={{
              padding: '10px 24px',
              background: loading
                ? 'rgba(102, 126, 234, 0.5)'
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading || !text.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {loading ? (
              <>
                <span
                  style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                AI 解析中...
              </>
            ) : (
              <>✨ 开始解析</>
            )}
          </button>
        </div>

        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
}

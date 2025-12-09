import { useState, useEffect, useRef } from 'react'
import type { Resume } from '../types/resume'

interface Props {
  isOpen: boolean
  onClose: () => void
  onImport: (resume: Resume, saveToList: boolean, originalText: string) => void  // 增加原始文本参数
}

export default function AIImportDialog({ isOpen, onClose, onImport }: Props) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [elapsedTime, setElapsedTime] = useState(0) // 已用时间（毫秒）
  const [finalTime, setFinalTime] = useState<number | null>(null) // 最终耗时
  const [parsedResume, setParsedResume] = useState<Resume | null>(null) // 解析结果
  const [showConfirm, setShowConfirm] = useState(false) // 显示确认弹窗
  const [provider, setProvider] = useState<'gemini' | 'zhipu'>('gemini') // 当前选择的提供商
  const [aiConfig, setAiConfig] = useState<{
    defaultProvider: string
    models: Record<string, string>
  } | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  // 获取 AI 配置
  useEffect(() => {
    fetch('/api/ai/config')
      .then(res => res.json())
      .then(data => {
        setAiConfig(data)
        setProvider(data.defaultProvider as 'gemini' | 'zhipu')
      })
      .catch(() => {})
  }, [])

  // 获取当前模型显示名称
  const getModelDisplayName = (p: string) => {
    const modelName = aiConfig?.models?.[p] || ''
    return modelName
      .replace('gemini-', 'Gemini ')
      .replace('glm-', 'GLM ')
      .replace('-', ' ')
  }

  // 清理计时器
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  // 开始计时
  const startTimer = () => {
    setElapsedTime(0)
    setFinalTime(null)
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setElapsedTime(Date.now() - startTimeRef.current)
    }, 100) // 每100ms更新一次
  }

  // 停止计时
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const final = Date.now() - startTimeRef.current
    setFinalTime(final)
    setElapsedTime(final)
  }

  const handleImport = async () => {
    if (!text.trim()) {
      setError('请输入简历内容')
      return
    }

    setLoading(true)
    setError('')
    startTimer()

    try {
      const response = await fetch('/api/resume/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), provider })
      })

      stopTimer()

      if (!response.ok) {
        throw new Error('解析失败')
      }

      const data = await response.json()
      
      // Agent 快速修正：自动修正明显错误
      try {
        const fixResponse = await fetch('/api/agent/quick-fix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            original_text: text.trim(), 
            current_json: data.resume 
          })
        })
        if (fixResponse.ok) {
          const fixData = await fixResponse.json()
          setParsedResume(fixData.fixed_json)
        } else {
          setParsedResume(data.resume)
        }
      } catch {
        setParsedResume(data.resume)
      }
      
      setShowConfirm(true) // 显示确认弹窗
    } catch (err) {
      stopTimer()
      setError('AI 解析失败，请检查内容格式或稍后重试')
    } finally {
      setLoading(false)
    }
  }

  // 格式化时间显示
  const formatTime = (ms: number) => {
    const seconds = (ms / 1000).toFixed(1)
    return `${seconds}s`
  }

  // 处理确认导入
  const handleConfirmImport = (saveToList: boolean) => {
    if (parsedResume) {
      onImport(parsedResume, saveToList, text.trim())  // 传递原始文本
      setText('')
      setParsedResume(null)
      setShowConfirm(false)
      setFinalTime(null)
      onClose()
    }
  }

  // 取消导入
  const handleCancelConfirm = () => {
    setShowConfirm(false)
    setParsedResume(null)
  }

  if (!isOpen) return null

  // 显示确认弹窗
  if (showConfirm && parsedResume) {
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
      >
        <div
          style={{
            width: '450px',
            maxWidth: '90vw',
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
            borderRadius: '16px',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
          }}
        >
          {/* 标题 */}
          <div style={{ padding: '24px 24px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <h2 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: 600 }}>
              解析成功！
            </h2>
            <div style={{
              marginTop: '8px',
              padding: '4px 10px',
              background: 'rgba(102, 126, 234, 0.2)',
              borderRadius: '4px',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '11px',
            }}>
              🤖 {getModelDisplayName(provider)}
            </div>
            <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
              已识别到简历信息：{parsedResume.name || '未知'}
            </p>
            {finalTime !== null && (
              <div style={{
                marginTop: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: finalTime < 5000 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                borderRadius: '6px',
                color: finalTime < 5000 ? '#86efac' : '#fcd34d',
                fontSize: '13px',
                fontFamily: 'monospace',
              }}>
                <span>⏱️</span>
                <span>耗时 {formatTime(finalTime)}</span>
              </div>
            )}
          </div>

          {/* 选项按钮 */}
          <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => handleConfirmImport(true)}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '10px',
                color: 'white',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              💾 保存到我的简历
            </button>
            <button
              onClick={() => handleConfirmImport(false)}
              style={{
                width: '100%',
                padding: '14px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                color: 'white',
                fontSize: '15px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              📝 仅预览编辑（不保存）
            </button>
            <button
              onClick={handleCancelConfirm}
              style={{
                width: '100%',
                padding: '12px',
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              取消
            </button>
          </div>
        </div>
      </div>
    )
  }

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span>🤖 AI 模型：</span>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as 'gemini' | 'zhipu')}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(102, 126, 234, 0.3)',
                  border: '1px solid rgba(102, 126, 234, 0.5)',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '12px',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="gemini" style={{ background: '#1e1b4b' }}>
                  Gemini 2.5 Pro
                </option>
                <option value="zhipu" style={{ background: '#1e1b4b' }}>
                  智谱 GLM-4-Flash
                </option>
              </select>
            </div>
            支持各种格式的简历文本，AI 会自动识别并提取以下信息：
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
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {/* 计时器显示 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {(loading || finalTime !== null) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  background: loading 
                    ? 'rgba(102, 126, 234, 0.2)' 
                    : finalTime && finalTime < 5000 
                      ? 'rgba(34, 197, 94, 0.2)' 
                      : 'rgba(251, 191, 36, 0.2)',
                  borderRadius: '8px',
                  color: loading 
                    ? '#a5b4fc' 
                    : finalTime && finalTime < 5000 
                      ? '#86efac' 
                      : '#fcd34d',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: 'monospace',
                }}
              >
                <span style={{ fontSize: '16px' }}>
                  {loading ? '⏱️' : finalTime && finalTime < 5000 ? '⚡' : '✅'}
                </span>
                <span>{formatTime(elapsedTime)}</span>
                {!loading && finalTime !== null && (
                  <span style={{ 
                    fontSize: '11px', 
                    opacity: 0.8,
                    fontWeight: 400,
                    marginLeft: '4px'
                  }}>
                    {finalTime < 3000 ? '极速' : finalTime < 5000 ? '较快' : '正常'}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 按钮组 */}
          <div style={{ display: 'flex', gap: '12px' }}>
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

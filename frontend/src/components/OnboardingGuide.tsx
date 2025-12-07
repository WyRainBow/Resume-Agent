import React, { useState, useEffect } from 'react'
import { getKeysStatus, saveKeys, aiTest } from '@/services/api'

type Props = {
  onClose: () => void
  visible: boolean
  onLoadDemo?: () => void
  pdfBlob?: Blob | null
}

export default function OnboardingGuide({ onClose, visible, onLoadDemo, pdfBlob }: Props) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  
  /**
   * 第一步：配置 Key
   */
  const [zhipuKey, setZhipuKey] = useState('')
  const [geminiKey, setGeminiKey] = useState('')
  const [keysConfigured, setKeysConfigured] = useState({ zhipu: false, gemini: false })
  const [savingKeys, setSavingKeys] = useState(false)
  const [keyError, setKeyError] = useState('')
  const [keySuccess, setKeySuccess] = useState('')
  
  /**
   * 第二步：测试 AI
   */
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null)
  const [testMessage, setTestMessage] = useState('')
  
  /**
   * 第三步：加载 Demo
   */
  const [demoLoaded, setDemoLoaded] = useState(false)
  const [loadingDemo, setLoadingDemo] = useState(false)

  /**
   * 初始化：获取当前 Key 配置状态
   */
  useEffect(() => {
    if (visible) {
      setCurrentStep(0)
      setTestResult(null)
      setDemoLoaded(false)
      loadKeysStatus()
    }
  }, [visible])

  /**
   * 监听 pdfBlob 变化，判断 Demo 是否加载成功
   */
  useEffect(() => {
    if (pdfBlob && loadingDemo) {
      setDemoLoaded(true)
      setLoadingDemo(false)
    }
  }, [pdfBlob, loadingDemo])

  async function loadKeysStatus() {
    try {
      const status = await getKeysStatus()
      const configured = {
        zhipu: status.zhipu.configured,
        gemini: status.gemini.configured
      }
      setKeysConfigured(configured)
      
      // 如果本地已配置 Key，自动跳过第一步
      if (configured.zhipu || configured.gemini) {
        setKeySuccess('✅ 检测到本地已配置 API Key，可直接继续')
      }
    } catch (e) {
      console.error('Failed to load keys status:', e)
    }
  }

  /**
   * 保存 API Key
   */
  async function handleSaveKeys() {
    if (!zhipuKey && !geminiKey) {
      setKeyError('请至少输入一个 API Key')
      return
    }
    
    setSavingKeys(true)
    setKeyError('')
    setKeySuccess('')
    
    try {
      await saveKeys(zhipuKey || undefined, geminiKey || undefined)
      setKeySuccess('✅ API Key 保存成功！')
      await loadKeysStatus()
      setZhipuKey('')
      setGeminiKey('')
    } catch (e: any) {
      setKeyError(e?.response?.data?.detail || '保存失败')
    } finally {
      setSavingKeys(false)
    }
  }

  /**
   * 测试 AI 连接
   */
  async function handleTestAI() {
    setTesting(true)
    setTestResult(null)
    setTestMessage('')
    
    try {
      const provider = keysConfigured.zhipu ? 'zhipu' : 'gemini'
      const result = await aiTest(provider, '你好简要介绍一下你自己（10字以内）')
      setTestResult('success')
      setTestMessage(`✅ ${result.provider} 连接成功：${result.result}`)
    } catch (e: any) {
      setTestResult('fail')
      setTestMessage(`❌ 测试失败：${e?.response?.data?.detail || e?.message || '未知错误'}`)
    } finally {
      setTesting(false)
    }
  }

  /**
   * 加载 Demo
   */
  function handleLoadDemo() {
    if (onLoadDemo) {
      setLoadingDemo(true)
      onLoadDemo()
    }
  }

  /**
   * 下载 PDF
   */
  function handleDownloadPDF() {
    if (pdfBlob) {
      const url = URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'resume.pdf'
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  if (!visible) return null

  const handleClose = () => {
    localStorage.setItem('onboarding_completed', 'true')
    onClose()
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0: return keysConfigured.zhipu || keysConfigured.gemini
      case 1: return testResult === 'success'
      case 2: return demoLoaded
      case 3: return true
      default: return false
    }
  }

  const handleNext = () => {
    if (currentStep === 3) {
      handleClose()
    } else if (canProceed()) {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentStep(prev => prev + 1)
        setIsAnimating(false)
      }, 200)
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentStep(prev => prev - 1)
        setIsAnimating(false)
      }, 200)
    }
  }

  /**
   * 渲染每一步的内容
   */
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div>
            <p style={{ color: 'rgba(255,255,255,0.9)', marginBottom: 16, lineHeight: 1.6 }}>
              请输入你的 AI API Key：至少配置一个即可：
            </p>
            
            {/* 当前状态 */}
            <div style={{ 
              background: 'rgba(255,255,255,0.1)', 
              borderRadius: 8, 
              padding: 12, 
              marginBottom: 16,
              fontSize: 13
            }}>
              <div style={{ color: keysConfigured.zhipu ? '#10b981' : 'rgba(255,255,255,0.5)' }}>
                智谱 AI：{keysConfigured.zhipu ? '✅ 已配置' : '❌ 未配置'}
              </div>
              <div style={{ color: keysConfigured.gemini ? '#10b981' : 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                Gemini：{keysConfigured.gemini ? '✅ 已配置' : '❌ 未配置'}
              </div>
            </div>

            {/* 输入框 */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', display: 'block', marginBottom: 6 }}>
                智谱 AI API Key
              </label>
              <input
                type="password"
                value={zhipuKey}
                onChange={e => setZhipuKey(e.target.value)}
                placeholder="输入智谱 API Key..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  color: 'white',
                  fontSize: 14,
                  outline: 'none'
                }}
              />
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', display: 'block', marginBottom: 6 }}>
                Gemini API Key
              </label>
              <input
                type="password"
                value={geminiKey}
                onChange={e => setGeminiKey(e.target.value)}
                placeholder="输入 Gemini API Key..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  color: 'white',
                  fontSize: 14,
                  outline: 'none'
                }}
              />
            </div>

            {/* 错误/成功提示 */}
            {keyError && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{keyError}</div>}
            {keySuccess && <div style={{ color: '#10b981', fontSize: 13, marginBottom: 12 }}>{keySuccess}</div>}

            {/* 保存按钮 */}
            <button
              onClick={handleSaveKeys}
              disabled={savingKeys || (!zhipuKey && !geminiKey)}
              style={{
                width: '100%',
                padding: '12px',
                background: savingKeys || (!zhipuKey && !geminiKey)
                  ? 'rgba(255,255,255,0.1)'
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: 10,
                color: 'white',
                fontSize: 14,
                fontWeight: 600,
                cursor: savingKeys || (!zhipuKey && !geminiKey) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {savingKeys ? '保存中...' : '💾 保存 API Key'}
            </button>
          </div>
        )
      
      case 1:
        return (
          <div>
            <p style={{ color: 'rgba(255,255,255,0.9)', marginBottom: 16, lineHeight: 1.6 }}>
              点击下方按钮测试 AI 连接是否正常：
            </p>
            
            {/* 测试按钮 */}
            <button
              onClick={handleTestAI}
              disabled={testing || (!keysConfigured.zhipu && !keysConfigured.gemini)}
              style={{
                width: '100%',
                padding: '14px',
                background: testing
                  ? 'rgba(255,255,255,0.1)'
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: 10,
                color: 'white',
                fontSize: 15,
                fontWeight: 600,
                cursor: testing ? 'not-allowed' : 'pointer',
                marginBottom: 16,
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                transition: 'all 0.2s ease'
              }}
            >
              {testing ? '🔄 测试中...' : '🔗 AI 联通测试'}
            </button>

            {/* 测试结果 */}
            {testMessage && (
              <div style={{
                padding: 12,
                borderRadius: 8,
                background: testResult === 'success' 
                  ? 'rgba(16, 185, 129, 0.2)' 
                  : 'rgba(239, 68, 68, 0.2)',
                border: `1px solid ${testResult === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                fontSize: 13,
                color: testResult === 'success' ? '#10b981' : '#ef4444',
                lineHeight: 1.5
              }}>
                {testMessage}
              </div>
            )}

            {testResult === 'fail' && (
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 12 }}>
                💡 测试失败？请返回上一步检查 API Key 是否正确
              </p>
            )}
          </div>
        )
      
      case 2:
        return (
          <div>
            <p style={{ color: 'rgba(255,255,255,0.9)', marginBottom: 16, lineHeight: 1.6 }}>
              点击下方按钮加载一份示例简历。右侧将显示 PDF 预览：
            </p>
            
            <button
              onClick={handleLoadDemo}
              disabled={loadingDemo}
              style={{
                width: '100%',
                padding: '14px',
                background: loadingDemo
                  ? 'rgba(255,255,255,0.1)'
                  : 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                border: 'none',
                borderRadius: 10,
                color: 'white',
                fontSize: 15,
                fontWeight: 600,
                cursor: loadingDemo ? 'not-allowed' : 'pointer',
                marginBottom: 16,
                boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
                transition: 'all 0.2s ease'
              }}
            >
              {loadingDemo ? '🔄 加载中...' : '📄 加载 Demo 模板'}
            </button>

            {demoLoaded && (
              <div style={{
                padding: 12,
                borderRadius: 8,
                background: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                fontSize: 13,
                color: '#10b981'
              }}>
                ✅ Demo 加载成功！请查看右侧 PDF 预览
              </div>
            )}
          </div>
        )
      
      case 3:
        return (
          <div>
            <p style={{ color: 'rgba(255,255,255,0.9)', marginBottom: 16, lineHeight: 1.6 }}>
              点击下方按钮下载生成的简历 PDF：
            </p>
            
            <button
              onClick={handleDownloadPDF}
              disabled={!pdfBlob}
              style={{
                width: '100%',
                padding: '14px',
                background: !pdfBlob
                  ? 'rgba(255,255,255,0.1)'
                  : 'linear-gradient(135deg, #ec4899 0%, #f093fb 100%)',
                border: 'none',
                borderRadius: 10,
                color: 'white',
                fontSize: 15,
                fontWeight: 600,
                cursor: !pdfBlob ? 'not-allowed' : 'pointer',
                marginBottom: 16,
                boxShadow: '0 4px 15px rgba(236, 72, 153, 0.4)',
                transition: 'all 0.2s ease'
              }}
            >
              📥 下载 PDF
            </button>

            <div style={{
              padding: 16,
              borderRadius: 10,
              background: 'rgba(167, 139, 250, 0.15)',
              border: '1px solid rgba(167, 139, 250, 0.3)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🎉</div>
              <div style={{ color: '#c4b5fd', fontSize: 14, fontWeight: 500 }}>
                恭喜！你已经学会了基本操作！
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 8 }}>
                现在可以输入自己的简历内容或使用 AI 生成简历了
              </div>
            </div>
          </div>
        )
      
      default:
        return null
    }
  }

  const stepTitles = [
    '1. 配置 AI Key',
    '2. 测试 AI 连接',
    '3. 加载 Demo 模板',
    '4. 下载简历'
  ]

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        animation: 'fadeIn 0.3s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
          borderRadius: '24px',
          padding: '28px',
          maxWidth: '450px',
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          animation: 'slideUp 0.4s ease',
          position: 'relative',
        }}
      >
        {/* 关闭按钮 */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '18px',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
          }}
        >
          ✕
        </button>

        {/* 进度指示器 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {stepTitles.map((_, index) => (
            <div
              key={index}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                background: index <= currentStep 
                  ? 'linear-gradient(90deg, #a78bfa 0%, #ec4899 100%)'
                  : 'rgba(255, 255, 255, 0.2)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* 步骤标题 */}
        <h2 style={{
          margin: '0 0 20px 0',
          fontSize: '22px',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          opacity: isAnimating ? 0 : 1,
          transition: 'opacity 0.2s ease'
        }}>
          {stepTitles[currentStep]}
        </h2>

        {/* 步骤内容 */}
        <div style={{ 
          opacity: isAnimating ? 0 : 1, 
          transition: 'opacity 0.2s ease',
          minHeight: '200px'
        }}>
          {renderStepContent()}
        </div>

        {/* 导航按钮 */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'space-between',
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            style={{
              padding: '10px 20px',
              background: currentStep === 0 
                ? 'rgba(255, 255, 255, 0.05)'
                : 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '10px',
              color: currentStep === 0 
                ? 'rgba(255, 255, 255, 0.3)'
                : 'rgba(255, 255, 255, 0.8)',
              cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.2s ease',
            }}
          >
            ← 上一步
          </button>

          <button
            onClick={handleNext}
            disabled={!canProceed()}
            style={{
              padding: '10px 24px',
              background: !canProceed()
                ? 'rgba(255, 255, 255, 0.1)'
                : currentStep === 3
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
              border: 'none',
              borderRadius: '10px',
              color: !canProceed() ? 'rgba(255,255,255,0.4)' : 'white',
              cursor: !canProceed() ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              boxShadow: canProceed() ? '0 4px 15px rgba(167, 139, 250, 0.4)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {currentStep === 3 ? '✅ 完成引导' : '下一步 →'}
          </button>
        </div>

        {/* 跳过提示 */}
        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.4)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            跳过引导
          </button>
        </div>
      </div>
    </div>
  )
}

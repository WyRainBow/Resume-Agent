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
  const [provider, setProvider] = useState<'gemini' | 'zhipu' | 'doubao'>('doubao') // 当前选择的提供商
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
        setProvider(data.defaultProvider as 'gemini' | 'zhipu' | 'doubao')
      })
      .catch(() => {})
  }, [])

  // 获取当前模型显示名称
  const getModelDisplayName = (p: string) => {
    const modelName = aiConfig?.models?.[p] || ''
    if (p === 'doubao') return '豆包 ' + modelName.replace('doubao-', '').replace(/-/g, ' ')
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
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `请求失败 (${response.status})`)
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
    } catch (err: any) {
      stopTimer()
      setError(err.message || 'AI 解析失败，请检查内容格式或稍后重试')
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
              保存到我的简历
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
              仅预览编辑（不保存）
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
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                const placeholder = `姓名：张三
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
- 数据库：MySQL, Redis`
                if (!text || placeholder.startsWith(text)) {
                  e.preventDefault()
                  setText(placeholder)
                }
              }
            }}
            placeholder={`请粘贴您的简历内容（TAB 补全示例），例如：

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
              <span>AI 模型：</span>
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
                <option value="doubao" style={{ background: '#1e1b4b' }}>
                  豆包 Seed-1.6-lite
                </option>
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



/**
韦宇
📞 18933549212    📧 3658043236@qq.com    年龄: 22岁    求职意向: 后端开发
教育经历
广东药科大学　　　　　　本科　　　　　　计算机科学与技术专业　　　　 2022.09-2026.06
实习经历
腾讯云 - 后端开发实习生 2025.06 - 2025.10
深言科技 - AI 应用开发实习生 2025.03 - 2025.06
美的 - Java 开发实习生 2024.12 - 2025.03

项目经历
腾讯云域名注册业务 
实习内容
项目描述: 负责腾讯云域名注册业务的开发：参与实现了域名注册⿊⽩名单的专项设计、搜索服务的拆分、⻛险SQL专项治理 
1. 搜索服务拆分专项 
针对域名Check查询挤占连接资源导致核⼼业务超时问题、主导服务架构拆分。 
1.1. ⽅案设计: 按读/写属性垂直拆分EPP服务为读写两个独⽴集群、配置物理隔离连接池 
1.2. 容灾设计: 设计公共备⽤集群作为容灾⽅案  
1.3. 实现⽅式: 增加命令路由切换、根据命令类型分发⾄对应集群，实现故障隔离 
2. 域名⿊⽩名单专项 
针对域名秒杀抢注、溢价域名交易、恶意API攻击等核⼼业务场景、从0到1实现了域名⿊⽩名单模块，提供统⼀的名单管控
2.1. 多级缓存架构： 构建"SDK本地缓存 + Redis分布式缓存"架构、通过Guava Cache和5秒过期策略，⽀撑近万QPS 峰值、本地缓存命中率97%以上 
2.2. 数据⼀致性保障： 实现"准实时-增量-全量"多重保障、通过写DB+发MQ、Binlog监听、定时任务确保数据⼀致性
3. ⻛险SQL治理专项 
优化100余条⾼⻛险SQL、扫描⾏数从超百万⾏降⾄万⾏以下、执⾏时间提升80%。 
3.1. API优化: 通过强制索引、JOIN优化等⼿段、确保查询毫秒级响应 
3.2. 统计查询优化: 采⽤代码解耦、游标分⻚处理⼤数据量查询 
3.3. RO迁移: 推动复杂查询向RO只读实例迁移、降低主库负载 

深言科技 - 语鲸 DeepResearch - AI Agent 智能搜索系统
项目描述
基于清华大模型构建的自主式深度研究（DeepResearch）智能体。具备复杂意图识别、多源混合检索、长文本深度阅读与结构化研报生成能力、解决传统搜索信息碎片化痛点。
核心职责与产出
参与 AI 搜索链路并主导广告投放系统开发。从用户提问 → 多源检索 → 长文阅读 → 报告输出全流程上、将用户模糊问题拆解为可执行任务、打通各类数据源、让模型读懂并输出可用结果、并建设配套的投放与数据反馈体系。
1. Agent 推理与规划（Reasoning & Planning）
 设计基于 LLM 的意图拆解模块、将复杂长查询转化为 CoT（思维链）任务序列。实现 基于推理的查询扩展、结合行业知识库与用户行为日志、利用 LLM 自动生成并校验同义词和行业术语、显著提升长尾查询召回。
2. 多源融合检索架构（Hybrid Search）
 基于 BGE-M3 实现稠密向量 + 稀疏关键词的混合检索。并行编排 Bing Search API（广度）、垂类教育库/知识图谱（深度）、Milvus 向量库、结合 LLM 查询改写与结果重排、提升信息召回率与准确性
3. RAG 深度阅读与抗幻觉生成
 构建上下文感知生成模块、利用 RAG 将高置信度证据片段注入 LLM Context。通过 Prompt Engineering 引导模型进行多源信息比对、事实核查、最终输出结构化 Markdown 格式的深度研报（摘要、提纲、引用溯源）。
4. 广告数据闭环链路
 主导搜索结果页广告投放系统建设、实现曝光、点击（CTR）、转化的全链路埋点追踪、基于用户行为数据做闭环反馈、持续优化搜索排序算法与推荐策略。


开源经历
Seata-go 社区（开源贡献）
仓库：https://github.com/apache/incubator-seata-go
1.简介：阿里开源的分布式事务框架，已服务阿里云、蚂蚁、滴滴等 150+ 企业
2.个人职责：主要负责社区日常 Issue 维护与答疑、问题复现与定位
3.实现本地缓存计数器 PR 记录：https://github.com/apache/dubbo-admin/issues/1338
AI 超级智能体（合作开源项目）
仓库：https://github.com/Cunninger/my-ai-agent
技术栈：Spring Boot、Spring AI、PostgreSQL、Redis
个人职责：
  1.  实现多轮对话：基于文件系统的 ChatMemory、序列化持久化会话历史
  2.  实现 RAG：结合向量数据库与分片 Embedding、支持高效文档检索与问答
  3. 集成 MCP：开发网页抓取、PDF 批量上传等工具、集成 MCP 服务
  4. 多任务 Agent 工作流：实现自主规划、支持多任务分解与多步骤执行

专业技能
- Java基础: 熟悉 Java 编程语言，有两年使用经验，掌握 集合框架、异常、多线程、反射 等核心机制。
- Golang基础: 熟悉 Golang 语言，有一年使用经验，掌握 Map、Channel 实现原理，熟悉 Gin、GORM 组件。
- JVM: 熟悉 JVM，掌握 内存结构，垃圾回收机制，类加载机制，GC 算法 等，了解过 JVM 调优 方法。
- MySQL: 熟悉 MySQL 基础原理、存储引擎、索引原理、MVCC、事务 等机制、具备一定的 SQL 性能调优 能力。
- Redis: 熟悉 Redis 底层数据结构、分布式锁、线程模型 等机制，熟悉 缓存击穿、穿透、雪崩 概念。
- 计算机网络: 熟悉 TCP、UDP、HTTP、HTTPS 等网络协议，掌握 TCP 三次握手、四次挥手、流量控制 等机制。
- 操作系统: 熟悉 进程、线程、虚拟内存、I/O 多路复用 等，掌握 进程间通信和多线程同步 技术。
- AI: 了解 AI Agent、RAG、FunctionCall、LLM(如阿里百炼、DeepSeek)Promot 管理和编排的基本概念及原理。 */
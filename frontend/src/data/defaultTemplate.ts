/**
 * 默认简历模板
 * 
 * 这个模板内嵌在前端代码中，不依赖后端接口
 * 用户数据保存在浏览器 localStorage 中
 */
import type { Resume } from '../types/resume'

export const DEFAULT_RESUME_TEMPLATE: Resume = {
  name: "张三",
  contact: {
    email: "zhangsan@example.com",
    phone: "13800138000"
  },
  objective: "后端开发工程师",
  sectionTitles: {
    experience: "实习经历"
  },
  education: [
    {
      title: "某某大学",
      subtitle: "计算机科学与技术专业",
      degree: "本科",
      date: "2022.09 - 2026.06",
      details: []
    }
  ],
  internships: [
    {
      title: "实习公司一",
      subtitle: "后端开发实习生",
      date: "2025.06 - 2025.10",
      highlights: [
        "参与核心业务模块的开发与维护，负责接口设计与实现",
        "参与系统性能优化工作，通过代码重构和查询优化提升接口响应速度",
        "参与技术方案讨论，协助解决开发过程中遇到的技术问题"
      ]
    },
    {
      title: "实习公司二",
      subtitle: "后端开发实习生",
      date: "2025.03 - 2025.06",
      highlights: [
        "参与新功能模块的开发，负责需求分析、技术方案设计和代码实现",
        "参与代码审查，学习并实践代码规范和最佳实践",
        "协助团队完成项目交付，参与测试和问题修复工作"
      ]
    },
    {
      title: "实习公司三",
      subtitle: "后端开发实习生",
      date: "2024.12 - 2025.03",
      highlights: [
        "参与业务系统开发，熟悉企业级应用开发流程",
        "学习并实践常用框架和中间件的使用，提升技术能力",
        "参与团队技术分享，学习系统架构设计相关知识"
      ]
    }
  ],
  projects: [
    {
      title: "项目经历一",
      subtitle: "",
      date: "",
      highlights: [
        "专项一",
        "面向高并发业务场景，主导系统性能与稳定性问题的分析与优化，提升整体服务响应能力",
        "参与核心服务架构设计与拆分，推动系统模块解耦与资源隔离，增强系统可扩展性与可靠性",
        "推动数据一致性与稳定性保障方案的设计与落地，降低异常情况下的数据风险",
        "参与数据库访问性能优化，通过查询与结构调整显著提升关键接口响应效率",
        "专项二",
        "设计并落地多层次容错与降级方案，提升系统在异常场景下的稳定运行能力",
        "针对数据访问瓶颈，参与缓存体系与数据访问策略优化，支撑高并发访问场景",
        "专项三",
        "推动数据一致性与稳定性保障方案的设计与落地，降低异常情况下的数据风险",
        "参与数据库访问性能优化，通过查询与结构调整显著提升关键接口响应效率"
      ]
    },
    {
      title: "项目经历二",
      subtitle: "",
      date: "",
      highlights: [
        "项目描述：",
        "基于大模型的智能简历系统",
        "核心职责与产出：",
        "参与智能信息检索系统的整体方案设计，提升系统对复杂查询和用户意图的理解能力",
        "设计并实现多策略检索与结果融合机制，提升系统信息召回质量与准确性",
        "模块一：生成内容 LLM：结合大模型能力，参与生成式内容模块设计，增强系统在复杂场景下的信息整合与表达能力",
        "模块二：检索：智能简历检索",
        "模块三：RAG：构建简历 RAG"
      ]
    }
  ],
  openSource: [
    {
      title: "开源项目一（某分布式项目）",
      subtitle: "",
      items: [
        "仓库：https://github.com/example/project",
        "社区日常 Issue 维护与答疑、问题复现与定位",
        "实现某功能 PR 记录：https://github.com/example/project/issues/xxx"
      ]
    },
    {
      title: "开源项目二",
      subtitle: "个人项目",
      items: [
        "项目描述：",
        "构建了融合本地知识库检索（RAG）与实时网络搜索的多模态智能系统、帮助某企业显著提升业务转化率。",
        "核心技术与方法：",
        "RAG 检索与知识构建：搭建 RAG",
        "多 Agent 工作流：使用 ReAct + Reflection + Memory 机制、将用户需求拆解给不同 Agent 执行、包括本地知识检索与 Web 搜索、动态决策调用顺序。Reflection 模块能够对检索结果进行思考与修正、Memory 模块保留上下文、实现类人对复杂问题的深度回答。",
        "问答生成与后处理：在给出回答前、综合用户 Query、拓展信息、检索问答对、由大模型统一生成 Markdown 格式的回复、并给出引用与卡片式要点。最后通过后处理对答案进行逻辑审校和提纲式归纳。"
      ]
    }
  ],
  skills: [
    { category: "后端", details: "熟悉 Java 编程语言、Golang 编程语言等原理" },
    { category: "数据库", details: "熟悉 MySQL、MongoDB、ES 等主流数据库原理。有优秀的 SQL 调优经验" },
    { category: "缓存", details: "熟悉 Redis 底层数据结构、分布式锁等机制。熟悉缓存击穿、穿透、雪崩概念" },
    { category: "计算机网络", details: "熟悉 TCP、UDP、HTTP、HTTPS 等网络协议。掌握 TCP 三次握手、四次挥手等机制" },
    { category: "操作系统", details: "熟悉进程、线程、虚拟内存、I/O 多路复用等。掌握进程间通信和多线程同步技术" },
    { category: "AI", details: "了解 AI Agent、RAG、FunctionCall、LLM Prompt 提示词工程" }
  ],
  awards: []
}

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
      title: "北京大学深圳研究院",
      subtitle: "计算机科学与技术",
      degree: "本科",
      date: "2022.09 - 2026.06",
      details: []
    }
  ],
  internships: [
    {
      title: "实习经历一",
      subtitle: "某职位",
      date: "2025.06 - 2025.10",
      highlights: []
    },
    {
      title: "实习经历二",
      subtitle: "某职位",
      date: "2025.02 - 2025.06",
      highlights: []
    },
    {
      title: "实习经历三",
      subtitle: "某职位",
      date: "2024.12 - 2025.01",
      highlights: []
    }
  ],
  projects: [
    {
      title: "项目一",
      subtitle: "",
      date: "",
      highlights: [
        "子项目甲",
        "描述该子项目的主要目标和解决的问题",
        "概述采用的核心技术手段或架构思路",
        "说明实现过程中的关键策略或容灾措施",
        "子项目乙",
        "介绍从 0 到 1 搭建某模块的背景与价值",
        "说明缓存或性能优化的思路与结果",
        "描述数据一致性或稳定性保障方案",
        "子项目丙",
        "总结优化高风险操作的范围与收益",
        "概括查询调优、索引策略等具体动作",
        "解释资源隔离或负载转移方式"
      ]
    },
    {
      title: "项目二",
      subtitle: "",
      date: "",
      highlights: [
        "项目描述：",
        "概述一个具备多模态检索、长文阅读与结构化输出能力的智能系统、强调其解决的痛点与特性。",
        "核心职责与产出：",
        "描述在需求拆解、链路打通以及配套平台建设中的角色与贡献。",
        "模块一：说明如何利用大模型进行推理规划与查询扩展、提升召回能力",
        "模块二：概括多源融合检索架构、指出使用的检索方式与调度策略",
        "模块三：描述 RAG 或抗幻觉生成的实现思路、Prompt 策略与输出形式",
        "模块四：介绍广告或数据闭环链路的建设、涵盖埋点、分析与反馈机制"
      ]
    }
  ],
  openSource: [
    {
      title: "社区贡献一（某分布式项目）",
      subtitle: "",
      items: [
        "简述提交的核心 PR 或 Issue 处理经验",
        "PR: https://example.com/PR",
        "说明在社区内承担的协作职责"
      ]
    },
    {
      title: "社区贡献二",
      subtitle: "",
      items: [
        "组件一：列举涉及的技术栈与能力范围",
        "能力二：描述检索、知识构建或多 Agent 流程的实现",
        "成果：简述分享传播与社区反馈"
      ]
    }
  ],
  skills: [
    { category: "后端", details: "熟悉若干编程语言或服务框架" },
    { category: "数据库", details: "了解常见数据库及调优思路" },
    { category: "缓存", details: "掌握缓存策略与典型问题处理" },
    { category: "网络", details: "熟悉常见网络协议与连接管理" },
    { category: "操作系统", details: "理解进程线程与资源管理机制" },
    { category: "AI", details: "了解 Agent、RAG、Function Call 与 Prompt 工程" }
  ],
  awards: [
    "例如学科竞赛、省级奖项等"
  ]
}

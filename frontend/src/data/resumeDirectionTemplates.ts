import { initialResumeData } from '@/pages/Workspace/v2/constants'
import type { GlobalSettings, MenuSection, ResumeData } from '@/pages/Workspace/v2/types'
import { normalizeHtmlTemplateId, normalizeLatexTemplateId } from '@/services/resumeTemplates'

export type PhotoPlacement = 'left' | 'right' | 'none'
export type ResumeRenderEngine = 'latex' | 'html'

export interface ResumeDirectionSection {
  id: string
  title: string
  guidance: string
  enabled?: boolean
  icon?: string
}

export interface DirectionTemplateSampleResume {
  resumeTitle?: string
  basic: ResumeData['basic']
  education: ResumeData['education']
  experience: ResumeData['experience']
  projects: ResumeData['projects']
  openSource?: ResumeData['openSource']
  awards?: ResumeData['awards']
  customData?: ResumeData['customData']
  selfEvaluation: string
  skillContent: string
}

export interface ResumeDirectionTemplate {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  bestFor: string[]
  previewImageUrl?: string
  renderEngine?: ResumeRenderEngine
  renderTemplateId?: string
  latexTemplateId?: string
  photoPlacement: PhotoPlacement
  sections: ResumeDirectionSection[]
  globalSettings?: Partial<GlobalSettings>
  sampleResume?: DirectionTemplateSampleResume
}

export const DEFAULT_RESUME_DIRECTION_TEMPLATE_ID = 'software-engineering'
export const DEFAULT_DIRECTION_TEMPLATE_PREVIEW_URL = '/api/resume-templates/classic/preview'

const COMMON_SETTINGS: Partial<GlobalSettings> = {
  latexFontSize: 11,
  latexMargin: 'standard',
  latexLineSpacing: 1.15,
  latexHeaderTopGapPx: -4,
  latexHeaderNameContactGapPx: 0,
  latexHeaderBottomGapPx: -1,
}

export const RESUME_DIRECTION_TEMPLATES: ResumeDirectionTemplate[] = [
  {
    id: 'software-engineering',
    name: '计算机 / 软件开发',
    description: '突出技术栈、工程项目、实习经历和开源成果，适合开发、算法、测试、数据等技术岗位。',
    category: '理工技术',
    tags: ['技术能力', '项目经历', '开源成果'],
    bestFor: ['软件开发实习', '后端 / 前端 / 算法岗位', '计算机相关专业求职'],
    latexTemplateId: 'classic',
    photoPlacement: 'right',
    sampleResume: {
      resumeTitle: '后端开发工程师简历',
      basic: {
        name: '林泽宇',
        title: '后端开发工程师',
        email: 'linzeyu@example.com',
        phone: '138-2048-6123',
        location: '杭州',
        blog: 'https://github.com/linzeyu',
      },
      education: [
        {
          id: 'se_edu_0',
          school: '浙江大学',
          major: '软件工程',
          degree: '本科',
          startDate: '2022.09',
          endDate: '2026.06',
          gpa: 'GPA 3.8/4.0',
          description: '<p>核心课程：数据结构、操作系统、计算机网络、数据库系统、分布式系统。</p><p>专业排名前 10%，担任学院开发者协会后端组负责人，组织 4 次技术分享和代码评审活动。</p>',
          visible: true,
        },
      ],
      experience: [
        {
          id: 'se_exp_0',
          company: '字节跳动',
          position: '后端开发实习生',
          date: '2025.06 - 2025.10',
          details: '<ul class="custom-list"><li><p>负责活动配置服务接口开发，完成活动查询、规则校验、状态流转等 8 个核心接口。</p></li><li><p>基于慢查询日志优化索引和缓存策略，将高频查询接口 P95 响应从 180ms 降至 70ms。</p></li><li><p>接入 Redis 缓存、令牌桶限流和降级兜底，支撑峰值 3 万 QPS 的活动访问。</p></li></ul>',
          visible: true,
          companyLogo: 'bytedance',
        },
        {
          id: 'se_exp_1',
          company: '阿里云',
          position: '云原生研发实习生',
          date: '2024.12 - 2025.03',
          details: '<ul class="custom-list"><li><p>参与容器发布平台告警链路改造，补充 Prometheus 指标、异常日志追踪和发布失败标签。</p></li><li><p>实现发布单健康检查与回滚提示，将异常定位信息同步到飞书告警卡片。</p></li><li><p>编写灰度发布校验脚本，将人工巡检时间从 20 分钟缩短到 5 分钟。</p></li></ul>',
          visible: true,
          companyLogo: 'alibaba',
        },
      ],
      projects: [
        {
          id: 'se_proj_0',
          name: '智能简历解析与推荐系统',
          role: '后端负责人',
          date: '2025.02 - 2025.05',
          description: '<ul class="custom-list"><li><p>基于 FastAPI、PostgreSQL 和向量检索构建简历结构化解析链路，支持 PDF、DOCX 和 Markdown 输入。</p></li><li><p>设计异步任务队列、解析状态表和结果缓存，批量解析吞吐提升 2.4 倍。</p></li><li><p>封装岗位画像匹配接口，输出技能缺口、项目匹配度和可编辑优化建议。</p></li></ul>',
          visible: true,
          link: 'https://github.com/linzeyu/resume-agent',
        },
        {
          id: 'se_proj_1',
          name: '高并发秒杀库存服务',
          role: '核心开发',
          date: '2024.09 - 2024.12',
          description: '<ul class="custom-list"><li><p>使用 Go、Redis Lua 和消息队列实现库存预扣、订单异步落库和幂等消费。</p></li><li><p>设计用户限购、库存回补和超时取消机制，避免重复下单与库存超卖。</p></li><li><p>完成压测脚本和热点 Key 保护方案，单机压测稳定支撑 1.2 万 QPS。</p></li></ul>',
          visible: true,
          link: 'https://github.com/linzeyu/flash-sale',
        },
      ],
      openSource: [
        {
          id: 'se_os_0',
          name: 'OpenResume Parser',
          role: 'Contributor',
          repo: 'https://github.com/open-resume/parser',
          date: '2025.01 - 至今',
          description: '<p>提交 6 个 PR，补充中文简历字段识别、PDF 文本清洗和测试用例；参与 issue 复现和文档示例维护。</p>',
          visible: true,
        },
        {
          id: 'se_os_1',
          name: 'MiniKV Storage Engine',
          role: 'Maintainer',
          repo: 'https://github.com/linzeyu/minikv',
          date: '2024.07 - 至今',
          description: '<p>实现 LSM-Tree 存储、WAL 恢复、Bloom Filter 和分层压缩策略，补充 40+ 单元测试与 benchmark。</p>',
          visible: true,
        },
      ],
      awards: [
        {
          id: 'se_award_0',
          title: 'ACM-ICPC 区域赛铜奖',
          issuer: 'ICPC Asia',
          date: '2024.11',
          description: '团队排名前 12%。',
          visible: true,
        },
        {
          id: 'se_award_1',
          title: '浙江大学优秀学生奖学金',
          issuer: '浙江大学',
          date: '2024.10',
          description: '综合成绩与科研实践表现排名专业前 10%。',
          visible: true,
        },
      ],
      selfEvaluation: '<p>具备扎实的计算机基础和后端工程能力，熟悉高并发服务、缓存、数据库优化和可观测性建设。</p><p>习惯用压测、监控和单元测试验证方案，能独立推进从需求拆解、接口设计、开发联调到灰度上线的完整流程。</p>',
      skillContent: '<p><strong>语言：</strong>Java、Go、TypeScript、Python，熟悉面向对象、并发编程和常用设计模式</p><p><strong>后端：</strong>Spring Boot、FastAPI、MyBatis、RESTful API、JWT、RBAC 权限模型</p><p><strong>数据与缓存：</strong>MySQL、PostgreSQL、Redis，熟悉索引优化、事务隔离和缓存一致性</p><p><strong>工程化：</strong>Docker、GitHub Actions、Prometheus、日志排查、压测与接口文档维护</p>',
    },
    globalSettings: {
      ...COMMON_SETTINGS,
      projectLinkDisplay: 'icon',
      openSourceRepoDisplay: 'icon',
      experienceListType: 'none',
    },
    sections: [
      { id: 'basic', title: '基本信息', guidance: '姓名、目标岗位、联系方式和个人链接。' },
      { id: 'education', title: '教育经历', guidance: '学校、专业、学位、核心课程、GPA 或排名。' },
      { id: 'experience', title: '实习/工作经历', guidance: '用技术动作、业务场景和量化结果描述贡献。' },
      { id: 'projects', title: '项目经历', guidance: '写清技术架构、难点、个人职责和结果。' },
      { id: 'openSource', title: '开源/作品', guidance: '展示 GitHub、开源贡献、个人技术作品。' },
      { id: 'skills', title: '技术能力', guidance: '按语言、框架、数据库、工程工具分组。' },
      { id: 'awards', title: '竞赛与荣誉', guidance: '列出算法竞赛、奖学金、专业证书。' },
      { id: 'selfEvaluation', title: '个人总结', guidance: '用 2-3 句话概括技术方向和优势。' },
    ],
  },
  {
    id: 'software-engineering-html',
    name: '计算机 / 软件开发 HTML',
    description: '使用 HTML 实时预览和浏览器导出，适合希望快速编辑、即时看到排版效果的技术岗位简历。',
    category: '理工技术',
    tags: ['HTML 实时预览', '技术能力', '项目经历'],
    bestFor: ['软件开发实习', '前端 / 后端 / 算法岗位', '需要快速在线编辑的简历'],
    renderEngine: 'html',
    renderTemplateId: 'html-classic',
    photoPlacement: 'right',
    sampleResume: {
      resumeTitle: '前端开发工程师简历',
      basic: {
        name: '陈予安',
        title: '前端开发工程师',
        email: 'chenyuan@example.com',
        phone: '186-7721-9045',
        location: '深圳',
        blog: 'https://chenyuan.dev',
      },
      education: [
        {
          id: 'seh_edu_0',
          school: '华南理工大学',
          major: '计算机科学与技术',
          degree: '本科',
          startDate: '2022.09',
          endDate: '2026.06',
          description: '<p>主修 Web 前端开发、软件工程、人机交互、数据库系统。</p>',
          visible: true,
        },
      ],
      experience: [
        {
          id: 'seh_exp_0',
          company: '腾讯',
          position: '前端开发实习生',
          date: '2025.07 - 2025.10',
          details: '<ul class="custom-list"><li><p>负责运营后台低代码表单组件开发，沉淀 12 个通用业务组件。</p></li><li><p>优化首屏加载与状态缓存策略，核心页面 LCP 从 3.1s 降至 1.6s。</p></li></ul>',
          visible: true,
          companyLogo: 'tencent',
        },
      ],
      projects: [
        {
          id: 'seh_proj_0',
          name: '数据看板搭建平台',
          role: '前端负责人',
          date: '2025.03 - 2025.06',
          description: '<ul class="custom-list"><li><p>使用 React、Vite、ECharts 实现拖拽式图表编排和实时预览。</p></li><li><p>封装权限、筛选器和图表联动能力，支撑 20+ 业务看板复用。</p></li></ul>',
          visible: true,
          link: 'https://github.com/chenyuan/dashboard-builder',
        },
      ],
      openSource: [
        {
          id: 'seh_os_0',
          name: 'React Resume UI Kit',
          role: 'Maintainer',
          repo: 'https://github.com/chenyuan/resume-ui-kit',
          date: '2024.12 - 至今',
          description: '<p>维护可编辑简历组件库，覆盖富文本编辑、导出和响应式预览。</p>',
          visible: true,
        },
      ],
      awards: [
        {
          id: 'seh_award_0',
          title: '全国大学生计算机设计大赛二等奖',
          issuer: '竞赛组委会',
          date: '2024.08',
          description: '作品方向：智能信息可视化。',
          visible: true,
        },
      ],
      selfEvaluation: '<p>关注复杂交互和工程质量，熟悉 React 技术栈、性能优化和组件化设计，能把产品需求稳定落地为可维护的前端体验。</p>',
      skillContent: '<p><strong>前端：</strong>React、TypeScript、Vite、Tailwind CSS、ECharts</p><p><strong>工程：</strong>组件设计、性能优化、单元测试、CI/CD</p><p><strong>协作：</strong>Figma、Apifox、Git、需求拆解</p>',
    },
    globalSettings: {
      ...COMMON_SETTINGS,
      pagePadding: 40,
      lineHeight: 1.5,
      baseFontSize: 16,
      projectLinkDisplay: 'icon',
      openSourceRepoDisplay: 'icon',
      experienceListType: 'none',
    },
    sections: [
      { id: 'basic', title: '基本信息', guidance: '姓名、目标岗位、联系方式和个人链接。' },
      { id: 'education', title: '教育经历', guidance: '学校、专业、学位、核心课程、GPA 或排名。' },
      { id: 'experience', title: '实习/工作经历', guidance: '用技术动作、业务场景和量化结果描述贡献。' },
      { id: 'projects', title: '项目经历', guidance: '写清技术架构、难点、个人职责和结果。' },
      { id: 'openSource', title: '开源/作品', guidance: '展示 GitHub、开源贡献、个人技术作品。' },
      { id: 'skills', title: '技术能力', guidance: '按语言、框架、数据库、工程工具分组。' },
      { id: 'awards', title: '竞赛与荣誉', guidance: '列出算法竞赛、奖学金、专业证书。' },
      { id: 'selfEvaluation', title: '个人总结', guidance: '用 2-3 句话概括技术方向和优势。' },
    ],
  },
  {
    id: 'product-operations',
    name: '产品 / 运营',
    description: '强调用户洞察、数据分析、需求推进、活动运营和增长结果。',
    category: '互联网业务',
    tags: ['产品方法', '运营案例', '数据分析'],
    bestFor: ['产品经理实习', '用户运营 / 内容运营', '增长与商业分析岗位'],
    latexTemplateId: 'compact',
    photoPlacement: 'right',
    sampleResume: {
      resumeTitle: '产品经理实习生简历',
      basic: {
        name: '周芷晴',
        title: '产品经理实习生',
        email: 'zhouzhiqing@example.com',
        phone: '158-4309-2261',
        location: '上海',
        blog: 'https://portfolio.example.com/zhiqing',
      },
      education: [
        {
          id: 'po_edu_0',
          school: '复旦大学',
          major: '信息管理与信息系统',
          degree: '本科',
          startDate: '2022.09',
          endDate: '2026.06',
          description: '<p>核心课程：用户研究、数据分析、产品设计、管理信息系统、商业模式分析。</p><p>担任产品创新社负责人，组织需求评审、原型共创和增长案例拆解活动 10+ 场。</p>',
          visible: true,
        },
      ],
      experience: [
        {
          id: 'po_exp_0',
          company: '小红书',
          position: '用户增长产品实习生',
          date: '2025.05 - 2025.09',
          details: '<ul class="custom-list"><li><p>跟进新用户激活链路改版，拆解注册、首发、关注等关键转化指标并维护周报看板。</p></li><li><p>基于用户访谈和行为日志发现内容发布门槛高、兴趣选择弱引导等问题。</p></li><li><p>推动 3 轮 A/B 实验，上线模板化发布与新人任务后次日留存提升 4.8%。</p></li></ul>',
          visible: true,
        },
        {
          id: 'po_exp_1',
          company: '哔哩哔哩',
          position: '内容运营实习生',
          date: '2024.11 - 2025.02',
          details: '<ul class="custom-list"><li><p>负责知识区投稿者成长任务运营，维护 120+ 创作者社群和月度活动节奏。</p></li><li><p>整理热点选题包、投稿案例和数据周报，帮助创作者明确内容方向。</p></li><li><p>复盘曝光、投稿、完播和互动指标，活动期投稿量环比提升 26%。</p></li></ul>',
          visible: true,
        },
      ],
      projects: [
        {
          id: 'po_proj_0',
          name: '校园二手交易小程序',
          role: '产品负责人',
          date: '2024.11 - 2025.03',
          description: '<ul class="custom-list"><li><p>完成 42 份用户访谈、问卷和竞品分析，沉淀买卖双方核心痛点与交易顾虑。</p></li><li><p>定义发布、搜索、议价、信用评价和违规举报流程，输出 PRD、原型和埋点方案。</p></li><li><p>上线 6 周累计 2,300 名注册用户，商品发布转化率达到 38%，交易咨询转化率达到 21%。</p></li></ul>',
          visible: true,
          link: 'https://portfolio.example.com/campus-market',
        },
        {
          id: 'po_proj_1',
          name: '会员续费转化分析',
          role: '数据分析负责人',
          date: '2025.01 - 2025.03',
          description: '<ul class="custom-list"><li><p>用 SQL 拆解首购、到期提醒、权益使用和续费转化漏斗，定位权益感知不足问题。</p></li><li><p>按用户生命周期分层分析高频使用、沉默和即将流失用户的行为差异。</p></li><li><p>输出会员权益卡片与到期提醒优化方案，模拟测算可提升 3.2% 续费率。</p></li></ul>',
          visible: true,
          link: 'https://portfolio.example.com/member-retention',
        },
      ],
      openSource: [],
      awards: [
        {
          id: 'po_award_0',
          title: '互联网+ 大学生创新创业大赛校级金奖',
          issuer: '复旦大学',
          date: '2024.06',
          description: '项目方向：校园生活服务。',
          visible: true,
        },
        {
          id: 'po_award_1',
          title: '校级优秀学生干部',
          issuer: '复旦大学',
          date: '2024.12',
          description: '负责社团活动运营与跨学院项目协作。',
          visible: true,
        },
      ],
      customData: {
        custom_growth: [
          {
            id: 'po_growth_0',
            title: '增长分析复盘',
            subtitle: '新用户激活漏斗',
            dateRange: '2025.06',
            description: '<p>基于埋点数据定位首发内容门槛过高问题，提出模板化发布、新人任务和兴趣引导方案，并补充核心指标看板。</p>',
            visible: true,
          },
          {
            id: 'po_growth_1',
            title: 'A/B 实验记录',
            subtitle: '新人任务奖励策略',
            dateRange: '2025.07',
            description: '<p>设计积分、权益券和社交提醒 3 组实验方案，跟踪激活率、任务完成率、7 日留存和负反馈率。</p>',
            visible: true,
          },
        ],
      },
      selfEvaluation: '<p>具备用户研究、数据拆解和跨团队沟通能力，能从业务目标出发设计可落地的产品与运营方案。</p><p>重视指标闭环和用户反馈，习惯用访谈、埋点、竞品分析和实验复盘把问题讲清楚、把方案推进落地。</p>',
      skillContent: '<p><strong>产品方法：</strong>需求分析、用户访谈、PRD、原型设计、竞品分析、A/B 实验</p><p><strong>数据分析：</strong>SQL、Excel、Python、漏斗分析、留存分析、用户分层、看板搭建</p><p><strong>运营能力：</strong>活动策划、内容运营、社群维护、增长复盘、用户反馈处理</p><p><strong>协作工具：</strong>Figma、Axure、飞书、多维表格、墨刀、Apifox</p>',
    },
    globalSettings: {
      ...COMMON_SETTINGS,
      experienceListType: 'unordered',
      projectLinkDisplay: 'below',
    },
    sections: [
      { id: 'basic', title: '基本信息', guidance: '姓名、目标岗位、联系方式和作品链接。' },
      { id: 'education', title: '教育背景', guidance: '学校、专业、课程、校园经历。' },
      { id: 'experience', title: '实习/实践经历', guidance: '描述业务目标、用户规模、策略动作和指标变化。' },
      { id: 'projects', title: '产品/运营案例', guidance: '呈现需求分析、方案设计、执行复盘和数据结果。' },
      { id: 'custom_growth', title: '数据与增长成果', guidance: '沉淀核心指标、分析方法、实验结论。' },
      { id: 'skills', title: '工具与方法', guidance: '列出数据分析、原型设计、文档协作和运营工具。' },
      { id: 'awards', title: '证书与荣誉', guidance: '补充竞赛、证书、奖学金或校内荣誉。' },
      { id: 'selfEvaluation', title: '个人优势', guidance: '概括用户理解、数据意识和跨团队推进能力。' },
    ],
  },
  {
    id: 'design-creative',
    name: '设计 / 创意',
    description: '围绕作品集、设计过程、工具能力和项目影响组织内容，适合视觉、交互、品牌等方向。',
    category: '创意设计',
    tags: ['作品集', '设计能力', '项目案例'],
    bestFor: ['UI/UX 设计', '视觉设计', '品牌与创意岗位'],
    latexTemplateId: 'compact',
    photoPlacement: 'left',
    sampleResume: {
      resumeTitle: 'UI/UX 设计师简历',
      basic: {
        name: '沈知夏',
        title: 'UI/UX 设计师',
        email: 'shenzhixia@example.com',
        phone: '177-6502-4198',
        location: '广州',
        blog: 'https://dribbble.com/zhixia',
      },
      education: [
        {
          id: 'dc_edu_0',
          school: '广州美术学院',
          major: '视觉传达设计',
          degree: '本科',
          startDate: '2021.09',
          endDate: '2025.06',
          description: '<p>主修交互设计、品牌设计、服务设计、用户研究和信息可视化。</p><p>课程作品多次入选学院展览，擅长从调研洞察、信息架构到高保真交付的完整设计流程。</p>',
          visible: true,
        },
      ],
      experience: [
        {
          id: 'dc_exp_0',
          company: '网易',
          position: '交互设计实习生',
          date: '2024.12 - 2025.04',
          details: '<ul class="custom-list"><li><p>参与音乐社区创作者后台改版，完成内容发布、数据分析和收益管理等核心任务流设计。</p></li><li><p>输出低保真原型、高保真稿和交互说明，配合产品完成 4 轮评审迭代。</p></li><li><p>与研发协作落地 18 个页面状态和异常提示，减少 30% 表单误操作。</p></li></ul>',
          visible: true,
        },
        {
          id: 'dc_exp_1',
          company: '蓝湖',
          position: '视觉设计实习生',
          date: '2024.06 - 2024.09',
          details: '<ul class="custom-list"><li><p>参与 B 端协作产品官网和运营页视觉升级，输出组件规范、插画和动效稿。</p></li><li><p>统一栅格、色彩、字体和卡片样式，提升活动页在不同屏幕下的视觉一致性。</p></li><li><p>整理设计交付清单与标注规范，使研发返工沟通次数减少约 25%。</p></li></ul>',
          visible: true,
        },
      ],
      projects: [
        {
          id: 'dc_proj_0',
          name: '城市公共导览 App 体验设计',
          role: '独立设计师',
          date: '2024.03 - 2024.07',
          description: '<ul class="custom-list"><li><p>基于游客访谈和现场观察绘制用户旅程地图，识别路线迷失、信息过载和无障碍提示不足问题。</p></li><li><p>完成信息架构、高保真原型和视觉规范，覆盖路线规划、语音导览和无障碍模式。</p></li><li><p>组织 8 人可用性测试，基于反馈优化导航层级、地图标注和语音提示节奏。</p></li></ul>',
          visible: true,
          link: 'https://portfolio.example.com/city-guide',
        },
        {
          id: 'dc_proj_1',
          name: '智能家居 App 设计系统',
          role: '设计系统负责人',
          date: '2024.08 - 2024.11',
          description: '<ul class="custom-list"><li><p>梳理颜色、字体、间距、图标和组件状态，建立覆盖 36 个核心组件的 Figma 组件库。</p></li><li><p>为设备控制、家庭成员、场景自动化等高频流程定义一致的交互模式。</p></li><li><p>配合研发制定 Token 命名、暗色模式和响应式规则，缩短多端页面还原时间。</p></li></ul>',
          visible: true,
          link: 'https://portfolio.example.com/smart-home-system',
        },
      ],
      openSource: [],
      awards: [
        {
          id: 'dc_award_0',
          title: '站酷设计周学生组优秀奖',
          issuer: '站酷',
          date: '2024.10',
          description: '作品：城市公共导览 App。',
          visible: true,
        },
        {
          id: 'dc_award_1',
          title: '学院年度优秀课程作品',
          issuer: '广州美术学院',
          date: '2024.06',
          description: '作品方向：智能家居 App 设计系统。',
          visible: true,
        },
      ],
      customData: {
        custom_portfolio: [
          {
            id: 'dc_portfolio_0',
            title: '作品集链接',
            subtitle: '交互、视觉、品牌项目合集',
            dateRange: '2025',
            description: '<p>https://portfolio.example.com/shenzhixia，包含 5 个完整设计案例、调研过程、交互说明和设计系统文档。</p>',
            visible: true,
          },
          {
            id: 'dc_portfolio_1',
            title: '设计系统组件库',
            subtitle: '智能家居多端组件规范',
            dateRange: '2024.11',
            description: '<p>沉淀按钮、表单、卡片、导航和状态反馈组件，附交互说明、响应式规则、暗色模式与可访问性标注。</p>',
            visible: true,
          },
        ],
      },
      selfEvaluation: '<p>重视问题定义和细节落地，擅长把用户研究、交互逻辑和视觉表达整合为一致的产品体验。</p><p>能够和产品、研发保持高频协作，交付包含组件规范、状态说明、动效方案和走查清单的完整设计资产。</p>',
      skillContent: '<p><strong>体验设计：</strong>用户访谈、旅程地图、信息架构、交互原型、可用性测试</p><p><strong>视觉设计：</strong>版式、色彩、图标、品牌延展、数据可视化、设计系统</p><p><strong>动效与三维：</strong>Principle、After Effects、Blender，能制作交互动效和展示素材</p><p><strong>协作工具：</strong>Figma、Sketch、蓝湖、Notion、飞书文档、标注与设计走查</p>',
    },
    globalSettings: {
      ...COMMON_SETTINGS,
      latexMargin: 'relaxed',
      projectLinkDisplay: 'below',
    },
    sections: [
      { id: 'basic', title: '基本信息', guidance: '姓名、方向、联系方式、作品集链接。' },
      { id: 'education', title: '教育背景', guidance: '学校、专业、设计课程或交换经历。' },
      { id: 'custom_portfolio', title: '作品集', guidance: '放置作品集链接、代表作品和视觉系统说明。' },
      { id: 'projects', title: '设计项目', guidance: '写清问题、调研、方案、迭代和交付成果。' },
      { id: 'experience', title: '实习/合作经历', guidance: '描述与产品、研发、品牌团队的协作产出。' },
      { id: 'skills', title: '设计能力', guidance: '按设计工具、研究方法、动效、建模等分类。' },
      { id: 'awards', title: '获奖与展览', guidance: '列出设计奖项、展览、发表或认证。' },
      { id: 'selfEvaluation', title: '创作理念', guidance: '简短描述审美方向、问题意识和协作风格。' },
    ],
  },
  {
    id: 'finance-business',
    name: '金融 / 商科',
    description: '强调教育背景、实习经历、研究案例、建模分析能力和证书资质。',
    category: '商科金融',
    tags: ['实习经历', '研究案例', '证书资格'],
    bestFor: ['金融实习', '咨询 / 审计 / 投研', '商科管理培训生'],
    latexTemplateId: 'classic',
    photoPlacement: 'right',
    sampleResume: {
      resumeTitle: '投研分析实习生简历',
      basic: {
        name: '顾明轩',
        title: '投研分析实习生',
        email: 'gumingxuan@example.com',
        phone: '139-8120-3368',
        location: '北京',
        blog: 'CFA Level I Candidate',
      },
      education: [
        {
          id: 'fb_edu_0',
          school: '上海财经大学',
          major: '金融学',
          degree: '本科',
          startDate: '2022.09',
          endDate: '2026.06',
          gpa: 'GPA 3.7/4.0',
          description: '<p>核心课程：公司金融、投资学、财务报表分析、计量经济学、金融市场与机构。</p><p>专业排名前 5%，担任金融投资协会研究部成员，参与宏观周报和行业案例拆解。</p>',
          visible: true,
        },
      ],
      experience: [
        {
          id: 'fb_exp_0',
          company: '中金公司',
          position: '行业研究实习生',
          date: '2025.06 - 2025.09',
          details: '<ul class="custom-list"><li><p>跟踪新能源车产业链，整理 30+ 家上市公司财务、销量、产能和价格数据。</p></li><li><p>维护行业周报数据底稿，梳理电池、整车、零部件环节的边际变化。</p></li><li><p>搭建销量预测和估值敏感性模型，支持分析师完成深度报告图表与结论校验。</p></li></ul>',
          visible: true,
        },
        {
          id: 'fb_exp_1',
          company: '普华永道',
          position: '审计实习生',
          date: '2024.12 - 2025.03',
          details: '<ul class="custom-list"><li><p>参与制造业客户年审项目，完成收入、存货、费用和往来科目底稿整理。</p></li><li><p>核对 600+ 条凭证、合同、发票与银行流水，协助发现 3 类单据归档问题。</p></li><li><p>维护审计资料追踪表，与客户财务团队沟通缺失材料和补充说明。</p></li></ul>',
          visible: true,
        },
      ],
      projects: [
        {
          id: 'fb_proj_0',
          name: '消费电子行业估值研究',
          role: '分析师',
          date: '2025.03 - 2025.05',
          description: '<ul class="custom-list"><li><p>基于 DCF 和可比公司法完成 8 家消费电子公司估值区间测算。</p></li><li><p>分析终端需求、库存周期、汇率变动和毛利率弹性对盈利预测的影响。</p></li><li><p>输出 25 页研究报告，包含行业框架、公司对比、估值假设和投资风险。</p></li></ul>',
          visible: true,
        },
        {
          id: 'fb_proj_1',
          name: 'SaaS 公司商业尽调案例',
          role: '财务与市场分析',
          date: '2024.10 - 2024.12',
          description: '<ul class="custom-list"><li><p>拆解 ARR、净收入留存率、获客成本、毛利率和回款周期等核心指标。</p></li><li><p>建立三年收入预测模型，按客户规模和续费率拆分增长假设。</p></li><li><p>完成竞品对标、风险梳理和敏感性分析，输出 18 页投资备忘录。</p></li></ul>',
          visible: true,
        },
      ],
      openSource: [],
      awards: [
        {
          id: 'fb_award_0',
          title: '校级一等奖学金',
          issuer: '上海财经大学',
          date: '2024.12',
          description: '专业排名前 5%。',
          visible: true,
        },
        {
          id: 'fb_award_1',
          title: 'CFA Institute Research Challenge 校内优胜奖',
          issuer: '上海财经大学',
          date: '2024.05',
          description: '负责财务预测、估值模型和英文路演材料。',
          visible: true,
        },
      ],
      customData: {
        custom_certificates: [
          {
            id: 'fb_cert_0',
            title: 'CFA Level I',
            subtitle: '已报名 2026 年 2 月考试',
            dateRange: '2026.02',
            description: '<p>完成财务报表分析、权益投资、固定收益、投资组合和职业伦理模块复习。</p>',
            visible: true,
          },
          {
            id: 'fb_cert_1',
            title: '证券从业资格',
            subtitle: '金融市场基础知识、证券法律法规',
            dateRange: '2025.04',
            description: '<p>系统学习证券市场、投行业务、基金产品和合规基础，成绩均通过。</p>',
            visible: true,
          },
        ],
      },
      selfEvaluation: '<p>具备扎实的金融理论和数据处理能力，熟悉财务建模、行业研究、审计底稿和英文资料检索。</p><p>能够在信息不完整的情况下快速搭建分析框架，用数据、假设和风险点支撑结构化判断。</p>',
      skillContent: '<p><strong>金融分析：</strong>财务建模、DCF、可比公司法、行业研究、敏感性分析、投资备忘录</p><p><strong>财务基础：</strong>三大报表分析、收入确认、存货核查、审计底稿、估值假设校验</p><p><strong>数据工具：</strong>Excel、Wind、Bloomberg、Python、SQL、Power BI、PowerPoint</p><p><strong>语言与证书：</strong>英语 CET-6，CFA Level I Candidate，证券从业资格已通过</p>',
    },
    globalSettings: {
      ...COMMON_SETTINGS,
      awardsListType: 'ordered',
      experienceListType: 'unordered',
    },
    sections: [
      { id: 'basic', title: '基本信息', guidance: '姓名、申请方向、联系方式和证书状态。' },
      { id: 'education', title: '教育背景', guidance: '学校、专业、GPA、排名和核心课程。' },
      { id: 'experience', title: '实习经历', guidance: '突出行业、交易/项目背景、分析动作和成果。' },
      { id: 'projects', title: '研究/案例项目', guidance: '展示行业研究、估值建模、商业分析或咨询案例。' },
      { id: 'custom_certificates', title: '证书与资格', guidance: '列出 CFA、CPA、FRM、证券从业等进度。' },
      { id: 'skills', title: '分析与工具', guidance: '列出 Excel、Python、SQL、Wind、Bloomberg 等工具。' },
      { id: 'awards', title: '荣誉奖项', guidance: '奖学金、商赛、竞赛和校内荣誉。' },
      { id: 'selfEvaluation', title: '职业优势', guidance: '概括分析能力、抗压能力、沟通和行业兴趣。' },
    ],
  },
  {
    id: 'liberal-arts-media',
    name: '文科 / 行政 / 传媒',
    description: '重心从技术栈转为写作表达、组织协调、内容策划、调研和公共沟通能力。',
    category: '文科综合',
    tags: ['写作表达', '组织协调', '内容作品'],
    bestFor: ['行政 / 人事 / 公共事务', '新媒体与内容岗位', '文科类实习求职'],
    latexTemplateId: 'classic',
    photoPlacement: 'left',
    sampleResume: {
      resumeTitle: '新媒体运营实习生简历',
      basic: {
        name: '陆清禾',
        title: '新媒体运营实习生',
        email: 'luqinghe@example.com',
        phone: '155-9031-4287',
        location: '南京',
        blog: 'https://mp.weixin.qq.com/luqinghe',
      },
      education: [
        {
          id: 'lam_edu_0',
          school: '南京大学',
          major: '新闻传播学',
          degree: '本科',
          startDate: '2022.09',
          endDate: '2026.06',
          description: '<p>主修新闻采访与写作、传播学研究方法、公共关系、社会调查、融合新闻编辑。</p><p>担任校媒专题组编辑，长期负责选题会、采访提纲、稿件编辑和新媒体发布复盘。</p>',
          visible: true,
        },
      ],
      experience: [
        {
          id: 'lam_exp_0',
          company: '澎湃新闻',
          position: '内容运营实习生',
          date: '2025.04 - 2025.08',
          details: '<ul class="custom-list"><li><p>参与城市生活栏目选题策划、采访整理、事实核查和公众号排版发布。</p></li><li><p>独立完成 12 篇图文稿件，覆盖青年夜校、社区更新和公共文化空间等主题。</p></li><li><p>根据标题、封面和发布时间复盘阅读数据，单篇最高阅读 8.6 万。</p></li></ul>',
          visible: true,
        },
        {
          id: 'lam_exp_1',
          company: '南京大学学生发展中心',
          position: '行政助理',
          date: '2024.09 - 2025.01',
          details: '<ul class="custom-list"><li><p>协助奖助学金材料收集、活动通知、场地协调和现场秩序维护，服务 800+ 名学生。</p></li><li><p>整理学生咨询 FAQ 和材料模板，减少重复沟通并提升通知清晰度。</p></li><li><p>优化报名表单和信息核对流程，使材料退回率下降约 18%。</p></li></ul>',
          visible: true,
        },
      ],
      projects: [
        {
          id: 'lam_proj_0',
          name: '高校毕业季专题传播',
          role: '策划与执行',
          date: '2025.05 - 2025.06',
          description: '<ul class="custom-list"><li><p>设计短视频、图文和线下采访组合传播方案，覆盖 6 所高校毕业生故事。</p></li><li><p>统筹采访排期、素材收集、标题测试和平台发布，保证专题连续 4 周更新。</p></li><li><p>专题累计曝光 42 万，互动率较栏目均值提升 31%，形成毕业季内容复盘文档。</p></li></ul>',
          visible: true,
        },
        {
          id: 'lam_proj_1',
          name: '校园公益活动传播',
          role: '项目统筹',
          date: '2024.10 - 2024.12',
          description: '<ul class="custom-list"><li><p>统筹志愿者招募、推文发布、海报文案和现场采访，联动 4 个学生组织完成传播排期。</p></li><li><p>设计报名问卷、社群提醒和活动后反馈表，沉淀可复用的活动执行清单。</p></li><li><p>活动累计报名 520 人，公众号推文打开率达到 18.7%。</p></li></ul>',
          visible: true,
        },
      ],
      openSource: [],
      awards: [
        {
          id: 'lam_award_0',
          title: '校优秀学生记者',
          issuer: '南京大学党委宣传部',
          date: '2024.12',
          description: '年度采写稿件数量与传播效果综合排名前 10%。',
          visible: true,
        },
        {
          id: 'lam_award_1',
          title: '暑期社会实践优秀调研报告',
          issuer: '南京大学团委',
          date: '2024.09',
          description: '报告主题：社区公共文化空间与青年参与。',
          visible: true,
        },
      ],
      customData: {
        custom_works: [
          {
            id: 'lam_work_0',
            title: '深度报道作品',
            subtitle: '《城市夜校里的年轻人》',
            dateRange: '2025.03',
            description: '<p>完成选题、采访、资料核验和成稿，获校媒年度优秀报道，并被学院公众号转载。</p>',
            visible: true,
          },
          {
            id: 'lam_work_1',
            title: '公众号栏目策划',
            subtitle: '《一周校园观察》',
            dateRange: '2024.11 - 2025.01',
            description: '<p>策划 8 期校园生活栏目，负责选题会、采访提纲、标题优化、排版校对和发布复盘。</p>',
            visible: true,
          },
        ],
      },
      selfEvaluation: '<p>文字表达稳定，熟悉内容选题、采访执行、行政协调和多平台传播，能兼顾信息准确性和用户阅读体验。</p><p>做事细致、有节奏感，能够把复杂活动拆成清单、排期、责任人和复盘指标，适合内容运营与综合行政类岗位。</p>',
      skillContent: '<p><strong>内容能力：</strong>选题策划、采访写作、事实核查、公众号运营、短视频脚本、标题优化</p><p><strong>组织协调：</strong>活动排期、志愿者沟通、材料收集、会议纪要、跨部门协作</p><p><strong>工具使用：</strong>秀米、剪映、Canva、Excel、问卷星、飞书表格、公众号后台</p><p><strong>语言能力：</strong>英语 CET-6，具备英文资料检索、摘要整理和双语素材改写能力</p>',
    },
    globalSettings: {
      ...COMMON_SETTINGS,
      experienceListType: 'unordered',
      projectLinkDisplay: 'below',
    },
    sections: [
      { id: 'basic', title: '基本信息', guidance: '姓名、求职方向、联系方式、作品链接。' },
      { id: 'education', title: '教育背景', guidance: '学校、专业、课程、论文或校园经历。' },
      { id: 'experience', title: '实践/实习经历', guidance: '写清角色、组织对象、执行过程和结果。' },
      { id: 'projects', title: '活动/内容项目', guidance: '展示活动策划、内容选题、传播数据或调研成果。' },
      { id: 'custom_works', title: '作品与发表', guidance: '列出文章、报道、策划案、调研报告或出版物。' },
      { id: 'skills', title: '综合能力', guidance: '表达、写作、协调、Office、数据整理和外语能力。' },
      { id: 'awards', title: '荣誉奖项', guidance: '奖学金、竞赛、校级荣誉、社会实践表彰。' },
      { id: 'selfEvaluation', title: '个人陈述', guidance: '概括沟通风格、责任感、执行力和岗位匹配度。' },
    ],
  },
  {
    id: 'research-graduate',
    name: '科研 / 升学',
    description: '面向保研、申博、实验室申请和科研助理，突出研究经历、论文成果和学术能力。',
    category: '学术科研',
    tags: ['科研经历', '论文成果', '研究方法'],
    bestFor: ['保研 / 考研复试', '博士/硕士申请', '科研助理与实验室申请'],
    latexTemplateId: 'classic',
    photoPlacement: 'none',
    sampleResume: {
      resumeTitle: '科研助理申请简历',
      basic: {
        name: '韩若宁',
        title: '科研助理申请',
        email: 'hanruoning@example.com',
        phone: '187-3206-5542',
        location: '武汉',
        blog: 'https://scholar.example.com/hanruoning',
      },
      education: [
        {
          id: 'rg_edu_0',
          school: '华中科技大学',
          major: '生物医学工程',
          degree: '本科',
          startDate: '2021.09',
          endDate: '2025.06',
          gpa: 'GPA 3.9/4.0',
          description: '<p>导师：王明教授；核心课程：机器学习、生物信号处理、医学图像分析、统计学习。</p><p>综合排名 2/128，参与学院本科科研训练计划，长期维护实验记录、代码复现和文献笔记。</p>',
          visible: true,
        },
      ],
      experience: [],
      projects: [
        {
          id: 'rg_proj_0',
          name: '脑电信号睡眠分期模型',
          role: '算法实现',
          date: '2024.09 - 2025.04',
          description: '<ul class="custom-list"><li><p>基于 PyTorch 复现 CNN-Transformer 模型，完成数据清洗、特征提取、标签对齐和交叉验证。</p></li><li><p>设计数据增强与类别重采样实验，比较不同窗口长度和频域特征对分类结果的影响。</p></li><li><p>在公开数据集上 Macro-F1 达到 0.82，整理实验报告、训练日志和可复现代码。</p></li></ul>',
          visible: true,
          link: 'https://github.com/hanruoning/eeg-sleep-stage',
        },
        {
          id: 'rg_proj_1',
          name: '医学影像小样本分类实验',
          role: '数据分析',
          date: '2024.02 - 2024.06',
          description: '<ul class="custom-list"><li><p>整理肺部 CT 小样本数据集，完成匿名化检查、数据增强、类别重采样和训练日志分析。</p></li><li><p>比较 ResNet、DenseNet 与 ViT baseline，记录准确率、召回率和 AUC 指标差异。</p></li><li><p>撰写 12 页课程研究报告，讨论样本不均衡、过拟合和可解释性局限。</p></li></ul>',
          visible: true,
          link: 'https://github.com/hanruoning/medical-few-shot',
        },
      ],
      openSource: [],
      awards: [
        {
          id: 'rg_award_0',
          title: '国家奖学金',
          issuer: '教育部',
          date: '2024.10',
          description: '综合排名 2/128。',
          visible: true,
        },
        {
          id: 'rg_award_1',
          title: '大学生创新训练计划省级立项',
          issuer: '湖北省教育厅',
          date: '2024.05',
          description: '项目方向：多模态生理信号分析与睡眠分期。',
          visible: true,
        },
      ],
      customData: {
        custom_research: [
          {
            id: 'rg_research_0',
            title: '医学图像分割课题',
            subtitle: '实验室科研训练',
            dateRange: '2023.11 - 2024.08',
            description: '<p>参与 U-Net 变体模型训练和消融实验，负责标注质检、指标统计、误差案例分析和论文图表绘制。</p>',
            visible: true,
          },
          {
            id: 'rg_research_1',
            title: '脑机接口文献综述与复现实验',
            subtitle: '本科科研计划',
            dateRange: '2024.09 - 2025.01',
            description: '<p>阅读 35 篇 EEG 分类相关论文，复现两种时频特征提取方法，整理模型结构、数据集和评价指标对比表。</p>',
            visible: true,
          },
        ],
        custom_publications: [
          {
            id: 'rg_pub_0',
            title: 'IEEE EMBC 会议论文',
            subtitle: '第二作者，在投',
            dateRange: '2025',
            description: '<p>论文主题为多模态生理信号睡眠分期，负责实验设计、消融实验、结果分析和图表绘制。</p>',
            visible: true,
          },
          {
            id: 'rg_pub_1',
            title: '本科毕业论文',
            subtitle: '基于深度学习的脑电睡眠分期研究，在写',
            dateRange: '2025',
            description: '<p>完成文献综述、实验设计、初步结果分析和相关工作章节，计划提交学院优秀论文评审。</p>',
            visible: true,
          },
        ],
      },
      selfEvaluation: '<p>关注医学 AI 与生物信号处理，具备实验复现、数据分析、英文论文阅读和科研写作能力。</p><p>习惯维护清晰的实验日志和版本记录，能独立完成文献综述、baseline 复现、指标分析和结果汇报，希望继续参与可解释医学模型研究。</p>',
      skillContent: '<p><strong>研究方法：</strong>实验设计、文献综述、统计分析、模型评估、消融实验、误差分析</p><p><strong>编程工具：</strong>Python、PyTorch、NumPy、Pandas、scikit-learn、MATLAB、Git</p><p><strong>学术写作：</strong>LaTeX、Overleaf、Zotero、英文论文阅读、图表绘制、实验报告整理</p><p><strong>专业方向：</strong>医学图像分析、脑电信号处理、深度学习、小样本分类、可解释性分析</p>',
    },
    globalSettings: {
      ...COMMON_SETTINGS,
      latexMargin: 'relaxed',
      awardsListType: 'ordered',
    },
    sections: [
      { id: 'basic', title: '基本信息', guidance: '姓名、申请方向、联系方式和学术主页。' },
      { id: 'education', title: '教育背景', guidance: '学校、专业、GPA、排名、导师和核心课程。' },
      { id: 'custom_research', title: '科研经历', guidance: '写清课题背景、方法、实验、结果和个人贡献。' },
      { id: 'custom_publications', title: '论文与成果', guidance: '列出论文、专利、海报、会议展示和在投状态。' },
      { id: 'projects', title: '课题/项目', guidance: '展示课程项目、实验项目、数据分析或系统实现。' },
      { id: 'skills', title: '研究方法与工具', guidance: '列出实验技能、统计方法、编程工具和文献工具。' },
      { id: 'awards', title: '奖学金与荣誉', guidance: '奖学金、竞赛、科研训练计划和学术荣誉。' },
      { id: 'selfEvaluation', title: '研究兴趣', guidance: '概括研究方向、问题意识和未来计划。' },
    ],
  },
]

const DEFAULT_SECTION_BY_ID = new Map(initialResumeData.menuSections.map((section) => [section.id, section]))

function createMenuSections(template: ResumeDirectionTemplate): MenuSection[] {
  return template.sections.map((section, index) => {
    const base = DEFAULT_SECTION_BY_ID.get(section.id)
    return {
      id: section.id,
      title: section.title,
      icon: section.icon || base?.icon || '•',
      enabled: section.enabled !== false,
      order: index,
    }
  })
}

function createCustomData(template: ResumeDirectionTemplate): ResumeData['customData'] {
  return template.sections.reduce<ResumeData['customData']>((acc, section) => {
    if (section.id.startsWith('custom_')) {
      acc[section.id] = []
    }
    return acc
  }, {})
}

function cloneResumeItems<T extends { id: string }>(items: T[] = []): T[] {
  const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  return items.map((item, index) => ({
    ...structuredClone(item),
    id: `${item.id}_${nonce}_${index}`,
  }))
}

function createSampleCustomData(template: ResumeDirectionTemplate): ResumeData['customData'] {
  const customData = createCustomData(template)
  const sampleCustomData = template.sampleResume?.customData || {}

  Object.entries(sampleCustomData).forEach(([sectionId, items]) => {
    customData[sectionId] = cloneResumeItems(items)
  })

  return customData
}

export function getResumeDirectionTemplate(templateId?: string | null): ResumeDirectionTemplate {
  return (
    RESUME_DIRECTION_TEMPLATES.find((template) => template.id === templateId) ||
    RESUME_DIRECTION_TEMPLATES.find((template) => template.id === DEFAULT_RESUME_DIRECTION_TEMPLATE_ID) ||
    RESUME_DIRECTION_TEMPLATES[0]
  )
}

export function resolveDirectionTemplateEngine(template: ResumeDirectionTemplate): ResumeRenderEngine {
  return template.renderEngine || 'latex'
}

export function resolveDirectionTemplateRenderTemplateId(template: ResumeDirectionTemplate): string {
  const renderEngine = resolveDirectionTemplateEngine(template)
  if (renderEngine === 'html') {
    return normalizeHtmlTemplateId(template.renderTemplateId)
  }
  return normalizeLatexTemplateId(template.renderTemplateId || template.latexTemplateId)
}

export function createResumeFromDirectionTemplate(templateId?: string | null): ResumeData {
  const template = getResumeDirectionTemplate(templateId)
  const renderEngine = resolveDirectionTemplateEngine(template)
  const renderTemplateId = resolveDirectionTemplateRenderTemplateId(template)
  const now = new Date().toISOString()
  const base = structuredClone(initialResumeData)

  if (!template.sampleResume) {
    return {
      ...base,
      id: `resume_${Date.now()}`,
      title: `${template.name}简历`,
      createdAt: now,
      updatedAt: now,
      templateId: renderTemplateId,
      templateType: renderEngine,
      directionTemplateId: template.id,
      basic: {
        ...base.basic,
        name: '',
        title: '',
        email: '',
        phone: '',
        location: '',
      },
      education: [],
      experience: [],
      projects: [],
      openSource: [],
      awards: [],
      customData: createCustomData(template),
      selfEvaluation: '',
      skillContent: '',
      activeSection: 'basic',
      draggingProjectId: null,
      menuSections: createMenuSections(template),
      globalSettings: {
        ...base.globalSettings,
        ...template.globalSettings,
        photoPlacement: template.photoPlacement,
      },
    }
  }

  return {
    ...base,
    id: `resume_${Date.now()}`,
    title: template.sampleResume.resumeTitle || `${template.sampleResume.basic.title}简历`,
    createdAt: now,
    updatedAt: now,
    templateId: renderTemplateId,
    templateType: renderEngine,
    directionTemplateId: template.id,
    basic: structuredClone(template.sampleResume.basic),
    education: cloneResumeItems(template.sampleResume.education),
    experience: cloneResumeItems(template.sampleResume.experience),
    projects: cloneResumeItems(template.sampleResume.projects),
    openSource: cloneResumeItems(template.sampleResume.openSource || []),
    awards: cloneResumeItems(template.sampleResume.awards || []),
    customData: createSampleCustomData(template),
    selfEvaluation: template.sampleResume.selfEvaluation,
    skillContent: template.sampleResume.skillContent,
    activeSection: 'basic',
    draggingProjectId: null,
    menuSections: createMenuSections(template),
    globalSettings: {
      ...base.globalSettings,
      ...template.globalSettings,
      photoPlacement: template.photoPlacement,
    },
  }
}

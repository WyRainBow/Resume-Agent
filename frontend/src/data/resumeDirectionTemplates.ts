import { initialResumeData } from '@/pages/Workspace/v2/constants'
import type { GlobalSettings, MenuSection, ResumeData } from '@/pages/Workspace/v2/types'
import { normalizeLatexTemplateId } from '@/services/resumeTemplates'

export type PhotoPlacement = 'left' | 'right' | 'none'

export interface ResumeDirectionSection {
  id: string
  title: string
  guidance: string
  enabled?: boolean
  icon?: string
}

export interface ResumeDirectionTemplate {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  bestFor: string[]
  latexTemplateId?: string
  photoPlacement: PhotoPlacement
  sections: ResumeDirectionSection[]
  globalSettings?: Partial<GlobalSettings>
}

export const DEFAULT_RESUME_DIRECTION_TEMPLATE_ID = 'software-engineering'

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
    id: 'product-operations',
    name: '产品 / 运营',
    description: '强调用户洞察、数据分析、需求推进、活动运营和增长结果。',
    category: '互联网业务',
    tags: ['产品方法', '运营案例', '数据分析'],
    bestFor: ['产品经理实习', '用户运营 / 内容运营', '增长与商业分析岗位'],
    latexTemplateId: 'compact',
    photoPlacement: 'right',
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

export function getResumeDirectionTemplate(templateId?: string | null): ResumeDirectionTemplate {
  return (
    RESUME_DIRECTION_TEMPLATES.find((template) => template.id === templateId) ||
    RESUME_DIRECTION_TEMPLATES.find((template) => template.id === DEFAULT_RESUME_DIRECTION_TEMPLATE_ID) ||
    RESUME_DIRECTION_TEMPLATES[0]
  )
}

export function createResumeFromDirectionTemplate(templateId?: string | null): ResumeData {
  const template = getResumeDirectionTemplate(templateId)
  const now = new Date().toISOString()
  const base = structuredClone(initialResumeData)

  return {
    ...base,
    id: `resume_${Date.now()}`,
    title: `${template.name}简历`,
    createdAt: now,
    updatedAt: now,
    templateId: normalizeLatexTemplateId(template.latexTemplateId),
    templateType: 'latex',
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

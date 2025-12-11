/**
 * ResumeEditor 常量配置
 */
import type { ResumeSection } from './types'

export const defaultSections: ResumeSection[] = [
  { id: 'contact', type: 'contact', title: '个人信息', icon: '👤', data: {} },
  { id: 'education', type: 'education', title: '教育经历', icon: '🎓', data: [] },
  { id: 'experience', type: 'experience', title: '工作经历', icon: '💼', data: [] },
  { id: 'projects', type: 'projects', title: '项目经历', icon: '🚀', data: [] },
  { id: 'opensource', type: 'opensource', title: '开源经历', icon: '🌐', data: [] },
  { id: 'skills', type: 'skills', title: '专业技能', icon: '⚡', data: [] },
  { id: 'awards', type: 'awards', title: '荣誉奖项', icon: '🏆', data: [] },
  { id: 'summary', type: 'summary', title: '个人总结', icon: '📝', data: '' },
]

// AI 导入提示词占位符
export const aiImportPlaceholders: Record<string, string> = {
  contact: '张三\n电话: 13800138000\n邮箱: zhangsan@example.com\n地区: 北京\n求职意向: 后端开发工程师',
  education: '华南理工大学\n本科 · 计算机科学与技术\n2020.09 - 2024.06\nGPA: 3.8/4.0',
  experience: '字节跳动 · 后端开发实习生\n2023.06 - 2023.09\n- 负责推荐系统后端开发\n- 优化接口性能，QPS 提升 50%',
  projects: '智能简历系统\n技术负责人 · 2023.01 - 2023.06\n- 使用 React + FastAPI 开发\n- 集成 AI 自动生成功能\nGitHub: https://github.com/xxx/resume',
  skills: '编程语言: Java, Python, Go\n数据库: MySQL, Redis, MongoDB\n框架: Spring Boot, FastAPI',
  awards: '国家奖学金 · 2023\nACM 省级一等奖 · 2022\n优秀毕业生 · 2024',
  summary: '3年后端开发经验，熟悉 Java/Go 技术栈，擅长高并发系统设计与优化，有丰富的微服务架构经验。',
  opensource: 'Kubernetes\n核心贡献者\n- 提交性能优化 PR，被成功合并\n- 修复关键 Bug\n仓库: https://github.com/kubernetes/kubernetes'
}

// 通用样式
export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: '8px',
  color: 'white',
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 0.2s',
  marginBottom: '12px',
}

export const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'rgba(255, 255, 255, 0.7)',
  fontSize: '12px',
  marginBottom: '6px',
  marginTop: '8px',
}

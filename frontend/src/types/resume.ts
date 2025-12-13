/**
 * @file 根据新的 LaTeX 模板，重新定义简历的数据结构
 */

/**
 * 带日期的条目，用于实习经历
 */
export interface DatedEntry {
  title: string;
  subtitle?: string; // 如：'某职位'
  date: string;
}

/**
 * 项目经验中的子项目或描述块
 */
export interface ProjectItem {
  title: string;
  details: string[];
}

/**
 * 项目经验
 */
export interface Project {
  title: string;
  items: ProjectItem[];
}

/**
 * 开源经历
 */
export interface OpenSourceContribution {
  title: string;
  subtitle?: string; // 如：'某分布式项目'
  items: string[];
}

/**
 * 专业技能条目
 */
export interface Skill {
  category: string; // 如：'后端'
  details: string;
}

/**
 * 教育经历
 */
export interface Education {
  title: string;      // 学校名称
  subtitle?: string;  // 专业
  degree?: string;    // 学位（本科、硕士等）
  date: string;
  details?: string[];
  honors?: string;
}

/**
 * 模块标题配置
 */
export interface SectionTitles {
  education?: string;      // 默认：教育经历
  experience?: string;     // 默认：工作经历
  internships?: string;    // 默认：实习经历
  projects?: string;       // 默认：项目经历
  skills?: string;         // 默认：专业技能
  awards?: string;         // 默认：荣誉奖项
  summary?: string;        // 默认：个人总结
  openSource?: string;     // 默认：开源贡献
}

/**
 * 完整的简历数据结构
 */
export interface Resume {
  name: string;
  contact: {
    phone?: string;
    email?: string;
    role?: string;
    location?: string;
  };
  objective?: string;
  internships?: DatedEntry[];
  projects?: Project[];
  openSource?: OpenSourceContribution[];
  skills?: (Skill | string)[];
  education?: Education[];
  awards?: string[];
  summary?: string;
  sectionTitles?: SectionTitles;  // 自定义模块标题
}

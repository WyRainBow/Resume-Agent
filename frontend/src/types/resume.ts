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
  title: string; // 如：'某高校 - 某专业 - 本科'
  date: string;
  honors?: string;
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
}

/**
 * 简历预览面板组件
 *
 * 实时显示简历内容，支持模块高亮
 * 使用与 Workspace v2 相同的 HTMLTemplateRenderer
 */

import React from 'react';
import { HTMLTemplateRenderer } from '@/pages/Workspace/v2/HTMLTemplateRenderer';
import type { ResumeData } from '@/pages/Workspace/v2/types';

interface ResumePreviewPanelProps {
  resumeData: ResumeData | any;
  highlightModule?: string | null;
}

export function ResumePreviewPanel({ resumeData, highlightModule }: ResumePreviewPanelProps) {
  // 数据为空时的显示
  if (!resumeData) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 h-full flex items-center justify-center">
        <div className="text-center text-gray-400">
          <p>暂无简历数据</p>
          <p className="text-sm mt-2">请先创建或加载简历</p>
        </div>
      </div>
    );
  }

  // 将旧格式转换为新格式（兼容性处理）
  const normalizedData: ResumeData = normalizeResumeData(resumeData);

  return (
    <div className="h-full flex flex-col bg-slate-100/80">
      {/* 顶部提示条 */}
      <div className="h-10 bg-white border-b border-gray-200 px-4 flex items-center justify-center text-sm text-gray-500 shrink-0">
        {highlightModule ? `正在优化: ${getModuleName(highlightModule)}` : '简历预览'}
      </div>

      {/* 预览内容区 */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white shadow-xl w-[700px] max-w-full mx-auto rounded-lg overflow-hidden">
          <HTMLTemplateRenderer resumeData={normalizedData} />
        </div>
      </div>
    </div>
  );
}

/**
 * 将各种简历数据格式标准化为 ResumeData
 */
function normalizeResumeData(data: any): ResumeData {
  // 如果已经是新格式，直接返回
  if (data.id && data.basic && data.menuSections) {
    return data as ResumeData;
  }

  // 旧格式转换为新格式
  const oldData = data;

  return {
    id: oldData.id || 'resume_preview',
    title: oldData.title || oldData.name || '未命名简历',
    createdAt: oldData.createdAt || new Date().toISOString(),
    updatedAt: oldData.updatedAt || new Date().toISOString(),
    templateId: oldData.templateId || 'default',
    templateType: oldData.templateType || 'html',

    // 基本信息
    basic: oldData.basic || {
      name: oldData.name || '未命名',
      title: oldData.headline || oldData.basic?.title || '求职者',
      email: oldData.email || oldData.basic?.email || '',
      phone: oldData.phone || oldData.basic?.phone || '',
      location: oldData.location || oldData.basic?.location || '',
      employementStatus: oldData.employementStatus || oldData.basic?.employementStatus || '',
    },

    // 教育经历
    education: normalizeEducation(oldData.education || oldData.sections?.education?.items || oldData.sections?.education || []),

    // 工作经历
    experience: normalizeExperience(oldData.experience || oldData.sections?.experience?.items || oldData.sections?.experience || []),

    // 项目经历
    projects: normalizeProjects(oldData.projects || oldData.sections?.projects?.items || oldData.sections?.projects || []),

    // 开源经历（默认空）
    openSource: oldData.openSource || [],

    // 荣誉奖项（默认空）
    awards: oldData.awards || [],

    // 自定义数据
    customData: oldData.customData || {},

    // 自我评价
    selfEvaluation: typeof oldData.selfEvaluation === 'string'
      ? oldData.selfEvaluation
      : (typeof oldData.summary === 'string' ? `<p>${oldData.summary}</p>` : ''),

    // 技能内容（HTML 格式）
    skillContent: normalizeSkills(oldData.skills || oldData.sections?.skills?.items || oldData.sections?.skills || []),

    // 其他必需字段
    activeSection: oldData.activeSection || 'basic',
    draggingProjectId: null,
    menuSections: oldData.menuSections || getDefaultMenuSections(),
    globalSettings: oldData.globalSettings || {},
  };
}

/**
 * 标准化教育经历数据
 */
function normalizeEducation(data: any[]): any[] {
  if (!Array.isArray(data)) return [];

  return data.map((item, index) => ({
    id: item.id || `edu_${index}`,
    school: item.school || '',
    major: item.major || '',
    degree: item.degree || '',
    startDate: item.startDate || '',
    endDate: item.endDate || '',
    gpa: item.gpa || '',
    description: item.summary || item.description || '',
    visible: item.visible !== false,
  }));
}

/**
 * 标准化工作经历数据
 */
function normalizeExperience(data: any[]): any[] {
  if (!Array.isArray(data)) return [];

  return data.map((item, index) => ({
    id: item.id || `exp_${index}`,
    company: item.company || '',
    position: item.position || item.title || '',
    date: `${item.startDate || ''} ~ ${item.endDate || ''}`,
    details: item.summary || item.details || item.description || '',
    visible: item.visible !== false,
  }));
}

/**
 * 标准化项目经历数据
 */
function normalizeProjects(data: any[]): any[] {
  if (!Array.isArray(data)) return [];

  return data.map((item, index) => ({
    id: item.id || `proj_${index}`,
    name: item.name || '',
    role: item.role || '项目成员',
    date: item.date || item.startDate || '',
    description: item.description || item.summary || '',
    visible: item.visible !== false,
    link: item.link || item.repo || '',
  }));
}

/**
 * 标准化技能数据为 HTML 格式
 */
function normalizeSkills(data: any): string {
  if (typeof data === 'string') return data;

  if (Array.isArray(data)) {
    // 如果是对象数组，提取名称
    const skills = data.map(s => typeof s === 'string' ? s : s.name || s).join('、');
    return `<p>${skills}</p>`;
  }

  return '';
}

/**
 * 获取默认模块配置
 */
function getDefaultMenuSections() {
  return [
    { id: 'basic', title: '基本信息', icon: '👤', enabled: true, order: 0 },
    { id: 'selfEvaluation', title: '自我评价', icon: '📝', enabled: true, order: 1 },
    { id: 'skills', title: '专业技能', icon: '⚡', enabled: true, order: 2 },
    { id: 'experience', title: '工作经历', icon: '💼', enabled: true, order: 3 },
    { id: 'projects', title: '项目经历', icon: '🚀', enabled: true, order: 4 },
    { id: 'education', title: '教育经历', icon: '🎓', enabled: true, order: 5 },
  ];
}

/**
 * 获取模块中文名称
 */
function getModuleName(module: string): string {
  const names: Record<string, string> = {
    'summary': '个人总结',
    'experience': '工作经历',
    'projects': '项目经历',
    'education': '教育经历',
    'skills': '技能',
    'basic': '基本信息',
    'openSource': '开源经历',
    'awards': '荣誉奖项',
  };
  return names[module] || module;
}

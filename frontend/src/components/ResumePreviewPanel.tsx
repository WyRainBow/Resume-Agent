/**
 * 简历预览面板组件
 *
 * 实时显示简历内容，支持模块高亮
 */

import React from 'react';

interface ResumePreviewPanelProps {
  resumeData: any;
  highlightModule?: string | null;
}

export function ResumePreviewPanel({ resumeData, highlightModule }: ResumePreviewPanelProps) {
  const getModuleHighlightClass = (module: string) => {
    return highlightModule === module
      ? 'bg-purple-100 border-l-4 border-purple-600 -ml-2 pl-4'
      : '';
  };

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

  // 提取数据（兼容新旧格式）
  const basic = resumeData.basic || resumeData?.sections?.basic || {};
  const summary = resumeData.summary || resumeData?.sections?.summary?.content || resumeData?.sections?.summary || '';
  const experience = resumeData.experience || resumeData?.sections?.experience?.items || resumeData?.sections?.experience || [];
  const projects = resumeData.projects || resumeData?.sections?.projects?.items || resumeData?.sections?.projects || [];
  const education = resumeData.education || resumeData?.sections?.education?.items || resumeData?.sections?.education || [];
  const skills = resumeData.skills || resumeData?.sections?.skills?.items || resumeData?.sections?.skills || [];

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 h-full overflow-y-auto">
      <div className="mb-4 pb-4 border-b">
        <h2 className="text-xl font-bold text-gray-900">
          {basic.name || '未命名简历'}
        </h2>
        {basic.headline && (
          <p className="text-sm text-gray-600 mt-1">{basic.headline}</p>
        )}
        <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
          {basic.email && <span>📧 {basic.email}</span>}
          {basic.phone && <span>📱 {basic.phone}</span>}
          {basic.location && <span>📍 {basic.location}</span>}
        </div>
      </div>

      {/* 个人总结 */}
      {summary && (
        <div className={`mb-4 ${getModuleHighlightClass('summary')}`}>
          <h3 className="font-semibold text-gray-900 mb-2">📝 个人总结</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{summary}</p>
        </div>
      )}

      {/* 工作经历 */}
      {experience.length > 0 && (
        <div className={`mb-4 ${getModuleHighlightClass('experience')}`}>
          <h3 className="font-semibold text-gray-900 mb-2">💼 工作经历</h3>
          <div className="space-y-3">
            {experience.map((exp: any, index: number) => (
              <div key={index} className="text-sm">
                <div className="font-medium text-gray-900">
                  {exp.company} - {exp.title}
                </div>
                <div className="text-xs text-gray-500 mb-1">
                  {exp.startDate && exp.endDate
                    ? `${exp.startDate} - ${exp.endDate}`
                    : exp.startDate || exp.endDate}
                </div>
                {exp.summary && (
                  <p className="text-gray-700 text-xs mt-1 whitespace-pre-wrap">
                    {exp.summary}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 项目经历 */}
      {projects.length > 0 && (
        <div className={`mb-4 ${getModuleHighlightClass('projects')}`}>
          <h3 className="font-semibold text-gray-900 mb-2">🚀 项目经历</h3>
          <div className="space-y-3">
            {projects.map((project: any, index: number) => (
              <div key={index} className="text-sm">
                <div className="font-medium text-gray-900">{project.name}</div>
                {project.description && (
                  <p className="text-gray-700 text-xs mt-1 whitespace-pre-wrap">
                    {project.description}
                  </p>
                )}
                {project.tech_stack && (
                  <div className="text-xs text-gray-500 mt-1">
                    技术: {Array.isArray(project.tech_stack)
                      ? project.tech_stack.join(', ')
                      : project.tech_stack}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 教育经历 */}
      {education.length > 0 && (
        <div className={`mb-4 ${getModuleHighlightClass('education')}`}>
          <h3 className="font-semibold text-gray-900 mb-2">🎓 教育经历</h3>
          <div className="space-y-3">
            {education.map((edu: any, index: number) => (
              <div key={index} className="text-sm">
                <div className="font-medium text-gray-900">
                  {edu.school} - {edu.degree}
                </div>
                <div className="text-xs text-gray-500">
                  {edu.major && `${edu.major} | `}
                  {edu.startDate && edu.endDate
                    ? `${edu.startDate} - ${edu.endDate}`
                    : edu.startDate || edu.endDate}
                </div>
                {edu.gpa && <div className="text-xs text-gray-600 mt-1">GPA: {edu.gpa}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 技能 */}
      {skills.length > 0 && (
        <div className={`mb-4 ${getModuleHighlightClass('skills')}`}>
          <h3 className="font-semibold text-gray-900 mb-2">⚡ 技能</h3>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill: any, index: number) => (
              <span
                key={index}
                className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded"
              >
                {typeof skill === 'string' ? skill : skill.name || skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 如果简历为空 */}
      {!summary && experience.length === 0 && projects.length === 0 && education.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          <p>简历内容为空</p>
          <p className="text-sm mt-2">开始优化以填充内容</p>
        </div>
      )}
    </div>
  );
}

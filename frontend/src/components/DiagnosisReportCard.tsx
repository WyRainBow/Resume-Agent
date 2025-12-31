/**
 * 诊断报告卡片组件
 *
 * 展示简历诊断结果和优化建议
 */

import React from 'react';

interface DiagnosisReportCardProps {
  data: {
    overall_score: number;
    diagnosis_level: string;
    dimensions: any;
    priority_issues: any[];
    optimization_path: string[];
    message?: string;
  };
}

export function DiagnosisReportCard({ data }: DiagnosisReportCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    if (score >= 0.4) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreEmoji = (score: number) => {
    if (score >= 0.8) return '🎉';
    if (score >= 0.6) return '👍';
    if (score >= 0.4) return '💪';
    return '📝';
  };

  const getIssueIcon = (level: string) => {
    switch (level) {
      case 'critical': return '❌';
      case 'high': return '⚠️';
      case 'medium': return '💡';
      case 'low': return 'ℹ️';
      default: return '•';
    }
  };

  const getIssueColor = (level: string) => {
    switch (level) {
      case 'critical': return 'border-red-200 bg-red-50';
      case 'high': return 'border-orange-200 bg-orange-50';
      case 'medium': return 'border-yellow-200 bg-yellow-50';
      case 'low': return 'border-blue-200 bg-blue-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getDimensionName = (key: string) => {
    const names: Record<string, string> = {
      'completeness': '完整性',
      'content_quality': '内容质量',
      'structure': '结构格式',
      'relevance': '匹配度'
    };
    return names[key] || key;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 my-4 shadow-sm">
      {/* 标题 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          📊 简历诊断报告
        </h3>
        <div className={`text-2xl font-bold ${getScoreColor(data.overall_score)}`}>
          {getScoreEmoji(data.overall_score)}
          {Math.round(data.overall_score * 100)}分
        </div>
      </div>

      {/* 总体评价 - 由外层消息显示，此处移除避免重复 */}

      {/* 发现的主要问题 */}
      {data.priority_issues && data.priority_issues.length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-900 mb-3">发现的主要问题：</h4>
          <div className="space-y-2">
            {data.priority_issues.map((issue, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${getIssueColor(issue.level)}`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg">{getIssueIcon(issue.level)}</span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{issue.description}</p>
                    {issue.suggestion && (
                      <p className="text-sm text-gray-600 mt-1">{issue.suggestion}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 建议的优化路径 */}
      {data.optimization_path && data.optimization_path.length > 0 && (
        <div className="mb-4">
          <h4 className="font-semibold text-gray-900 mb-3">建议的优化路径：</h4>
          <div className="space-y-2">
            {data.optimization_path.map((step, index) => (
              <div key={index} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
                <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs flex items-center justify-center font-semibold">
                  {index + 1}
                </div>
                <p className="text-gray-700 text-sm">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 维度详情（可折叠） */}
      {data.dimensions && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
            查看详细诊断维度 ↓
          </summary>
          <div className="mt-3 space-y-2 pl-4 border-l-2 border-gray-200">
            {Object.entries(data.dimensions).map(([key, dimension]: [string, any]) => (
              <div key={key} className="py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">
                    {getDimensionName(key)}
                  </span>
                  <span className="text-sm text-gray-500">
                    {Math.round(dimension.score * 100)}%
                  </span>
                </div>
                {dimension.issues && dimension.issues.length > 0 && (
                  <div className="text-xs text-gray-500 pl-2">
                    {dimension.issues.length} 个问题
                  </div>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

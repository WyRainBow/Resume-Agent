/**
 * 引导选项卡片组件
 *
 * 展示优化选项，用户点击选择
 */

import React from 'react';
import { Sparkles, Briefcase, FolderOpen, GraduationCap, Code } from 'lucide-react';

interface GuidanceChoicesCardProps {
  choices: {
    id: string;
    text: string;
    priority: string;
    reason: string;
    module?: string;
  }[];
  onChoiceClick: (choice: any) => void;
}

export function GuidanceChoicesCard({ choices, onChoiceClick }: GuidanceChoicesCardProps) {
  const getIcon = (module?: string) => {
    switch (module) {
      case 'summary':
        return <Sparkles className="h-5 w-5" />;
      case 'experience':
        return <Briefcase className="h-5 w-5" />;
      case 'projects':
        return <FolderOpen className="h-5 w-5" />;
      case 'education':
        return <GraduationCap className="h-5 w-5" />;
      case 'skills':
        return <Code className="h-5 w-5" />;
      default:
        return <Sparkles className="h-5 w-5" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'border-red-300 hover:border-red-400 hover:bg-red-50';
      case 'high':
        return 'border-orange-300 hover:border-orange-400 hover:bg-orange-50';
      case 'medium':
        return 'border-yellow-300 hover:border-yellow-400 hover:bg-yellow-50';
      default:
        return 'border-purple-300 hover:border-purple-400 hover:bg-purple-50';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">重要</span>;
      case 'high':
        return <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">推荐</span>;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 my-4 shadow-sm">
      <h4 className="font-semibold text-gray-900 mb-4">您想从哪个方面开始优化？</h4>

      <div className="space-y-3">
        {choices.map((choice, index) => (
          <button
            key={choice.id || index}
            onClick={() => onChoiceClick(choice)}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${getPriorityColor(
              choice.priority
            )} group`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-purple-600">
                {getIcon(choice.module)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-gray-900 group-hover:text-purple-700">
                    {choice.text}
                  </p>
                  {getPriorityBadge(choice.priority)}
                </div>
                {choice.reason && (
                  <p className="text-sm text-gray-600">💡 {choice.reason}</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500 text-center">
          您也可以直接输入，告诉我您想优化哪个模块
        </p>
      </div>
    </div>
  );
}

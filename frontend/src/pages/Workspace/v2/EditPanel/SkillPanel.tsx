/**
 * 专业技能编辑面板
 */
import { Wand2 } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import RichEditor from '../shared/RichEditor'

import type { ResumeData } from '../../types'

interface SkillPanelProps {
  skillContent: string
  onUpdate: (content: string) => void
  onAIImport?: () => void
  resumeData?: ResumeData
}

const SkillPanel = ({ skillContent, onUpdate, onAIImport, resumeData }: SkillPanelProps) => {
  return (
    <div
      className={cn(
        'space-y-4 px-4 py-4 rounded-lg',
        'bg-white dark:bg-neutral-900/30'
      )}
    >
      {/* AI 导入按钮 */}
      {onAIImport && (
        <button
          onClick={onAIImport}
          className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-purple-400 to-pink-500 hover:from-pink-500 hover:to-purple-400 text-white shadow-md transition-all duration-300 flex items-center justify-center gap-2"
        >
          <Wand2 className="w-4 h-4" />
          AI 导入技能
        </button>
      )}

      {/* 技能编辑器 */}
      <div className="space-y-2">
        <label className="text-sm text-gray-600 dark:text-neutral-300">
          专业技能
        </label>
        <RichEditor
          content={skillContent}
          onChange={onUpdate}
          placeholder="请描述你的专业技能..."
          resumeData={resumeData}
          polishPath="skillContent"
        />
      </div>

      {/* 提示 */}
      <p className="text-xs text-gray-400 dark:text-neutral-500">
        提示：可以使用加粗突出重点技能，使用列表分类展示
      </p>
    </div>
  )
}

export default SkillPanel



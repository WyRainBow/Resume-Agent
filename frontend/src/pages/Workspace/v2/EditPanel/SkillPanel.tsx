/**
 * 专业技能编辑面板
 */
import { motion } from 'framer-motion'
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'space-y-4 px-4 py-4 rounded-lg',
        'bg-white dark:bg-neutral-900/30'
      )}
    >
      {/* AI 导入按钮 */}
      {onAIImport && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05, ease: 'easeOut' }}
          onClick={onAIImport}
          className="w-full px-4 py-2 rounded-lg bg-white text-black border border-slate-300 hover:bg-slate-50 shadow-sm transition-all duration-300 flex items-center justify-center gap-2"
        >
          <Wand2 className="w-4 h-4" />
          AI 导入技能
        </motion.button>
      )}

      {/* 技能编辑器 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.1, ease: 'easeOut' }}
        className="space-y-2"
      >
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
      </motion.div>

      {/* 提示 */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2, ease: 'easeOut' }}
        className="text-xs text-gray-400 dark:text-neutral-500"
      >
        提示：可以使用加粗突出重点技能，使用列表分类展示
      </motion.p>
    </motion.div>
  )
}

export default SkillPanel



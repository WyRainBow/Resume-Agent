import React from 'react'
import { useResumeContext } from '../../contexts/ResumeContext'
import type { ResumeData } from '@/pages/Workspace/v2/types'

interface Props {
  resume:    ResumeData
  summary:   string
  onDismiss: () => void
}

export function ResumeGeneratedCard({ resume, summary, onDismiss }: Props) {
  const { setResume } = useResumeContext()

  return (
    <div className="rounded-lg border border-purple-200 dark:border-purple-900/50 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden my-2">
      <div className="px-4 py-3 bg-purple-50 dark:bg-purple-950/30">
        <div className="text-sm font-medium text-purple-800 dark:text-purple-300">{summary}</div>
        <div className="text-xs text-purple-500 dark:text-purple-400/80 mt-0.5">
          {resume.basic?.name} · {resume.experience?.length ?? 0} 段工作经历
        </div>
      </div>
      <div className="flex gap-2 px-4 py-3">
        <button
          onClick={() => { setResume(resume); onDismiss() }}
          className="flex-1 rounded-md bg-purple-600 text-white text-sm py-1.5 hover:bg-purple-700 active:scale-[0.98] transition-all"
        >
          导入到编辑器
        </button>
        <button
          onClick={onDismiss}
          className="flex-1 rounded-md border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-neutral-300 text-sm py-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800 active:scale-[0.98] transition-all"
        >
          放弃
        </button>
      </div>
    </div>
  )
}

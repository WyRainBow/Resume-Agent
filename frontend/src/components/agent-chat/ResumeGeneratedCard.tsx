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
    <div className="rounded-lg border border-purple-200 bg-white shadow-sm overflow-hidden my-2">
      <div className="px-4 py-3 bg-purple-50">
        <div className="text-sm font-medium text-purple-800">{summary}</div>
        <div className="text-xs text-purple-500 mt-0.5">
          {resume.basic?.name} · {resume.experience?.length ?? 0} 段工作经历
        </div>
      </div>
      <div className="flex gap-2 px-4 py-3">
        <button
          onClick={() => { setResume(resume); onDismiss() }}
          className="flex-1 rounded-md bg-purple-600 text-white text-sm py-1.5 hover:bg-purple-700 transition-colors"
        >
          导入到编辑器
        </button>
        <button
          onClick={onDismiss}
          className="flex-1 rounded-md border border-gray-300 text-gray-600 text-sm py-1.5 hover:bg-gray-100 transition-colors"
        >
          放弃
        </button>
      </div>
    </div>
  )
}

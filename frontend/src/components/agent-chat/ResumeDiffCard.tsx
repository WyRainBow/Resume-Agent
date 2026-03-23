import React from 'react'
import { useResumeContext, type PendingPatch } from '../../contexts/ResumeContext'

export function ResumeDiffCard({ patch }: { patch: PendingPatch }) {
  const { applyPatch, rejectPatch } = useResumeContext()

  const beforeText = (patch.before as any)._raw ?? JSON.stringify(patch.before, null, 2)
  const afterText  = (patch.after  as any)._raw ?? JSON.stringify(patch.after,  null, 2)

  if (patch.status === 'applied') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
        ✓ 已应用：{patch.summary}
      </div>
    )
  }
  if (patch.status === 'rejected') {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-400 line-through">
        {patch.summary}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-white shadow-sm overflow-hidden my-2">
      <div className="px-4 py-2 bg-blue-50 text-sm font-medium text-blue-800">
        {patch.summary}
      </div>
      <div className="grid grid-cols-2 divide-x divide-gray-200">
        <div className="p-3">
          <div className="text-xs text-gray-400 mb-1">修改前</div>
          <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words">{beforeText}</pre>
        </div>
        <div className="p-3">
          <div className="text-xs text-gray-400 mb-1">修改后</div>
          <pre className="text-xs text-gray-800 whitespace-pre-wrap break-words font-medium">{afterText}</pre>
        </div>
      </div>
      <div className="flex gap-2 px-4 py-3 bg-gray-50 border-t border-gray-100">
        <button
          onClick={() => applyPatch(patch.patch_id)}
          className="flex-1 rounded-md bg-blue-600 text-white text-sm py-1.5 hover:bg-blue-700 transition-colors"
        >
          ✓ 应用
        </button>
        <button
          onClick={() => rejectPatch(patch.patch_id)}
          className="flex-1 rounded-md border border-gray-300 text-gray-600 text-sm py-1.5 hover:bg-gray-100 transition-colors"
        >
          ✗ 拒绝
        </button>
      </div>
    </div>
  )
}

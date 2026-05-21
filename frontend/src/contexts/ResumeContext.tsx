import React, { createContext, useContext, useState, useCallback } from 'react'
import type { ResumeData } from '@/pages/Workspace/v2/types'
import { applyPatchPaths, inferPatchOperation, type ResumePatchOperation } from '@/utils/resumePatch'
import { saveResume } from '@/services/resumeStorage'

export type PendingPatchStatus = 'pending' | 'applied' | 'rejected' | 'superseded'

export interface PendingPatch {
  patch_id:   string
  message_id: string
  paths:      string[]
  before:     Record<string, any>
  after:      Record<string, any>
  summary:    string
  operation?: ResumePatchOperation
  status:     PendingPatchStatus
}

interface ResumeContextValue {
  resume:         ResumeData | null
  pendingPatches: PendingPatch[]
  patchAppliedAt: number        // timestamp bumped after each applyPatch — lets consumers trigger PDF re-render
  setResume:      (r: ResumeData | null) => void
  pushPatch:      (patch: Omit<PendingPatch, 'status'>) => void
  applyPatch:     (patch_id: string) => void
  rejectPatch:    (patch_id: string) => void
  /** 把所有当前 pending 的 patch 标记为 superseded（新一轮消息开始时调用）。 */
  supersedePendingPatches: () => void
  /** 完整清理所有 patch（切换会话或退出时调用）。 */
  clearAllPatches: () => void
  /** 把 message_id === 'current' 的 patch 绑定到最终的 message id。 */
  rebindCurrentPatches: (newMessageId: string) => void
}

const ResumeContext = createContext<ResumeContextValue | null>(null)

export function ResumeProvider({ children }: { children: React.ReactNode }) {
  const [resume, setResumeState] = useState<ResumeData | null>(null)
  const [pendingPatches, setPendingPatches] = useState<PendingPatch[]>([])
  const [patchAppliedAt, setPatchAppliedAt] = useState(0)

  const persistResume = useCallback((payload: ResumeData) => {
    const resumeId =
      (payload as any).resume_id ??
      (payload as any)._meta?.resume_id ??
      (payload as any).id
    if (!resumeId) return
    void saveResume(payload, resumeId || undefined).catch((error) => {
      console.error('[ResumeContext] 保存简历失败:', error)
    })
  }, [])

  const setResume = useCallback((newResume: ResumeData | null) => {
    if (!newResume) { setResumeState(null); return }
    setResumeState(newResume)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pushPatch = useCallback((patch: Omit<PendingPatch, 'status'>) => {
    setPendingPatches(prev => [...prev, { ...patch, status: 'pending' }])
  }, [])

  const applyPatch = useCallback((patch_id: string) => {
    setPendingPatches(prev => {
      const patch = prev.find(p => p.patch_id === patch_id)
      if (!patch) return prev
      setResumeState(current => {
        if (!current) return current
        const op = inferPatchOperation(patch) as ResumePatchOperation
        const updated = applyPatchPaths(current, patch.paths, patch.after, op) as ResumeData
        persistResume(updated)
        return updated
      })
      return prev.map(p => p.patch_id === patch_id ? { ...p, status: 'applied' } : p)
    })
    setPatchAppliedAt(Date.now())
  }, [persistResume])

  const rejectPatch = useCallback((patch_id: string) => {
    setPendingPatches(prev =>
      prev.map(p => p.patch_id === patch_id ? { ...p, status: 'rejected' } : p)
    )
  }, [])

  const supersedePendingPatches = useCallback(() => {
    setPendingPatches(prev =>
      prev.map(p => p.status === 'pending' ? { ...p, status: 'superseded' } : p)
    )
  }, [])

  const clearAllPatches = useCallback(() => {
    setPendingPatches([])
  }, [])

  const rebindCurrentPatches = useCallback((newMessageId: string) => {
    setPendingPatches(prev =>
      prev.map(p => p.message_id === 'current' ? { ...p, message_id: newMessageId } : p)
    )
  }, [])

  return (
    <ResumeContext.Provider value={{
      resume, pendingPatches, patchAppliedAt,
      setResume, pushPatch, applyPatch, rejectPatch,
      supersedePendingPatches, clearAllPatches, rebindCurrentPatches,
    }}>
      {children}
    </ResumeContext.Provider>
  )
}

export function useResumeContext() {
  const ctx = useContext(ResumeContext)
  if (!ctx) throw new Error('useResumeContext must be used within ResumeProvider')
  return ctx
}

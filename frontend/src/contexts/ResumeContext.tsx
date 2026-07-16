import React, { createContext, useContext, useState, useCallback } from 'react'
import type { ResumeData } from '@/pages/Workspace/v2/types'
import { applyPatchPaths, inferPatchOperation, type ResumePatchOperation } from '@/utils/resumePatch'
import { saveResume } from '@/services/resumeStorage'
import { toast } from '@/lib/toast'

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
  /** 批量应用（「全部应用」）：把多个 pending patch 一次合并进简历、只持久化一次。 */
  applyPatches:   (patch_ids: string[]) => void
  rejectPatch:    (patch_id: string) => void
  /** 把所有当前 pending 的 patch 标记为 superseded（新一轮消息开始时调用）。 */
  supersedePendingPatches: () => void
  /** 完整清理所有 patch（切换会话或退出时调用）。 */
  clearAllPatches: () => void
  /** 恢复历史会话时整体替换 patch 列表（含 applied/rejected 等终态卡，用于时间线回显 diff）。 */
  restorePatches: (patches: PendingPatch[]) => void
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

  const applyPatches = useCallback((patch_ids: string[]) => {
    if (patch_ids.length === 0) return
    const idSet = new Set(patch_ids)
    setPendingPatches(prev => {
      const toApply = prev.filter(p => idSet.has(p.patch_id) && p.status === 'pending')
      if (toApply.length === 0) return prev
      const appliedIds = new Set(toApply.map(p => p.patch_id))
      setResumeState(current => {
        if (!current) return current
        const snapshot = current
        let updated: ResumeData = current
        for (const patch of toApply) {
          const op = inferPatchOperation(patch) as ResumePatchOperation
          updated = applyPatchPaths(updated, patch.paths, patch.after, op) as ResumeData
        }
        persistResume(updated)
        // 应用可撤销：保留应用前快照，toast 提供一步回退（简历数据 + 卡片状态一起还原）
        toast.success(
          toApply.length === 1 ? '已应用修改' : `已应用 ${toApply.length} 处修改`,
          {
            action: {
              label: '撤销',
              onClick: () => {
                setResumeState(snapshot)
                persistResume(snapshot)
                setPendingPatches(pp =>
                  pp.map(p => (appliedIds.has(p.patch_id) ? { ...p, status: 'pending' } : p))
                )
                setPatchAppliedAt(Date.now())
              },
            },
          },
        )
        return updated
      })
      return prev.map(p =>
        idSet.has(p.patch_id) && p.status === 'pending' ? { ...p, status: 'applied' } : p
      )
    })
    setPatchAppliedAt(Date.now())
  }, [persistResume])

  const applyPatch = useCallback((patch_id: string) => {
    applyPatches([patch_id])
  }, [applyPatches])

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

  const restorePatches = useCallback((patches: PendingPatch[]) => {
    setPendingPatches(patches)
  }, [])

  const rebindCurrentPatches = useCallback((newMessageId: string) => {
    setPendingPatches(prev =>
      prev.map(p => p.message_id === 'current' ? { ...p, message_id: newMessageId } : p)
    )
  }, [])

  return (
    <ResumeContext.Provider value={{
      resume, pendingPatches, patchAppliedAt,
      setResume, pushPatch, applyPatch, applyPatches, rejectPatch,
      supersedePendingPatches, clearAllPatches, restorePatches, rebindCurrentPatches,
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

export function useOptionalResumeContext() {
  return useContext(ResumeContext)
}

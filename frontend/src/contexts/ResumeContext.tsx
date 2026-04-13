import React, { createContext, useCallback, useContext, useState } from 'react'
import type { ResumeData } from '@/pages/Workspace/v2/types'
import { saveResumeStrict } from '@/services/resumeStorage'
import type { SavedResume } from '@/services/storage/StorageAdapter'
import { applyPatchPaths } from '@/utils/resumePatch'

export interface PendingPatch {
  patch_id: string
  message_id: string
  paths: string[]
  before: Record<string, any>
  after: Record<string, any>
  summary: string
  status: 'pending' | 'applied' | 'rejected'
}

interface ResumeContextValue {
  resume: ResumeData | null
  pendingPatches: PendingPatch[]
  patchAppliedAt: number
  setResume: (resume: ResumeData | null) => void
  pushPatch: (patch: Omit<PendingPatch, 'status'>) => void
  applyPatch: (patchId: string) => void
  applyPatchDraft: (patch: Omit<PendingPatch, 'status'>) => void
  rejectPatch: (patchId: string) => void
  saveResumeDraft: () => Promise<SavedResume | null>
}

const ResumeContext = createContext<ResumeContextValue | null>(null)

function applyPatchToResume(
  current: ResumeData,
  patch: Omit<PendingPatch, 'status'>,
): ResumeData {
  return applyPatchPaths(current, patch.paths, patch.after) as ResumeData
}

export function ResumeProvider({ children }: { children: React.ReactNode }) {
  const [resume, setResumeState] = useState<ResumeData | null>(null)
  const [pendingPatches, setPendingPatches] = useState<PendingPatch[]>([])
  const [patchAppliedAt, setPatchAppliedAt] = useState(0)

  const setResume = useCallback((nextResume: ResumeData | null) => {
    setResumeState(nextResume)
  }, [])

  const pushPatch = useCallback((patch: Omit<PendingPatch, 'status'>) => {
    setPendingPatches((prev) => [...prev, { ...patch, status: 'pending' }])
  }, [])

  const applyPatch = useCallback((patchId: string) => {
    setPendingPatches((prev) => {
      const target = prev.find((item) => item.patch_id === patchId)
      if (!target) return prev
      setResumeState((current) => {
        if (!current) return current
        return applyPatchToResume(current, target)
      })
      return prev.map((item) =>
        item.patch_id === patchId ? { ...item, status: 'applied' } : item,
      )
    })
    setPatchAppliedAt(Date.now())
  }, [])

  const applyPatchDraft = useCallback((patch: Omit<PendingPatch, 'status'>) => {
    setResumeState((current) => {
      if (!current) return current
      return applyPatchToResume(current, patch)
    })
    setPatchAppliedAt(Date.now())
  }, [])

  const rejectPatch = useCallback((patchId: string) => {
    setPendingPatches((prev) =>
      prev.map((item) =>
        item.patch_id === patchId ? { ...item, status: 'rejected' } : item,
      ),
    )
  }, [])

  const saveResumeDraft = useCallback(async () => {
    if (!resume) return null
    const resumeId = (resume as any).resume_id ?? (resume as any).id
    return await saveResumeStrict(resume, resumeId || undefined)
  }, [resume])

  return (
    <ResumeContext.Provider
      value={{
        resume,
        pendingPatches,
        patchAppliedAt,
        setResume,
        pushPatch,
        applyPatch,
        applyPatchDraft,
        rejectPatch,
        saveResumeDraft,
      }}
    >
      {children}
    </ResumeContext.Provider>
  )
}

export function useResumeContext() {
  const ctx = useContext(ResumeContext)
  if (!ctx) throw new Error('useResumeContext must be used within ResumeProvider')
  return ctx
}

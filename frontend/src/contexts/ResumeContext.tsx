import React, { createContext, useContext, useState, useCallback } from 'react'
import type { ResumeData } from '@/pages/Workspace/v2/types'
import { applyPatchPaths } from '@/utils/resumePatch'
import axios from 'axios'

export interface PendingPatch {
  patch_id:   string
  message_id: string
  paths:      string[]
  before:     Record<string, any>
  after:      Record<string, any>
  summary:    string
  status:     'pending' | 'applied' | 'rejected'
}

interface ResumeContextValue {
  resume:         ResumeData | null
  pendingPatches: PendingPatch[]
  patchAppliedAt: number        // timestamp bumped after each applyPatch — lets consumers trigger PDF re-render
  setResume:      (r: ResumeData | null) => void
  pushPatch:      (patch: Omit<PendingPatch, 'status'>) => void
  applyPatch:     (patch_id: string) => void
  rejectPatch:    (patch_id: string) => void
}

const ResumeContext = createContext<ResumeContextValue | null>(null)

export function ResumeProvider({ children }: { children: React.ReactNode }) {
  const [resume, setResumeState] = useState<ResumeData | null>(null)
  const [pendingPatches, setPendingPatches] = useState<PendingPatch[]>([])
  const [patchAppliedAt, setPatchAppliedAt] = useState(0)

  const setResume = useCallback((newResume: ResumeData | null) => {
    if (!newResume) { setResumeState(null); return }
    // Resume data uses resume_id (added by SophiaChat when loading), not id
    const resumeId = (newResume as any).resume_id ?? (newResume as any).id
    if (resumeId) {
      axios.patch(`/api/resumes/${resumeId}`, { data: newResume }).catch(console.error)
    }
    setResumeState(newResume)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume])

  const pushPatch = useCallback((patch: Omit<PendingPatch, 'status'>) => {
    setPendingPatches(prev => [...prev, { ...patch, status: 'pending' }])
  }, [])

  const applyPatch = useCallback((patch_id: string) => {
    setPendingPatches(prev => {
      const patch = prev.find(p => p.patch_id === patch_id)
      if (!patch) return prev
      setResumeState(current => {
        if (!current) return current
        const updated = applyPatchPaths(current, patch.paths, patch.after) as ResumeData
        // Resume data uses resume_id field, not id
        const resumeId = (updated as any).resume_id ?? (updated as any).id
        if (resumeId) {
          axios.patch(`/api/resumes/${resumeId}`, { data: updated }).catch(console.error)
        }
        return updated
      })
      return prev.map(p => p.patch_id === patch_id ? { ...p, status: 'applied' } : p)
    })
    setPatchAppliedAt(Date.now())
  }, [])

  const rejectPatch = useCallback((patch_id: string) => {
    setPendingPatches(prev =>
      prev.map(p => p.patch_id === patch_id ? { ...p, status: 'rejected' } : p)
    )
  }, [])

  return (
    <ResumeContext.Provider value={{
      resume, pendingPatches, patchAppliedAt,
      setResume, pushPatch, applyPatch, rejectPatch,
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

import { useCallback, useEffect, useRef, useState } from 'react'
import { saveResume, setCurrentResumeId } from '../../../../services/resumeStorage'
import type { ResumeData } from '../types'

type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

interface UseAutoSaveResumeProps {
  resumeData: ResumeData
  currentResumeId: string | null
  routeResumeId?: string
  isDataLoaded: boolean
  setCurrentId: (id: string | null) => void
  delayMs?: number
}

const DEFAULT_AUTO_SAVE_DELAY_MS = 800

export function useAutoSaveResume({
  resumeData,
  currentResumeId,
  routeResumeId,
  isDataLoaded,
  setCurrentId,
  delayMs = DEFAULT_AUTO_SAVE_DELAY_MS,
}: UseAutoSaveResumeProps) {
  const [saveStatus, setSaveStatus] = useState<AutoSaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const initializedRef = useRef(false)
  const lastSavedDataRef = useRef('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resumeDataRef = useRef(resumeData)
  const currentResumeIdRef = useRef(currentResumeId)
  const routeResumeIdRef = useRef(routeResumeId)

  resumeDataRef.current = resumeData
  currentResumeIdRef.current = currentResumeId
  routeResumeIdRef.current = routeResumeId

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
  }, [])

  const serializeResume = useCallback((data: ResumeData) => JSON.stringify(data), [])

  const saveNow = useCallback(async () => {
    clearSaveTimer()
    if (!isDataLoaded || !initializedRef.current) return

    const data = resumeDataRef.current
    const dataStr = serializeResume(data)
    if (dataStr === lastSavedDataRef.current) {
      setSaveStatus('idle')
      return
    }

    setSaveStatus('saving')
    setSaveError(null)

    try {
      const saveId = routeResumeIdRef.current || currentResumeIdRef.current || undefined
      const saved = await saveResume(data as any, saveId)
      if (!currentResumeIdRef.current && saved.id) {
        setCurrentId(saved.id)
        setCurrentResumeId(saved.id)
        currentResumeIdRef.current = saved.id
      }
      lastSavedDataRef.current = dataStr
      setSaveStatus('saved')
    } catch (error) {
      const message = error instanceof Error ? error.message : '自动保存失败'
      console.error('自动保存失败:', error)
      setSaveError(message)
      setSaveStatus('error')
    }
  }, [clearSaveTimer, isDataLoaded, serializeResume, setCurrentId])

  useEffect(() => {
    if (!isDataLoaded) return

    const dataStr = serializeResume(resumeData)
    if (!initializedRef.current) {
      initializedRef.current = true
      lastSavedDataRef.current = dataStr
      setSaveStatus('idle')
      setSaveError(null)
      return
    }

    if (dataStr === lastSavedDataRef.current) {
      clearSaveTimer()
      setSaveStatus('idle')
      return
    }

    clearSaveTimer()
    setSaveStatus('pending')
    saveTimerRef.current = setTimeout(() => {
      void saveNow()
    }, delayMs)

    return clearSaveTimer
  }, [clearSaveTimer, delayMs, isDataLoaded, resumeData, saveNow, serializeResume])

  useEffect(() => clearSaveTimer, [clearSaveTimer])

  return {
    saveStatus,
    saveError,
    saveNow,
  }
}

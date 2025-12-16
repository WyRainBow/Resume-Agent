/**
 * 编辑状态管理 Hook
 * 管理所有文本编辑的状态
 */

import { useState, useCallback, useMemo } from 'react'
import type { EditItem, TextPosition } from '../types'
import { generateId } from '../utils/coordinates'

interface UseEditStateResult {
  edits: Map<string, EditItem>
  activeEditId: string | null
  hasEdits: boolean
  
  // 操作方法
  startEdit: (params: {
    pageNumber: number
    originalText: string
    position: TextPosition
    fontName: string
  }) => string
  updateEdit: (id: string, newText: string) => void
  finishEdit: (id: string) => void
  cancelEdit: (id: string) => void
  deleteEdit: (id: string) => void
  reEdit: (id: string) => void  // 重新进入编辑模式
  clearAllEdits: () => void
  getPageEdits: (pageNumber: number) => EditItem[]
}

export const useEditState = (): UseEditStateResult => {
  const [edits, setEdits] = useState<Map<string, EditItem>>(new Map())
  const [activeEditId, setActiveEditId] = useState<string | null>(null)

  // 是否有编辑项
  const hasEdits = useMemo(() => edits.size > 0, [edits])

  // 开始编辑
  const startEdit = useCallback((params: {
    pageNumber: number
    originalText: string
    position: TextPosition
    fontName: string
  }): string => {
    const id = generateId()
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/1e500651-6ec2-4818-b441-0e92d146bc59',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useEditState.ts:startEdit',message:'开始编辑',data:{id,originalText:params.originalText,position:params.position,fontName:params.fontName,pageNumber:params.pageNumber},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A-B'})}).catch(()=>{});
    // #endregion
    
    const newEdit: EditItem = {
      id,
      pageNumber: params.pageNumber,
      originalText: params.originalText,
      newText: params.originalText, // 初始值等于原文
      position: params.position,
      fontName: params.fontName,
      isEditing: true,
    }

    setEdits(prev => {
      const next = new Map(prev)
      next.set(id, newEdit)
      return next
    })
    
    setActiveEditId(id)
    return id
  }, [])

  // 更新编辑内容
  const updateEdit = useCallback((id: string, newText: string) => {
    setEdits(prev => {
      const edit = prev.get(id)
      if (!edit) return prev
      
      const next = new Map(prev)
      next.set(id, { ...edit, newText })
      return next
    })
  }, [])

  // 完成编辑
  const finishEdit = useCallback((id: string) => {
    setEdits(prev => {
      const edit = prev.get(id)
      if (!edit) return prev
      
      // 如果内容没有变化，删除这个编辑项
      if (edit.newText === edit.originalText) {
        const next = new Map(prev)
        next.delete(id)
        return next
      }
      
      // 否则标记为完成编辑
      const next = new Map(prev)
      next.set(id, { ...edit, isEditing: false })
      return next
    })
    
    if (activeEditId === id) {
      setActiveEditId(null)
    }
  }, [activeEditId])

  // 取消编辑
  const cancelEdit = useCallback((id: string) => {
    setEdits(prev => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
    
    if (activeEditId === id) {
      setActiveEditId(null)
    }
  }, [activeEditId])

  // 删除编辑项
  const deleteEdit = useCallback((id: string) => {
    setEdits(prev => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
    
    if (activeEditId === id) {
      setActiveEditId(null)
    }
  }, [activeEditId])

  // 重新进入编辑模式
  const reEdit = useCallback((id: string) => {
    setEdits(prev => {
      const edit = prev.get(id)
      if (!edit) return prev
      
      const next = new Map(prev)
      next.set(id, { ...edit, isEditing: true })
      return next
    })
    
    setActiveEditId(id)
  }, [])

  // 清除所有编辑
  const clearAllEdits = useCallback(() => {
    setEdits(new Map())
    setActiveEditId(null)
  }, [])

  // 获取指定页面的编辑项
  const getPageEdits = useCallback((pageNumber: number): EditItem[] => {
    return Array.from(edits.values()).filter(edit => edit.pageNumber === pageNumber)
  }, [edits])

  return {
    edits,
    activeEditId,
    hasEdits,
    startEdit,
    updateEdit,
    finishEdit,
    cancelEdit,
    deleteEdit,
    reEdit,
    clearAllEdits,
    getPageEdits,
  }
}

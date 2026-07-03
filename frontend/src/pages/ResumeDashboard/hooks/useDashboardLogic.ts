import { useState, useEffect, useCallback } from 'react'
import { toast } from '@/lib/toast'
import { 
  getAllResumes, 
  deleteResume as deleteResumeService, 
  duplicateResume as duplicateResumeService,
  saveResume,
  setCurrentResumeId,
  getResume,
  updateResumeAlias as updateResumeAliasService,
  updateResumePinned as updateResumePinnedService,
  type SavedResume 
} from '@/services/resumeStorage'
import { useNavigate } from 'react-router-dom'

// 简单的 UUID 生成
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export const useDashboardLogic = () => {
  const [resumes, setResumes] = useState<SavedResume[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  /** 是否处于多选模式 */
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)

  /** 选中的简历 ID 集合（用于批量删除） */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const loadResumes = async () => {
    setIsLoading(true)
    const list = await getAllResumes()
    // 置顶优先，然后按创建时间倒序排列
    list.sort((a, b) => {
      // 置顶的排在前面
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      // 同级别按创建时间倒序
      return b.createdAt - a.createdAt
    })
    setResumes(list)
    setIsLoading(false)
  }

  useEffect(() => {
    ;(async () => {
      await loadResumes()
    })()
    
    // 监听 storage 事件，当其他页面修改 localStorage 时刷新
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'resume_resumes') {
        loadResumes()
      }
    }
    
    // 监听页面获得焦点时刷新
    const handleFocus = () => {
      loadResumes()
    }
    
    window.addEventListener('storage', handleStorage)
    window.addEventListener('focus', handleFocus)
    
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  const createResume = () => {
    // 跳转到创建选择页面
    navigate('/create-new')
  };

  /** 删除单个简历 */
  const deleteResume = async (id: string) => {
    if (window.confirm('确定删除这份简历吗？')) {
      await deleteResumeService(id)
      // 同时从选中集合中移除
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      await loadResumes()
    }
  }

  const duplicateResume = async (id: string) => {
    const newResume = await duplicateResumeService(id)
    if (newResume) {
      await loadResumes()
    }
  }

  const editResume = async (id: string) => {
    setCurrentResumeId(id)

    // 🎯 优先从 ID 中推断模板类型（最可靠的方式）
    // ID 格式：resume_{templateType}_{timestamp}_{random}
    // 例如：resume_html_1766858166530_j234y46ds
    const idParts = id.split('_')
    let templateTypeFromId: string | null = null
    if (idParts.length >= 2 && (idParts[1] === 'html' || idParts[1] === 'latex')) {
      templateTypeFromId = idParts[1]
    }

    // 如果 ID 中有模板类型信息，直接使用
    if (templateTypeFromId) {
      if (templateTypeFromId === 'html') {
        navigate(`/workspace/html/${id}`)
      } else {
        navigate(`/workspace/latex/${id}`)
      }
      return
    }

    // 回退：从简历数据中获取模板类型
    const saved = await getResume(id)
    if (saved && saved.data) {
      const data = saved.data as any
      const templateType = data.templateType || 'latex' // 默认为 latex

      // 根据模板类型跳转到对应的工作区
      if (templateType === 'html') {
        navigate(`/workspace/html/${id}`)
      } else {
        navigate(`/workspace/latex/${id}`)
      }
    } else {
      // 如果没有找到简历数据，默认跳转到 latex 工作区
      navigate(`/workspace/latex/${id}`)
    }
  }

  const optimizeResume = (id: string) => {
    setCurrentResumeId(id)
    navigate(`/resume/optimize/${id}`)
  }

  const importJson = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const data = JSON.parse(text)
        
        // 简单的格式校验
        if (!data.basic || !data.education) {
          toast.error('无效的简历 JSON 格式')
          return
        }

        const newId = generateUUID()
        const newResume = { ...data, id: newId }
        await saveResume(newResume)
        await loadResumes()
      } catch (e) {
        console.error('Import failed', e)
        toast.error('导入失败')
      }
    }
    input.click()
  }

  /**
   * 切换单个简历的选中状态
   * @param id 简历 ID
   * @param selected 是否选中
   */
  const toggleSelect = useCallback((id: string, selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (selected) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])

  /**
   * 批量删除选中的简历
   * - 如果没有选中任何简历，给出友好提示
   * - 删除前弹出确认框
   * - 删除后清空选中状态并刷新列表
   */
  const batchDelete = useCallback(async () => {
    // 检查是否有选中的简历
    if (selectedIds.size === 0) {
      toast.error('请先选择要删除的简历')
      return
    }

    // 确认删除
    const confirmMessage = `确定删除选中的 ${selectedIds.size} 份简历吗？此操作不可恢复。`
    if (!window.confirm(confirmMessage)) {
      return
    }

    // 执行批量删除
    for (const id of selectedIds) {
      await deleteResumeService(id)
    }

    // 清空选中状态
    setSelectedIds(new Set())

    // 刷新列表
    await loadResumes()
  }, [selectedIds])

  /**
   * 清空所有选中状态
   */
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  /**
   * 全选：选中当前列表全部简历
   */
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(resumes.map(r => r.id)))
  }, [resumes])

  /**
   * 切换多选模式
   */
  const toggleMultiSelectMode = useCallback(() => {
    setIsMultiSelectMode(prev => {
      if (prev) {
        // 退出多选模式时清空选中状态
        setSelectedIds(new Set())
      }
      return !prev
    })
  }, [])

  /**
   * 退出多选模式
   */
  const exitMultiSelectMode = useCallback(() => {
    setIsMultiSelectMode(false)
    setSelectedIds(new Set())
  }, [])

  /**
   * 更新简历备注/别名
   * @param id 简历 ID
   * @param alias 新的备注/别名
   */
  const updateAlias = useCallback(async (id: string, alias: string) => {
    await updateResumeAliasService(id, alias)
    // 更新本地状态，避免重新加载
    setResumes(prev => prev.map(r => 
      r.id === id ? { ...r, alias, updatedAt: Date.now() } : r
    ))
  }, [])

  /**
   * 切换简历置顶状态
   */
  const togglePin = useCallback(async (id: string) => {
    // 找到当前简历的 pinned 状态
    const resume = resumes.find(r => r.id === id)
    if (!resume) return
    const newPinned = !resume.pinned
    await updateResumePinnedService(id, newPinned)
    // 更新本地状态并重新排序
    setResumes(prev => {
      const updated = prev.map(r => 
        r.id === id ? { ...r, pinned: newPinned } : r
      )
      // 重新排序：置顶优先，然后按创建时间倒序
      updated.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return b.createdAt - a.createdAt
      })
      return updated
    })
  }, [resumes])

  return {
    resumes,
    isLoading,
    createResume,
    deleteResume,
    duplicateResume,
    editResume,
    optimizeResume,
    importJson,
    // 多选模式相关
    isMultiSelectMode,
    toggleMultiSelectMode,
    exitMultiSelectMode,
    selectedIds,
    toggleSelect,
    batchDelete,
    clearSelection,
    selectAll,
    // 备注/别名
    updateAlias,
    // 置顶
    togglePin,
    // 刷新列表
    loadResumes
  }
}
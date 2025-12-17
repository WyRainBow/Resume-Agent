import { useState, useEffect } from 'react'
import { 
  getAllResumes, 
  deleteResume as deleteResumeService, 
  duplicateResume as duplicateResumeService,
  saveResume,
  setCurrentResumeId,
  type SavedResume 
} from '@/services/resumeStorage'
import { getDefaultTemplate } from '@/services/api'
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

  const loadResumes = () => {
    setIsLoading(true)
    const list = getAllResumes()
    list.sort((a, b) => b.updatedAt - a.updatedAt)
    setResumes(list)
    setIsLoading(false)
  }

  useEffect(() => {
    loadResumes()
  }, [])

  const createResume = () => {
    const template = getDefaultTemplate()
    const id = generateUUID()
    const newResume = { ...template, id, basic: { ...template.basic, name: '未命名简历' } }
    
    // 保存到本地存储
    saveResume(newResume)
    
    // 设置当前 ID 并跳转
    setCurrentResumeId(id)
    navigate('/workspace')
  };

  const deleteResume = (id: string) => {
    if (window.confirm('确定删除这份简历吗？')) {
      deleteResumeService(id)
      loadResumes()
    }
  }

  const duplicateResume = (id: string) => {
    const newResume = duplicateResumeService(id)
    if (newResume) {
      loadResumes()
    }
  }

  const editResume = (id: string) => {
    setCurrentResumeId(id)
    navigate('/workspace')
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
          alert('无效的简历 JSON 格式')
          return
        }

        const newId = generateUUID()
        const newResume = { ...data, id: newId }
        saveResume(newResume)
        loadResumes()
      } catch (e) {
        console.error('Import failed', e)
        alert('导入失败')
      }
    }
    input.click()
  }

  return {
    resumes,
    isLoading,
    createResume,
    deleteResume,
    duplicateResume,
    editResume,
    importJson
  }
}
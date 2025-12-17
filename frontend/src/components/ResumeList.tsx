import { useState, useEffect } from 'react'
import type { Resume } from '../types/resume'
import { 
  getAllResumes, 
  deleteResume, 
  renameResume, 
  duplicateResume,
  setCurrentResumeId,
  type SavedResume 
} from '../services/resumeStorage'

interface Props {
  onSelect: (resume: Resume, id: string) => void
  currentId: string | null
}

export default function ResumeList({ onSelect, currentId }: Props) {
  const [resumes, setResumes] = useState<SavedResume[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    setResumes(getAllResumes())
  }, [currentId])

  const handleSelect = (r: SavedResume) => {
    setCurrentResumeId(r.id)
    onSelect(r.data, r.id)
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('确定删除这份简历吗？')) {
      deleteResume(id)
      setResumes(getAllResumes())
    }
  }

  const handleRename = (id: string) => {
    if (editName.trim()) {
      renameResume(id, editName.trim())
      setResumes(getAllResumes())
    }
    setEditingId(null)
  }

  const handleDuplicate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newResume = duplicateResume(id)
    if (newResume) {
      setResumes(getAllResumes())
      onSelect(newResume.data, newResume.id)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div style={{ padding: '16px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h3 style={{ margin: 0, color: 'white', fontSize: '14px' }}>📄 我的简历</h3>
      </div>

      {resumes.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          color: 'rgba(255,255,255,0.5)', 
          padding: '32px 16px',
          fontSize: '13px'
        }}>
          暂无简历，点击顶部"新建"按钮开始创建
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {resumes.map(r => (
            <div
              key={r.id}
              onClick={() => handleSelect(r)}
              style={{
                padding: '12px',
                background: currentId === r.id 
                  ? 'rgba(102, 126, 234, 0.3)' 
                  : 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
                cursor: 'pointer',
                border: currentId === r.id 
                  ? '1px solid rgba(102, 126, 234, 0.5)' 
                  : '1px solid transparent',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                if (currentId !== r.id) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                }
              }}
              onMouseLeave={e => {
                if (currentId !== r.id) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                }
              }}
            >
              {editingId === r.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={() => handleRename(r.id)}
                  onKeyDown={e => e.key === 'Enter' && handleRename(r.id)}
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: '100%',
                    padding: '4px 8px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(102, 126, 234, 0.5)',
                    borderRadius: '4px',
                    color: 'white',
                    fontSize: '13px'
                  }}
                />
              ) : (
                <>
                  <div style={{ 
                    color: 'white', 
                    fontSize: '13px', 
                    fontWeight: 500,
                    marginBottom: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>{r.name}</span>
                    {currentId === r.id && (
                      <span style={{ 
                        fontSize: '10px', 
                        background: 'rgba(102, 126, 234, 0.5)',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        当前
                      </span>
                    )}
                  </div>
                  <div style={{ 
                    color: 'rgba(255,255,255,0.4)', 
                    fontSize: '11px',
                    marginBottom: '8px'
                  }}>
                    更新于 {formatDate(r.updatedAt)}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingId(r.id)
                        setEditName(r.name)
                      }}
                      style={{
                        padding: '4px 8px',
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: '4px',
                        color: 'rgba(255,255,255,0.7)',
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      重命名
                    </button>
                    <button
                      onClick={(e) => handleDuplicate(r.id, e)}
                      style={{
                        padding: '4px 8px',
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: '4px',
                        color: 'rgba(255,255,255,0.7)',
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      复制
                    </button>
                    <button
                      onClick={(e) => handleDelete(r.id, e)}
                      style={{
                        padding: '4px 8px',
                        background: 'rgba(255,100,100,0.2)',
                        border: 'none',
                        borderRadius: '4px',
                        color: 'rgba(255,150,150,0.9)',
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      删除
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

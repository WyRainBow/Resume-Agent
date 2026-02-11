/**
 * 基本信息编辑面板
 */
import { useRef, useState, type ChangeEvent } from 'react'
import { Upload, Loader2, X } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { uploadUserPhoto } from '@/services/photoService'
import type { BasicInfo } from '../types'
import Field from './Field'

interface BasicPanelProps {
  basic: BasicInfo
  onUpdate: (data: Partial<BasicInfo>) => void
}

const BasicPanel = ({ basic, onUpdate }: BasicPanelProps) => {
  const { isAuthenticated, token, openModal } = useAuth()
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSelectPhoto = () => {
    if (!isAuthenticated) {
      openModal('login')
      return
    }
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (!token) {
      alert('请先登录后再上传照片')
      return
    }

    setUploading(true)
    try {
      const result = await uploadUserPhoto(file, token)
      onUpdate({ photo: result.url })
    } catch (err: any) {
      alert(err?.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const hasPhoto = Boolean(basic?.photo)

  return (
    <div className="space-y-6 p-6">
      {/* 资料 */}
      <div className="space-y-4">
        <h3 className="font-medium text-neutral-900 dark:text-neutral-200">
          基础字段
        </h3>

        <div className="flex items-start gap-6">
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="姓名"
                value={basic?.name || ''}
                onChange={(value) => onUpdate({ name: value })}
                placeholder="请输入姓名"
              />
              <Field
                label="职位"
                value={basic?.title || ''}
                onChange={(value) => onUpdate({ title: value })}
                placeholder="请输入目标职位"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field
                label="状态"
                value={basic?.employementStatus || ''}
                onChange={(value) => onUpdate({ employementStatus: value })}
                placeholder="如：在职、离职"
              />
              <Field
                label="生日"
                value={basic?.birthDate || ''}
                onChange={(value) => onUpdate({ birthDate: value })}
                type="date"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field
                label="邮箱"
                value={basic?.email || ''}
                onChange={(value) => onUpdate({ email: value })}
                placeholder="请输入邮箱"
              />
              <Field
                label="电话"
                value={basic?.phone || ''}
                onChange={(value) => onUpdate({ phone: value })}
                placeholder="请输入电话"
              />
            </div>

            <Field
              label="地址"
              value={basic?.location || ''}
              onChange={(value) => onUpdate({ location: value })}
              placeholder="请输入所在城市"
            />
          </div>

          <div className="w-28">
            <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              照片
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleSelectPhoto}
              disabled={uploading}
              className={cn(
                'w-24 h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1',
                'transition-colors',
                isAuthenticated
                  ? 'border-indigo-400 text-indigo-600 hover:bg-indigo-50'
                  : 'border-neutral-300 text-neutral-400',
                uploading && 'opacity-60'
              )}
              title={isAuthenticated ? '上传照片' : '登录后可上传'}
            >
              {hasPhoto ? (
                <img
                  src={basic.photo}
                  alt="照片"
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <>
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                  <span className="text-xs">上传</span>
                </>
              )}
            </button>

            {hasPhoto && (
              <button
                type="button"
                onClick={() => onUpdate({ photo: '' })}
                className="mt-2 flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
                title="移除照片"
              >
                <X className="w-3 h-3" />
                移除
              </button>
            )}

            {!isAuthenticated && (
              <div className="mt-2 text-[11px] text-neutral-400">
                登录后可上传
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BasicPanel

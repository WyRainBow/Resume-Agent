/**
 * 基本信息编辑面板
 */
import { useRef, useState, type ChangeEvent } from 'react'
import { motion } from 'framer-motion'
import { Upload, Loader2, X } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { uploadUserPhoto } from '@/services/photoService'
import { InlineDatePicker } from '@/components/InlineDatePicker'
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
      onUpdate({
        photo: result.url,
        photoOffsetX: basic?.photoOffsetX ?? 0,
        photoOffsetY: basic?.photoOffsetY ?? -2,
        photoWidthCm: basic?.photoWidthCm ?? 3,
        photoHeightCm: basic?.photoHeightCm ?? 3,
      })
    } catch (err: any) {
      alert(err?.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const hasPhoto = Boolean(basic?.photo)
  const photoOffsetX = basic?.photoOffsetX ?? 0
  const photoOffsetY = basic?.photoOffsetY ?? -2
  const normalizeDecimal = (value: number, digits = 2) => Number(value.toFixed(digits))
  // 以当前正确渲染位置作为 UI 的 0 点（内部绝对值 +2）
  const photoOffsetYDisplay = normalizeDecimal(photoOffsetY + 2, 2)
  const photoWidthCm = basic?.photoWidthCm ?? 3
  const photoHeightCm = basic?.photoHeightCm ?? 3

  return (
    <div className="space-y-6 p-6">
      {/* 资料 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="space-y-4"
      >
        <h3 className="font-medium text-neutral-900 dark:text-neutral-200">
          基础字段
        </h3>

        <div className="flex flex-col xl:flex-row items-start gap-6">
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field
                index={0}
                label="姓名"
                value={basic?.name || ''}
                onChange={(value) => onUpdate({ name: value })}
                placeholder="请输入姓名"
              />
              <Field
                index={1}
                label="职位"
                value={basic?.title || ''}
                onChange={(value) => onUpdate({ title: value })}
                placeholder="请输入目标职位"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field
                index={2}
                label="状态"
                value={basic?.employementStatus || ''}
                onChange={(value) => onUpdate({ employementStatus: value })}
                placeholder="如：在职、离职"
              />
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 3 * 0.04, ease: 'easeOut' }}
                className="space-y-2"
              >
                <label className="text-sm text-gray-600 dark:text-neutral-300">生日</label>
                <InlineDatePicker
                  value={basic?.birthDate || null}
                  placeholder="选择日期"
                  onSelect={(value) => onUpdate({ birthDate: value ?? '' })}
                />
              </motion.div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field
                index={4}
                label="邮箱"
                value={basic?.email || ''}
                onChange={(value) => onUpdate({ email: value })}
                placeholder="请输入邮箱"
              />
              <Field
                index={5}
                label="电话"
                value={basic?.phone || ''}
                onChange={(value) => onUpdate({ phone: value })}
                placeholder="请输入电话"
              />
            </div>

            <Field
              index={6}
              label="地址"
              value={basic?.location || ''}
              onChange={(value) => onUpdate({ location: value })}
              placeholder="请输入所在城市"
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 7 * 0.04, ease: 'easeOut' }}
            className="w-full xl:w-[300px] shrink-0"
          >
            <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-slate-800">
                  照片设置
                </div>
                {hasPhoto && (
                  <button
                    type="button"
                    onClick={() => onUpdate({ photo: '' })}
                    className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600"
                    title="移除照片"
                  >
                    <X className="w-3.5 h-3.5" />
                    移除
                  </button>
                )}
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
                  'w-full h-36 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all',
                  isAuthenticated
                    ? 'border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-600 hover:bg-slate-50/60'
                    : 'border-slate-200 text-slate-300',
                  uploading && 'opacity-60'
                )}
                title={isAuthenticated ? '上传照片' : '登录后可上传'}
              >
                {hasPhoto ? (
                  <img
                    src={basic.photo}
                    alt="照片"
                    className="w-full h-full object-contain rounded-xl bg-white"
                  />
                ) : (
                  <>
                    {uploading ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Upload className="w-6 h-6" />
                    )}
                    <span className="text-sm font-medium">点击上传照片</span>
                  </>
                )}
              </button>

              {hasPhoto && (
                <div className="mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-500">X 偏移（正向左）</label>
                      <input
                        type="number"
                        step="0.1"
                        value={photoOffsetX}
                        onChange={(e) => onUpdate({ photoOffsetX: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-500">Y 偏移（正向上）</label>
                      <input
                        type="number"
                        step="0.1"
                        value={photoOffsetYDisplay}
                        onChange={(e) => {
                          const uiValue = e.target.valueAsNumber
                          if (Number.isNaN(uiValue)) return
                          onUpdate({ photoOffsetY: normalizeDecimal(uiValue - 2, 2) })
                        }}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-500">宽（cm）</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1.2"
                        max="5"
                        value={photoWidthCm}
                        onChange={(e) => onUpdate({ photoWidthCm: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-500">高（cm）</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1.2"
                        max="6"
                        value={photoHeightCm}
                        onChange={(e) => onUpdate({ photoHeightCm: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      />
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400">
                    当前 Y 的 0 点是你的默认起始位置
                  </div>
                </div>
              )}

              {!isAuthenticated && (
                <div className="mt-3 text-xs text-slate-400">
                  登录后可上传
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

export default BasicPanel

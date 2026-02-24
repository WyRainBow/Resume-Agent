import { useRef, useState } from 'react'
import { FileText, Trash2, UploadCloud } from 'lucide-react'
import { cn } from '../../../../lib/utils'

interface FileUploadZoneProps {
  file: File | null
  onFileSelect: (file: File | null) => void
  maxSizeMb?: number
  accept?: string
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileUploadZone({
  file,
  onFileSelect,
  maxSizeMb = 10,
  accept = 'application/pdf'
}: FileUploadZoneProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const maxBytes = maxSizeMb * 1024 * 1024

  const validateFile = (nextFile: File) => {
    if (nextFile.type !== accept) {
      alert('仅支持 PDF 文件')
      return false
    }
    if (nextFile.size > maxBytes) {
      alert(`文件过大，最大支持 ${maxSizeMb}MB`)
      return false
    }
    return true
  }

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const nextFile = files[0]
    if (!validateFile(nextFile)) return
    onFileSelect(nextFile)
    // 重置 input value，确保下次选择同一文件能触发 onChange
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <div className="h-full flex flex-col space-y-3">
      <div
        className={cn(
          'flex-1 flex flex-col justify-center rounded-2xl border-2 border-dashed p-6 transition-colors',
          dragging
            ? 'border-slate-900 bg-slate-50 dark:border-slate-400 dark:bg-indigo-500/10'
            : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40'
        )}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          handleFiles(event.dataTransfer.files)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
        <div className="flex flex-col items-center text-center">
          {file ? (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-300">
                <FileText className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                {file.name}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {formatFileSize(file.size)}
              </p>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    inputRef.current?.click();
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500"
                >
                  更换文件
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileSelect(null);
                    if (inputRef.current) {
                      inputRef.current.value = '';
                    }
                  }}
                  className="rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-xs font-medium text-red-600 shadow-sm transition-colors hover:border-red-200 hover:bg-red-100 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400 dark:hover:border-red-800"
                >
                  清除
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-900 dark:bg-indigo-500/20 dark:text-indigo-300">
                <UploadCloud className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                点击或拖拽 PDF 文件到此处上传
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                单个文件最大支持 {maxSizeMb}MB
              </p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500"
              >
                选择文件
              </button>
            </>
          )}
        </div>
      </div>

      {/* 移除底部的重复显示 */}
    </div>
  )
}

export default FileUploadZone

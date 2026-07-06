/**
 * 后台 Logo 统一管理（仅管理员）：公司 Logo + 学校校徽 的查看 / 上传 / 删除。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Trash2, Upload, RefreshCw } from 'lucide-react'
import { toast } from '@/lib/toast'
import { confirmDialog } from '@/lib/confirm'
import { getAuthHeaders } from '@/lib/authHeaders'
import { getApiBaseUrl } from '@/lib/runtimeEnv'

type LogoItem = {
  key: string
  name: string
  url: string
  group?: string
}

type SchoolGroup = {
  key: string
  name: string
  logos: LogoItem[]
}

const SCHOOL_GROUPS = ['985', '211', '香港', '双非'] as const

/** 从 COS URL 反推对象文件名（删除接口按文件名定位） */
function filenameFromUrl(url: string): string {
  const last = url.split('/').pop() || ''
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}

function LogoGrid({
  logos,
  busyKey,
  onDelete,
}: {
  logos: LogoItem[]
  busyKey: string | null
  onDelete: (logo: LogoItem) => void
}) {
  if (logos.length === 0) {
    return <p className="px-1 py-3 text-xs text-slate-400 dark:text-slate-500">暂无 Logo</p>
  }
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {logos.map((logo) => (
        <div
          key={`${logo.group || 'company'}-${logo.key}`}
          className="group relative flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
        >
          <img
            src={logo.url}
            alt={logo.name}
            loading="lazy"
            className="h-10 w-10 object-contain"
          />
          <span className="w-full truncate text-center text-xs text-slate-600 dark:text-slate-300" title={logo.name}>
            {logo.name}
          </span>
          <button
            type="button"
            title="删除"
            disabled={busyKey === logo.key}
            onClick={() => onDelete(logo)}
            className="absolute right-1.5 top-1.5 hidden rounded-md bg-red-50 p-1 text-red-500 transition-colors hover:bg-red-500 hover:text-white group-hover:block disabled:opacity-50 dark:bg-red-950/40"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

export function LogoManager() {
  const [companyLogos, setCompanyLogos] = useState<LogoItem[]>([])
  const [schoolGroups, setSchoolGroups] = useState<SchoolGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [schoolGroup, setSchoolGroup] = useState<(typeof SCHOOL_GROUPS)[number]>('985')

  const companyFileRef = useRef<HTMLInputElement>(null)
  const schoolFileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [companyResp, schoolResp] = await Promise.all([
        fetch(`${getApiBaseUrl()}/api/logos`, { headers: getAuthHeaders() }),
        fetch(`${getApiBaseUrl()}/api/school-logos`, { headers: getAuthHeaders() }),
      ])
      if (!companyResp.ok || !schoolResp.ok) {
        throw new Error(`加载失败: ${companyResp.status}/${schoolResp.status}`)
      }
      const companyData = await companyResp.json()
      const schoolData = await schoolResp.json()
      setCompanyLogos(Array.isArray(companyData?.logos) ? companyData.logos : [])
      setSchoolGroups(Array.isArray(schoolData?.groups) ? schoolData.groups : [])
    } catch (e: any) {
      setError(e?.message || 'Logo 列表加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const uploadFile = async (kind: 'company' | 'school', file: File) => {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      let url = `${getApiBaseUrl()}/api/logos/upload`
      if (kind === 'school') {
        form.append('group', schoolGroup)
        url = `${getApiBaseUrl()}/api/school-logos/upload`
      }
      const resp = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: form,
      })
      if (!resp.ok) {
        const detail = await resp.json().then((d) => d?.detail).catch(() => '')
        throw new Error(typeof detail === 'string' && detail ? detail : `上传失败: ${resp.status}`)
      }
      toast.success(kind === 'company' ? 'Logo 已上传' : `校徽已上传（${schoolGroup}）`)
      await load()
    } catch (e: any) {
      toast.error(e?.message || '上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (kind: 'company' | 'school', logo: LogoItem) => {
    const filename = filenameFromUrl(logo.url)
    if (!filename) {
      toast.error('无法识别该 Logo 的文件名')
      return
    }
    if (!(await confirmDialog({
      title: `删除「${logo.name}」？`,
      description: '将从素材库中移除，使用该 Logo 的简历会显示不出图标。',
      confirmText: '删除',
      danger: true,
    }))) {
      return
    }
    setBusyKey(logo.key)
    try {
      const params = kind === 'company'
        ? `filename=${encodeURIComponent(filename)}`
        : `filename=${encodeURIComponent(filename)}&group=${encodeURIComponent(logo.group || '')}`
      const url = kind === 'company'
        ? `${getApiBaseUrl()}/api/logos?${params}`
        : `${getApiBaseUrl()}/api/school-logos?${params}`
      const resp = await fetch(url, { method: 'DELETE', headers: getAuthHeaders() })
      if (!resp.ok) {
        const detail = await resp.json().then((d) => d?.detail).catch(() => '')
        throw new Error(typeof detail === 'string' && detail ? detail : `删除失败: ${resp.status}`)
      }
      toast.success(`已删除「${logo.name}」`)
      await load()
    } catch (e: any) {
      toast.error(e?.message || '删除失败，请重试')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Logo 管理</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            公司 Logo 与学校校徽素材库，全站共享。仅管理员可上传 / 删除（png/jpg/webp/svg，最大 2MB）。
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {error ? (
        <div className="px-6 py-4 text-sm text-red-600 dark:text-red-400">{error}</div>
      ) : (
        <div className="space-y-6 px-6 py-5">
          {/* 公司 Logo */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                公司 Logo <span className="ml-1 font-normal text-slate-400">{companyLogos.length} 个</span>
              </h3>
              <input
                ref={companyFileRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.svg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void uploadFile('company', file)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => companyFileRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                {uploading ? '上传中…' : '上传 Logo'}
              </button>
            </div>
            {loading ? (
              <p className="px-1 py-3 text-xs text-slate-400">加载中…</p>
            ) : (
              <LogoGrid logos={companyLogos} busyKey={busyKey} onDelete={(l) => handleDelete('company', l)} />
            )}
          </div>

          {/* 学校校徽 */}
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                学校校徽 <span className="ml-1 font-normal text-slate-400">{schoolGroups.reduce((n, g) => n + g.logos.length, 0)} 个</span>
              </h3>
              <div className="flex items-center gap-2">
                <select
                  value={schoolGroup}
                  onChange={(e) => setSchoolGroup(e.target.value as (typeof SCHOOL_GROUPS)[number])}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {SCHOOL_GROUPS.map((g) => (
                    <option key={g} value={g}>上传到：{g}</option>
                  ))}
                </select>
                <input
                  ref={schoolFileRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.svg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void uploadFile('school', file)
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => schoolFileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? '上传中…' : '上传校徽'}
                </button>
              </div>
            </div>
            {loading ? (
              <p className="px-1 py-3 text-xs text-slate-400">加载中…</p>
            ) : (
              <div className="space-y-4">
                {schoolGroups.map((group) => (
                  <div key={group.key}>
                    <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {group.name}（{group.logos.length}）
                    </div>
                    <LogoGrid logos={group.logos} busyKey={busyKey} onDelete={(l) => handleDelete('school', l)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

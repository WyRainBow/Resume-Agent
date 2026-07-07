/**
 * Builder Dashboard —— 复刻自 Resume-Matcher 的 /dashboard(SwissGrid + 卡片网格)。
 * 来源:apps/frontend/components/home/swiss-grid.tsx + app/(default)/dashboard/page.tsx
 *
 * 差异(数据源适配,视觉语言不变):
 * - 卡片数据来自我方 resumeStorage.getAllResumes()(RM 是它自己的后端简历列表)
 * - monogram:中文名取首字(RM 只取英文首字母,中文会得到空 monogram)
 * - 点击卡片 → /builder/:id;新建卡 → /workspace(内容创建仍走原工作台)
 * - RM 的 LLM 未配置警告横幅保留形态,指向 /builder/settings(仅管理员可见入口)
 * - 容器查询(@container)换成视口断点(Tailwind v3 无该插件)
 */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Settings } from 'lucide-react'
import { getAllResumes, type SavedResume } from '@/services/resumeStorage'
import { canUseAdminFeature } from '@/lib/runtimeEnv'
import { SwissButton } from './components/SwissButton'

// Muted palette that complements the #F0F0E8 canvas(RM 原表)
const CARD_PALETTE = [
  { bg: '#1D4ED8', fg: '#FFFFFF' }, // Hyper Blue
  { bg: '#15803D', fg: '#FFFFFF' }, // Signal Green
  { bg: '#000000', fg: '#FFFFFF' }, // Ink
  { bg: '#92400E', fg: '#FFFFFF' }, // Warm Brown
  { bg: '#7C3AED', fg: '#FFFFFF' }, // Violet
  { bg: '#0E7490', fg: '#FFFFFF' }, // Teal
  { bg: '#B91C1C', fg: '#FFFFFF' }, // Deep Red
  { bg: '#4338CA', fg: '#FFFFFF' }, // Indigo
]

const FILLER_PALETTE = ['bg-[#E5E5E0]', 'bg-[#D8D8D2]', 'bg-[#CFCFC7]', 'bg-[#E0E0D8]']

function hashTitle(title: string): number {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = (hash << 5) - hash + title.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

/** RM 的 getMonogram 只取英文首字母;中文名改取前 1-2 个字 */
function getMonogram(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) return 'R'
  const latinWords = trimmed.split(/\s+/).filter((w) => /^[a-zA-Z]/.test(w))
  if (latinWords.length > 0) {
    return latinWords
      .slice(0, 3)
      .map((w) => w.charAt(0).toUpperCase())
      .join('')
  }
  return trimmed.slice(0, 2)
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// RM Card variant="interactive" 的等价类(token 已换算)
const INTERACTIVE_CARD =
  'rounded-none flex flex-col relative overflow-hidden bg-[#F0F0E8] border-2 border-transparent ' +
  'transition-all duration-200 ease-in-out cursor-pointer group ' +
  'hover:z-20 hover:border-black hover:shadow-[4px_4px_0px_0px_#000000] hover:-translate-y-[2px] hover:-translate-x-[2px] ' +
  'p-6 md:p-8 aspect-square h-full text-left'

export default function BuilderDashboardPage() {
  const navigate = useNavigate()
  const [resumes, setResumes] = useState<SavedResume[]>([])
  const [loading, setLoading] = useState(true)
  const isAdmin = canUseAdminFeature()

  useEffect(() => {
    let cancelled = false
    getAllResumes().then((list) => {
      if (cancelled) return
      setResumes(list)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // 补齐 5 列网格的 filler(RM 同款算法)
  const totalCards = resumes.length + 1 // + 新建卡
  const fillerCount = Math.max(0, (5 - (totalCards % 5)) % 5)
  const extraFillerCount = 5

  return (
    <div
      className="h-screen w-full flex justify-center items-start py-12 px-4 md:px-8 overflow-hidden bg-[#F0F0E8]"
      style={{
        backgroundImage:
          'linear-gradient(rgba(29, 78, 216, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(29, 78, 216, 0.1) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    >
      {/* The Main Container: Sharp black borders, creating the "Canvas" */}
      <div className="w-full max-w-[86rem] max-h-full border border-black bg-[#F0F0E8] shadow-[8px_8px_0px_0px_#000000] flex flex-col overflow-hidden">
        {/* Header Section */}
        <div className="border-b border-black p-8 md:p-12 shrink-0 bg-[#F0F0E8] relative z-30 flex justify-between items-start">
          <div>
            <h1 className="font-serif text-5xl md:text-7xl text-black tracking-tight leading-[0.95] uppercase">
              Dashboard
            </h1>
            <p className="mt-6 text-sm font-mono text-blue-700 uppercase tracking-wide max-w-md font-bold">
              {'// '}Select a resume · Open in builder
            </p>
          </div>
          {isAdmin && (
            <SwissButton
              variant="outline"
              size="sm"
              onClick={() => navigate('/builder/settings')}
            >
              <Settings className="w-4 h-4" />
              Settings
            </SwissButton>
          )}
        </div>

        {/* Content Grid - Scrollable area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative z-10">
          {loading ? (
            <div className="flex items-center justify-center p-16">
              <span className="font-mono text-xs uppercase tracking-wider text-[#444850]">
                Loading…
              </span>
            </div>
          ) : (
            <div className="p-[1.5px]">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 bg-black gap-[1px] border-b border-black">
                {/* 简历卡片 */}
                {resumes.map((resume) => {
                  const title = resume.name || '未命名简历'
                  const color = CARD_PALETTE[hashTitle(title) % CARD_PALETTE.length]
                  return (
                    <button
                      key={resume.id}
                      type="button"
                      className={INTERACTIVE_CARD}
                      onClick={() => navigate(`/builder/${resume.id}`)}
                    >
                      <div className="flex-1 flex flex-col h-full w-full">
                        <div className="flex justify-between items-start mb-6">
                          <div
                            className="w-12 h-12 border-2 border-black flex items-center justify-center"
                            style={{ backgroundColor: color.bg, color: color.fg }}
                          >
                            <span className="font-mono font-bold">{getMonogram(title)}</span>
                          </div>
                          {resume.pinned && (
                            <span className="font-mono text-xs text-blue-700 uppercase font-bold">
                              Pinned
                            </span>
                          )}
                        </div>
                        <span className="block font-serif text-lg font-semibold leading-tight tracking-tight line-clamp-2 group-hover:text-blue-700">
                          {title}
                        </span>
                        {resume.alias && (
                          <span className="font-mono text-xs text-[#878E99] mt-1 line-clamp-1">
                            {resume.alias}
                          </span>
                        )}
                        <span className="text-xs font-mono text-[#878E99] mt-auto pt-4 uppercase">
                          Edited {formatDate(resume.updatedAt)}
                        </span>
                      </div>
                    </button>
                  )
                })}

                {/* 新建卡(RM 的 Create Tailored Resume 卡形态) */}
                <div className="rounded-none flex flex-col relative overflow-hidden bg-[#F0F0E8] p-6 md:p-8 aspect-square h-full">
                  <div className="flex-1 flex flex-col items-center justify-center text-center h-full">
                    <button
                      type="button"
                      onClick={() => navigate('/workspace')}
                      className="w-20 h-20 bg-blue-700 text-white border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:bg-blue-800 hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-none transition-all rounded-none flex items-center justify-center"
                    >
                      <Plus className="w-8 h-8" />
                    </button>
                    <p className="text-xs font-mono mt-4 uppercase text-green-700">
                      New resume · Workspace
                    </p>
                  </div>
                </div>

                {/* Fillers */}
                {Array.from({ length: fillerCount }).map((_, index) => (
                  <div
                    key={`filler-${index}`}
                    className="hidden md:block bg-[#F0F0E8] aspect-square h-full opacity-50 pointer-events-none"
                  />
                ))}
                {Array.from({ length: extraFillerCount }).map((_, index) => (
                  <div
                    key={`extra-filler-${index}`}
                    className={`hidden md:block ${FILLER_PALETTE[index % FILLER_PALETTE.length]} aspect-square h-full opacity-70 pointer-events-none`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#F0F0E8] flex justify-between items-center font-mono text-xs text-blue-700 border-t border-black shrink-0 relative z-30">
          <span className="uppercase font-bold flex items-center gap-2">
            <span className="w-3 h-3 bg-blue-700 inline-block"></span>
            Resume Builder Module
          </span>
          <div className="flex items-center gap-4">
            <span className="uppercase">{resumes.length} Resumes</span>
            <span className="text-[#878E99]">|</span>
            <button
              type="button"
              className="uppercase underline-offset-4 hover:underline"
              onClick={() => navigate('/my-resumes')}
            >
              My Resumes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

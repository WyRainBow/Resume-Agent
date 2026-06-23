import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Sparkles, Wrench } from 'lucide-react'
import { LATEST_CHANGELOG } from '@/data/changelog'

const SEEN_KEY = 'seen_changelog_version'

/**
 * 更新日志弹窗：每次有新版本（与 localStorage 记录不一致）时，
 * 在非工作台编辑器页面首次访问弹一次，点「知道了」后记下版本不再弹。
 */
export function ChangelogModal() {
  const location = useLocation()
  const inWorkspace = location.pathname.startsWith('/workspace')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (inWorkspace) return
    try {
      const seen = localStorage.getItem(SEEN_KEY)
      if (seen !== LATEST_CHANGELOG.version) setOpen(true)
    } catch {
      /* localStorage 不可用时静默跳过 */
    }
  }, [inWorkspace])

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, LATEST_CHANGELOG.version)
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  if (inWorkspace) return null

  const { version, date, added, fixed } = LATEST_CHANGELOG

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={dismiss}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative px-6 pt-6 pb-4">
              <button
                type="button"
                onClick={dismiss}
                aria-label="关闭"
                className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/30">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">有什么新变化</h2>
                  <p className="text-xs font-medium text-slate-400">
                    v{version} · {date}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-6 pb-2">
              {added && added.length > 0 && (
                <section>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    <Sparkles className="h-3.5 w-3.5" />
                    新增
                  </h3>
                  <ul className="space-y-1.5">
                    {added.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-blue-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {fixed && fixed.length > 0 && (
                <section>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    <Wrench className="h-3.5 w-3.5" />
                    修复
                  </h3>
                  <ul className="space-y-1.5">
                    {fixed.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <div className="px-6 py-4">
              <button
                type="button"
                onClick={dismiss}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 active:scale-[0.99]"
              >
                知道了
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

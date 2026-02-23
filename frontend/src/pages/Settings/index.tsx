/**
 * 设置页面：账户信息 + 外观（主题）
 * 布局参考图二：白卡片、分区标题、表单与单选
 */
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import WorkspaceLayout from '@/pages/WorkspaceLayout'
import { cn } from '@/lib/utils'

const THEME_KEY = 'app-theme'
type Theme = 'light' | 'dark' | 'system'

function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(THEME_KEY) as Theme) || 'light'
    } catch {
      return 'light'
    }
  })

  useEffect(() => {
    const root = document.documentElement
    const apply = (dark: boolean) => {
      if (dark) root.classList.add('dark')
      else root.classList.remove('dark')
    }
    // 不跟随系统：system 与 light 均按浅色处理
    apply(theme === 'dark')
  }, [theme])

  const setTheme = (v: Theme) => {
    setThemeState(v)
    try {
      localStorage.setItem(THEME_KEY, v)
    } catch {}
  }

  return [theme, setTheme] as const
}

const LANG_OPTIONS = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
]

export default function SettingsPage() {
  const { user, isAuthenticated } = useAuth()
  const [theme, setTheme] = useTheme()
  const [displayName, setDisplayName] = useState(user?.username ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [language, setLanguage] = useState('zh')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (user) {
      setDisplayName(user.username)
      setEmail(user.email ?? '')
    }
  }, [user])

  const handleSaveAccount = () => {
    // 仅前端占位，实际可接后端更新接口
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <WorkspaceLayout>
      <div className="h-full overflow-y-auto bg-[#F8F9FA] dark:bg-slate-950">
        <div className="max-w-2xl mx-auto p-6 sm:p-8 space-y-6">
          {/* 账户信息 */}
          <section className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 px-5 pt-5 pb-1">
              账户信息
            </h2>
            <div className="px-5 pb-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    显示名称
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={!isAuthenticated}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 disabled:opacity-60"
                    placeholder="显示名称"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    邮箱
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!isAuthenticated}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 disabled:opacity-60"
                    placeholder="user@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  语言
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                >
                  {LANG_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleSaveAccount}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-300 transition-colors"
                >
                  {saved ? '已保存' : '保存修改'}
                </button>
              </div>
            </div>
          </section>

          {/* 外观 */}
          <section className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 px-5 pt-5 pb-1">
              外观
            </h2>
            <div className="px-5 pb-5 pt-2">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { value: 'light' as Theme, label: '亮色' },
                    { value: 'dark' as Theme, label: '深色' },
                    { value: 'system' as Theme, label: '跟随系统' },
                  ]
                ).map((opt) => {
                  const isActive = theme === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTheme(opt.value)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all',
                        isActive
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-400 dark:border-indigo-500 text-indigo-700 dark:text-indigo-300'
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500'
                      )}
                    >
                      <span
                        className={cn(
                          'w-3.5 h-3.5 rounded-full border-2',
                          isActive
                            ? 'border-indigo-500 bg-indigo-500'
                            : 'border-slate-400 dark:border-slate-500'
                        )}
                      />
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>
        </div>
      </div>
    </WorkspaceLayout>
  )
}

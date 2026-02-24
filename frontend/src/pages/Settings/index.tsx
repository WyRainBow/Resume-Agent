/**
 * 设置页面：独立界面
 * 包含：主题、语言、快捷键、导入导出、账号与权限
 */
import { useEffect, useState } from 'react'
import {
  Shield,
  Palette,
  Languages,
  Keyboard,
} from 'lucide-react'
import WorkspaceLayout from '@/pages/WorkspaceLayout'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const THEME_KEY = 'app-theme'
const LANGUAGE_KEY = 'app-language'
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

const SHORTCUTS = [
  { action: '打开命令面板', keys: ['Ctrl', 'K'] },
  { action: '保存当前简历', keys: ['Ctrl', 'S'] },
  { action: '下载 PDF', keys: ['Ctrl', 'D'] },
]

function Card({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode
  title: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
            {icon}
          </div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{title}</h2>
        </div>
        {desc && <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{desc}</p>}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </section>
  )
}

export default function SettingsPage() {
  const { user, isAuthenticated } = useAuth()
  const [theme, setTheme] = useTheme()
  const [displayName, setDisplayName] = useState(user?.username ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem(LANGUAGE_KEY) || 'zh'
    } catch {
      return 'zh'
    }
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (user) {
      setDisplayName(user.username)
      setEmail(user.email ?? '')
    }
  }, [user])

  const handleSaveAccount = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const handleLanguageChange = (v: string) => {
    setLanguage(v)
    try {
      localStorage.setItem(LANGUAGE_KEY, v)
    } catch {}
  }

  return (
    <WorkspaceLayout>
      <div className="h-full overflow-y-auto bg-[#F8F9FA] dark:bg-slate-950">
        <div className="max-w-3xl mx-auto p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">设置</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">管理账号、显示偏好与工作区行为。</p>
          </div>

          <Card icon={<Shield className="w-4 h-4" />} title="账号与权限" desc="账号基础信息与当前权限角色。">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">显示名称</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={!isAuthenticated}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">邮箱</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!isAuthenticated}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-slate-500 dark:text-slate-400">
                当前角色：<span className="font-semibold text-slate-700 dark:text-slate-200">{(user as any)?.role || 'user'}</span>
              </div>
              <button
                type="button"
                onClick={handleSaveAccount}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-200"
              >
                {saved ? '已保存' : '保存修改'}
              </button>
            </div>
          </Card>

          <Card icon={<Palette className="w-4 h-4" />} title="主题" desc="切换工作区外观主题。">
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'light' as Theme, label: '亮色' },
                { value: 'dark' as Theme, label: '深色' },
                { value: 'system' as Theme, label: '系统' },
              ].map((opt) => {
                const active = theme === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTheme(opt.value)}
                    className={cn(
                      'px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                      active
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-400 text-indigo-700 dark:text-indigo-300'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                    )}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </Card>

          <Card icon={<Languages className="w-4 h-4" />} title="语言" desc="设置系统展示语言。">
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="w-full sm:w-64 px-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              {LANG_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Card>

          <Card icon={<Keyboard className="w-4 h-4" />} title="快捷键" desc="常用操作键位说明。">
            <div className="space-y-2">
              {SHORTCUTS.map((item) => (
                <div key={item.action} className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 px-3 py-2">
                  <span className="text-sm text-slate-700 dark:text-slate-200">{item.action}</span>
                  <span className="inline-flex items-center gap-1">
                    {item.keys.map((k) => (
                      <kbd key={k} className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {k}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </Card>

        </div>
      </div>
    </WorkspaceLayout>
  )
}

import { Activity, ClipboardList, ShieldCheck, Users, Waypoints, UserCog } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { clearToken, getToken, parseJwtRole } from '../lib/auth'

const menus = [
  { to: '/', label: '概览', icon: Activity },
  { to: '/users', label: '用户管理', icon: Users },
  { to: '/members', label: '成员管理', icon: UserCog },
  { to: '/logs/requests', label: '接口日志', icon: ClipboardList },
  { to: '/logs/errors', label: '报错日志', icon: ShieldCheck },
  { to: '/traces', label: '链路追踪', icon: Waypoints },
  { to: '/permissions', label: '权限审计', icon: ShieldCheck },
]

const roleMap: Record<string, string> = {
  admin: '管理员',
  member: '成员',
  user: '普通用户',
}

export default function AppShell() {
  const navigate = useNavigate()
  const role = parseJwtRole(getToken())

  const handleLogout = () => {
    clearToken()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#ECEFF3] text-slate-800">
      <div className="mx-auto grid min-h-screen max-w-[1760px] grid-cols-1 lg:grid-cols-[252px_1fr]">
        <aside className="border-r border-[#d7dde7] bg-[#EEF1F5]">
          <div className="border-b border-[#d7dde7] px-6 py-7">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Resume Agent</p>
            <h1 className="mt-1.5 font-display text-[2rem] font-bold text-slate-900">管理后台</h1>
            <p className="mt-2 text-sm text-slate-500">当前角色：{role ? roleMap[role] || role : '未知'}</p>
          </div>
          <nav className="space-y-1.5 p-4">
            {menus.map((menu) => {
              const Icon = menu.icon
              return (
                <NavLink
                  key={menu.to}
                  to={menu.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-base transition ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-[0_8px_22px_rgba(15,23,42,0.07)] ring-1 ring-[#dbe3f3]'
                        : 'text-slate-600 hover:bg-white/75 hover:text-slate-900'
                    }`
                  }
                >
                  <Icon className="h-[18px] w-[18px]" />
                  <span>{menu.label}</span>
                </NavLink>
              )
            })}
          </nav>
        </aside>

        <main className="p-5 sm:p-7 lg:p-9">
          <header className="mb-6 flex items-center justify-between rounded-2xl border border-[#dce2eb] bg-[#F8FAFC] px-5 py-4 shadow-[0_6px_20px_rgba(15,23,42,0.04)]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">管理中心</p>
              <p className="text-2xl font-semibold text-slate-900">平台运营面板</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-[#d4dbe6] px-3.5 py-2.5 text-base text-slate-700 hover:bg-white"
            >
              退出登录
            </button>
          </header>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

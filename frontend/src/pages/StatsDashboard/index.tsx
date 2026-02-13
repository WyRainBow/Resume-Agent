import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Send, CalendarRange, Activity } from 'lucide-react'
import WorkspaceLayout from '@/pages/WorkspaceLayout'
import { useAuth } from '@/contexts/AuthContext'
import { getAllResumes } from '@/services/resumeStorage'
import { listApplicationProgress, type ApplicationProgressEntry } from '@/services/applicationProgressApi'
import type { SavedResume } from '@/services/storage/StorageAdapter'
import { KpiCard } from './components/KpiCard'
import { MiniLineChart } from './components/MiniLineChart'
import { DonutChart } from './components/DonutChart'
import { buildDailyTrend, buildKpis, buildProgressDistribution } from './utils/metrics'

export default function StatsDashboardPage() {
  const { isAuthenticated, user, openModal } = useAuth()
  const [loading, setLoading] = useState(true)
  const [resumes, setResumes] = useState<SavedResume[]>([])
  const [entries, setEntries] = useState<ApplicationProgressEntry[]>([])

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      openModal('login')
      return
    }
    let alive = true
    const load = async () => {
      setLoading(true)
      try {
        const [resumeList, progressList] = await Promise.all([
          getAllResumes(),
          listApplicationProgress(),
        ])
        if (!alive) return
        setResumes(resumeList)
        setEntries(progressList)
      } catch (err) {
        console.error(err)
        if (!alive) return
        setResumes([])
        setEntries([])
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [isAuthenticated, openModal])

  const kpis = useMemo(() => buildKpis(resumes, entries), [resumes, entries])
  const trend = useMemo(() => buildDailyTrend(entries), [entries])
  const distribution = useMemo(() => buildProgressDistribution(entries), [entries])

  if (!isAuthenticated) {
    return (
      <WorkspaceLayout>
        <div className="h-full flex items-center justify-center bg-white text-slate-600">
          请先登录后查看统计仪表盘。
        </div>
      </WorkspaceLayout>
    )
  }

  return (
    <WorkspaceLayout>
      <div className="relative h-full overflow-y-auto bg-[#EEF4FF]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 12% 8%, rgba(14,165,233,0.16), transparent 34%), radial-gradient(circle at 92% 0%, rgba(37,99,235,0.22), transparent 30%), linear-gradient(transparent 95%, rgba(37,99,235,0.06) 100%)',
          }}
        />
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(90deg, #1e3a8a 1px, transparent 1px), linear-gradient(#1e3a8a 1px, transparent 1px)', backgroundSize: '42px 42px' }} />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative z-10 mx-auto max-w-[1660px] p-6 sm:p-9"
          style={{ fontFamily: "'Space Grotesk','Sora','PingFang SC','Noto Sans SC',sans-serif" }}
        >
          <div className="mb-7 rounded-3xl border border-white/70 bg-white/75 p-6 shadow-[0_24px_60px_rgba(30,64,175,0.16)] backdrop-blur-xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-2 inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
                  Analytics Hub
                </div>
                <h1 className="text-4xl font-black tracking-tight text-slate-900">仪表盘</h1>
                <p className="mt-1.5 text-base font-medium text-slate-600">
                  欢迎回来：{user?.username || '同学'} · 最后更新 {new Date().toLocaleString('zh-CN', { hour12: false })}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">本周概览</p>
                <p className="mt-1 text-sm font-bold text-slate-800">
                  投递 {kpis.last7DaysCount} 份 · 活跃流程 {kpis.activePipelineCount} 份
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">统计数据加载中...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard title="简历总数" value={kpis.resumeCount} hint="当前账号下简历数量" icon={FileText} index={0} />
                <KpiCard title="投递总数" value={kpis.applicationCount} hint="累计投递记录数量" icon={Send} index={1} />
                <KpiCard title="近7天投递" value={kpis.last7DaysCount} hint="按投递时间统计" icon={CalendarRange} index={2} />
                <KpiCard title="活跃流程中" value={kpis.activePipelineCount} hint="已排除刷掉与简历挂" icon={Activity} index={3} />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.12 }}
                  className="xl:col-span-2"
                >
                  <MiniLineChart data={trend} />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.2 }}
                >
                  <DonutChart data={distribution} />
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.28 }}
                className="mt-5 rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xl font-black tracking-tight text-slate-900">状态快照</h3>
                  <span className="text-sm font-medium text-slate-500">按当前账号聚合</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {distribution.length === 0 ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-500">暂无状态数据</span>
                  ) : (
                    distribution.slice(0, 8).map((item) => (
                      <span
                        key={item.label}
                        className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700"
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span>{item.label}</span>
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                        <span>{item.value}</span>
                      </span>
                    ))
                  )}
                </div>
              </motion.div>
            </>
          )}
        </motion.div>
      </div>
    </WorkspaceLayout>
  )
}

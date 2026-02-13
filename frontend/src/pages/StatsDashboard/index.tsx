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
      <div
        className="h-full overflow-y-auto bg-[#F4F8FF]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 10%, rgba(56, 189, 248, 0.14), transparent 34%), radial-gradient(circle at 90% 0%, rgba(59, 130, 246, 0.16), transparent 28%)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mx-auto max-w-[1440px] p-5 sm:p-7"
        >
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white/85 p-5 backdrop-blur-md">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">仪表盘</h1>
            <p className="mt-1 text-sm font-medium text-slate-600">
              欢迎回来，{user?.username || '同学'} · 最后更新 {new Date().toLocaleString('zh-CN', { hour12: false })}
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">统计数据加载中...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard title="简历总数" value={kpis.resumeCount} hint="当前账号下简历数量" icon={FileText} index={0} />
                <KpiCard title="投递总数" value={kpis.applicationCount} hint="累计投递记录数量" icon={Send} index={1} />
                <KpiCard title="近7天投递" value={kpis.last7DaysCount} hint="按投递时间统计" icon={CalendarRange} index={2} />
                <KpiCard title="活跃流程中" value={kpis.activePipelineCount} hint="已排除刷掉与简历挂" icon={Activity} index={3} />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
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
            </>
          )}
        </motion.div>
      </div>
    </WorkspaceLayout>
  )
}

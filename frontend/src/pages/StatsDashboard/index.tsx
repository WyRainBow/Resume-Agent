import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Send, CalendarRange, Activity } from 'lucide-react'
import WorkspaceLayout from '@/pages/WorkspaceLayout'
import { useAuth } from '@/contexts/AuthContext'
import type { ApplicationProgressEntry } from '@/services/applicationProgressApi'
import { getDashboardSummary } from '@/services/dashboardApi'
import { KpiCard } from './components/KpiCard'
import { MiniLineChart } from './components/MiniLineChart'
import { DonutChart } from './components/DonutChart'
import { buildDailyTrend, buildKpisFromCount, buildProgressDistribution, buildProgressDistributionThisWeek } from './utils/metrics'
import { getApiBaseUrl } from '@/lib/runtimeEnv'

function getDashboardPerfEndpoint() {
  return `${getApiBaseUrl()}/api/dashboard/perf-log`
}

function reportDashboardPerf(message: string, step?: string, elapsedMs?: number) {
  try {
    const payload = JSON.stringify({
      message,
      step,
      elapsed_ms: elapsedMs,
      pathname: window.location.pathname,
      ts: Date.now(),
    })
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' })
      navigator.sendBeacon(getDashboardPerfEndpoint(), blob)
      return
    }
    void fetch(getDashboardPerfEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    })
  } catch {
    // ignore report failures
  }
}

export default function StatsDashboardPage() {
  const { isAuthenticated, user, openModal, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [resumeCount, setResumeCount] = useState(0)
  const [entries, setEntries] = useState<Array<Pick<ApplicationProgressEntry, 'progress' | 'application_date'>>>([])
  const [interviewCount, setInterviewCount] = useState(0)
  const [interviewCountThisWeek, setInterviewCountThisWeek] = useState(0)
  const pageEnterAtRef = useRef<number>(performance.now())
  const hasReportedEnterRef = useRef(false)
  const hasRequestedSummaryRef = useRef(false)

  useEffect(() => {
    const effectStartAt = performance.now()
    const userLabel = String(user?.id || user?.username || user?.email || 'anonymous')
    if (!hasReportedEnterRef.current) {
      reportDashboardPerf(`进入 /dashboard user=${userLabel}`, 'enter')
      hasReportedEnterRef.current = true
    }
    if (authLoading) {
      const elapsed = Math.round(performance.now() - effectStartAt)
      reportDashboardPerf(`等待鉴权初始化中... ${elapsed}ms`, 'auth_init_wait', elapsed)
      return
    }
    if (!isAuthenticated) {
      setLoading(false)
      const elapsed = Math.round(performance.now() - effectStartAt)
      reportDashboardPerf(`未登录，触发登录弹窗 ${elapsed}ms`, 'auth_modal', elapsed)
      openModal('login')
      return
    }
    if (hasRequestedSummaryRef.current) {
      return
    }
    hasRequestedSummaryRef.current = true
    pageEnterAtRef.current = performance.now()
    const cacheElapsed = Math.round(performance.now() - effectStartAt)
    reportDashboardPerf(`缓存未命中（缓存关闭） ${cacheElapsed}ms`, 'cache_miss', cacheElapsed)

    let alive = true
    const load = async () => {
      const loadStartAt = performance.now()
      setLoading(true)
      try {
        const summaryStartAt = performance.now()
        const summaryRes = await getDashboardSummary()
        if (!alive) return
        setResumeCount(summaryRes.resume_count || 0)
        setEntries(summaryRes.entries || [])
        setInterviewCount(summaryRes.interview_count ?? 0)
        setInterviewCountThisWeek(summaryRes.interview_count_this_week ?? 0)
        const totalElapsed = Math.round(performance.now() - loadStartAt)
        const summaryElapsed = Math.round(performance.now() - summaryStartAt)
        const resumeMs = summaryRes.metrics?.resume_query_ms ?? summaryElapsed
        const progressMs = summaryRes.metrics?.progress_query_ms ?? summaryElapsed
        reportDashboardPerf(
          `resumes接口 ${resumeMs}ms, ` +
            `progress接口 ${progressMs}ms, ` +
            `数据刷新总耗时=${totalElapsed}ms`,
          'data_refresh',
          totalElapsed
        )
      } catch (err) {
        console.error(err)
        if (!alive) return
        setResumeCount(0)
        setEntries([])
        setInterviewCount(0)
        setInterviewCountThisWeek(0)
      } finally {
        if (alive) {
          setLoading(false)
          requestAnimationFrame(() => {
            const total = Math.round(performance.now() - pageEnterAtRef.current)
            reportDashboardPerf(`页面可用耗时=${total}ms（含渲染）`, 'page_ready', total)
          })
        }
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [authLoading, isAuthenticated, openModal])

  const kpis = useMemo(() => buildKpisFromCount(resumeCount, entries), [resumeCount, entries])
  const trend = useMemo(() => buildDailyTrend(entries), [entries])
  const distributionThisWeek = useMemo(
    () => buildProgressDistributionThisWeek(entries, interviewCountThisWeek),
    [entries, interviewCountThisWeek]
  )
  const distributionTotal = useMemo(
    () => buildProgressDistribution(entries, interviewCount),
    [entries, interviewCount]
  )
  const sectionStagger = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.05 },
    },
  }
  const sectionItem = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  }

  if (authLoading) {
    return (
      <WorkspaceLayout>
        <div className="h-full flex items-center justify-center bg-white text-slate-600">
          正在验证登录状态...
        </div>
      </WorkspaceLayout>
    )
  }

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
      <div className="relative h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative z-10 mx-auto max-w-[1660px] p-6 sm:p-9"
        >
          <motion.div
            className="mb-7 rounded-[2rem] border border-slate-200/60 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
          >
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase">仪表盘</h1>
              </div>
              <div className="rounded-2xl bg-blue-50/50 p-5 border border-blue-100/50">
                <div className="flex items-center gap-4 text-sm font-black text-slate-900">
                  <span>投递 {kpis.thisWeekApplicationCount}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span>流程 {kpis.activePipelineThisWeekCount}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span>面试 {interviewCountThisWeek}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {loading ? (
            <div className="rounded-[2rem] border border-slate-200/60 bg-white p-20 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
              <p className="mt-4 text-sm font-black uppercase tracking-widest text-slate-400">Loading Analytics...</p>
            </div>
          ) : (
            <>
              <motion.div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4" variants={sectionStagger} initial="hidden" animate="show">
                <motion.div variants={sectionItem}><KpiCard title="简历总数" value={kpis.resumeCount} hint="当前账号下简历数量" icon={FileText} index={0} /></motion.div>
                <motion.div variants={sectionItem}><KpiCard title="投递总数" value={kpis.applicationCount} hint="累计投递记录数量" icon={Send} index={1} /></motion.div>
                <motion.div variants={sectionItem}><KpiCard title="面试总数" value={interviewCount} hint="从面试日历统计" icon={CalendarRange} index={2} /></motion.div>
                <motion.div variants={sectionItem}><KpiCard title="活跃流程中" value={kpis.activePipelineCount} hint="已排除刷掉与简历挂" icon={Activity} index={3} /></motion.div>
              </motion.div>

              <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.12 }}
                  className="rounded-[2rem] border border-slate-200/60 bg-white p-2 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden"
                >
                  <DonutChart data={distributionThisWeek} title="本周进展状态分布" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.2 }}
                  className="rounded-[2rem] border border-slate-200/60 bg-white p-2 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden"
                >
                  <DonutChart data={distributionTotal} title="总共进展状态分布" />
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.22 }}
                className="mt-8 rounded-[2rem] border border-slate-200/60 bg-white p-2 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden"
              >
                <MiniLineChart data={trend} />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.28 }}
                className="mt-8 rounded-[2rem] border border-slate-200/60 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
              >
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-xl font-black tracking-tighter text-slate-900 uppercase">状态快照</h3>
                </div>
                <div className="flex flex-wrap gap-3">
                  {distributionTotal.length === 0 ? (
                    <span className="text-sm font-bold text-slate-300 uppercase tracking-widest">No data available</span>
                  ) : (
                    distributionTotal.slice(0, 8).map((item, idx) => (
                      <motion.span
                        key={item.label}
                        className="inline-flex items-center gap-3 whitespace-nowrap rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-black text-slate-900 transition-all hover:bg-white hover:shadow-md hover:-translate-y-0.5"
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.22, delay: 0.34 + idx * 0.04 }}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="uppercase tracking-tight">{item.label === '面试' ? '面试  ' : item.label}</span>
                        <span className="text-slate-400">{item.label === '面试' ? ` ${item.value} 场` : item.value}</span>
                      </motion.span>
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

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
import { buildDailyTrend, buildKpisFromCount, buildProgressDistribution } from './utils/metrics'

const rawApiBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || ''
const API_BASE = rawApiBase
  ? (rawApiBase.startsWith('http') ? rawApiBase : `https://${rawApiBase}`)
  : (import.meta.env.PROD ? '' : 'http://localhost:9000')
const DASHBOARD_PERF_ENDPOINT = `${API_BASE}/api/dashboard/perf-log`

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
      navigator.sendBeacon(DASHBOARD_PERF_ENDPOINT, blob)
      return
    }
    void fetch(DASHBOARD_PERF_ENDPOINT, {
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
  const distribution = useMemo(() => buildProgressDistribution(entries), [entries])
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
      <div className="relative h-full overflow-y-auto bg-[#EEF4FF]">
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 12% 8%, rgba(14,165,233,0.16), transparent 34%), radial-gradient(circle at 92% 0%, rgba(37,99,235,0.22), transparent 30%), linear-gradient(transparent 95%, rgba(37,99,235,0.06) 100%)',
          }}
          animate={{ opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(90deg, #1e3a8a 1px, transparent 1px), linear-gradient(#1e3a8a 1px, transparent 1px)', backgroundSize: '42px 42px' }} />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative z-10 mx-auto max-w-[1660px] p-6 sm:p-9"
          style={{ fontFamily: "'Space Grotesk','Sora','PingFang SC','Noto Sans SC',sans-serif" }}
        >
          <motion.div
            className="mb-7 rounded-3xl border border-white/70 bg-white/75 p-6 shadow-[0_24px_60px_rgba(30,64,175,0.16)] backdrop-blur-xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
          >
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
          </motion.div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">统计数据加载中...</div>
          ) : (
            <>
              <motion.div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4" variants={sectionStagger} initial="hidden" animate="show">
                <motion.div variants={sectionItem}><KpiCard title="简历总数" value={kpis.resumeCount} hint="当前账号下简历数量" icon={FileText} index={0} /></motion.div>
                <motion.div variants={sectionItem}><KpiCard title="投递总数" value={kpis.applicationCount} hint="累计投递记录数量" icon={Send} index={1} /></motion.div>
                <motion.div variants={sectionItem}><KpiCard title="近7天投递" value={kpis.last7DaysCount} hint="按投递时间统计" icon={CalendarRange} index={2} /></motion.div>
                <motion.div variants={sectionItem}><KpiCard title="活跃流程中" value={kpis.activePipelineCount} hint="已排除刷掉与简历挂" icon={Activity} index={3} /></motion.div>
              </motion.div>

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
                    distribution.slice(0, 8).map((item, idx) => (
                      <motion.span
                        key={item.label}
                        className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700"
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.22, delay: 0.34 + idx * 0.04 }}
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span>{item.label}</span>
                        <span>{item.value}</span>
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

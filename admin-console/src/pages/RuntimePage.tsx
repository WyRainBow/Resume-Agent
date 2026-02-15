import { useEffect, useMemo, useState } from 'react'
import { Panel } from '../components/Panel'
import { execRuntimeCommand, getRuntimeLogs, getRuntimeStatus, restartRuntimeService } from '../lib/adminApi'
import { getToken, parseJwtRole } from '../lib/auth'

type Stream = 'out' | 'error'

function formatBytes(v: number | null | undefined) {
  if (!v && v !== 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let n = v
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i += 1
  }
  return `${n.toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

export default function RuntimePage() {
  const role = parseJwtRole(getToken())
  const isAdmin = role === 'admin'

  const [service, setService] = useState('resume-backend')
  const [status, setStatus] = useState<any>(null)
  const [statusErr, setStatusErr] = useState<string | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)

  const [stream, setStream] = useState<Stream>('error')
  const [lines, setLines] = useState(200)
  const [logs, setLogs] = useState<{ path: string; content: string } | null>(null)
  const [logsErr, setLogsErr] = useState<string | null>(null)
  const [logsLoading, setLogsLoading] = useState(false)

  const [cmd, setCmd] = useState('pm2 ls')
  const [cmdRes, setCmdRes] = useState<{ stdout: string; stderr: string; exit_code: number; duration_ms: number } | null>(null)
  const [cmdErr, setCmdErr] = useState<string | null>(null)
  const [cmdLoading, setCmdLoading] = useState(false)

  const summary = useMemo(() => {
    const proc = status?.pm2?.process
    const db = status?.database
    const git = status?.git
    const disk = status?.system?.disk
    return {
      pm2Ok: Boolean(status?.pm2?.ok),
      serviceStatus: proc?.status || '-',
      pid: proc?.pid ?? '-',
      restarts: proc?.restart_time ?? '-',
      uptime: proc?.pm_uptime ? new Date(proc.pm_uptime).toLocaleString() : '-',
      mem: formatBytes(proc?.memory_bytes),
      cpu: proc?.cpu_percent != null ? `${proc.cpu_percent}%` : '-',
      db: db?.ok ? `${db.dialect || 'db'} OK (${db.latency_ms ?? '-'}ms)` : `DB FAIL`,
      git: git?.available ? `${(git.commit || '').slice(0, 10)} (${git.branch || '-'})${git.dirty ? ' dirty' : ''}` : '-',
      disk: disk ? `${formatBytes(disk.free_bytes)} free / ${formatBytes(disk.total_bytes)} total` : '-',
    }
  }, [status])

  const loadStatus = async () => {
    setStatusLoading(true)
    setStatusErr(null)
    try {
      const data = await getRuntimeStatus({ service })
      setStatus(data)
    } catch (e: any) {
      setStatusErr(e?.response?.data?.detail || e?.message || '加载失败')
    } finally {
      setStatusLoading(false)
    }
  }

  const loadLogs = async () => {
    setLogsLoading(true)
    setLogsErr(null)
    try {
      const data = await getRuntimeLogs({ service, stream, lines })
      setLogs({ path: data.path, content: data.content })
    } catch (e: any) {
      setLogsErr(e?.response?.data?.detail || e?.message || '加载失败')
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => {
    void loadStatus()
    void loadLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void loadLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, stream, lines])

  const restart = async () => {
    if (!isAdmin) return
    const ok = confirm(`确认重启服务：${service}？`)
    if (!ok) return
    try {
      await restartRuntimeService({ service })
      await loadStatus()
      await loadLogs()
      alert('已触发重启')
    } catch (e: any) {
      alert(e?.response?.data?.detail || e?.message || '重启失败')
    }
  }

  const execCmd = async () => {
    if (!isAdmin) return
    setCmdLoading(true)
    setCmdErr(null)
    setCmdRes(null)
    try {
      const data = await execRuntimeCommand({ command: cmd, timeout_sec: 30 })
      setCmdRes({ stdout: data.stdout, stderr: data.stderr, exit_code: data.exit_code, duration_ms: data.duration_ms })
    } catch (e: any) {
      setCmdErr(e?.response?.data?.detail || e?.message || '执行失败')
    } finally {
      setCmdLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#dde3ec] bg-[#f5f7fa] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">服务状态</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900">{summary.serviceStatus}</p>
        </div>
        <div className="rounded-2xl border border-[#dde3ec] bg-[#f5f7fa] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">资源</p>
          <p className="mt-2 font-mono text-base text-slate-900">mem: {summary.mem}</p>
          <p className="mt-1 font-mono text-base text-slate-900">cpu: {summary.cpu}</p>
        </div>
        <div className="rounded-2xl border border-[#dde3ec] bg-[#f5f7fa] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">数据库</p>
          <p className="mt-2 font-mono text-base text-slate-900">{summary.db}</p>
        </div>
        <div className="rounded-2xl border border-[#dde3ec] bg-[#f5f7fa] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">版本</p>
          <p className="mt-2 font-mono text-base text-slate-900">{summary.git}</p>
        </div>
      </div>

      <Panel
        title="运行信息"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="w-[220px] rounded-lg border border-[#d4dbe6] bg-white px-3 py-2 text-sm text-slate-800"
              placeholder="service name"
            />
            <button
              type="button"
              onClick={loadStatus}
              disabled={statusLoading}
              className="rounded-lg border border-[#d4dbe6] px-3.5 py-2 text-sm text-slate-700 hover:bg-white disabled:opacity-60"
            >
              刷新状态
            </button>
            {isAdmin ? (
              <button
                type="button"
                onClick={restart}
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm text-red-700 hover:bg-red-100"
              >
                重启服务
              </button>
            ) : null}
          </div>
        }
      >
        {statusErr ? <p className="text-sm text-red-600">{statusErr}</p> : null}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[#dde3ec] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">PM2</p>
            <div className="mt-2 space-y-1 text-sm text-slate-700">
              <p>pid: <span className="font-mono">{summary.pid}</span></p>
              <p>restarts: <span className="font-mono">{summary.restarts}</span></p>
              <p>uptime: <span className="font-mono">{summary.uptime}</span></p>
            </div>
          </div>
          <div className="rounded-xl border border-[#dde3ec] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">系统</p>
            <div className="mt-2 space-y-1 text-sm text-slate-700">
              <p>disk: <span className="font-mono">{summary.disk}</span></p>
              <p>time(utc): <span className="font-mono">{status?.server_time_utc || '-'}</span></p>
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title="PM2 日志"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={stream}
              onChange={(e) => setStream(e.target.value as Stream)}
              className="rounded-lg border border-[#d4dbe6] bg-white px-3 py-2 text-sm text-slate-800"
            >
              <option value="error">error</option>
              <option value="out">out</option>
            </select>
            <select
              value={lines}
              onChange={(e) => setLines(parseInt(e.target.value, 10))}
              className="rounded-lg border border-[#d4dbe6] bg-white px-3 py-2 text-sm text-slate-800"
            >
              <option value={200}>200 行</option>
              <option value={500}>500 行</option>
              <option value={1000}>1000 行</option>
              <option value={2000}>2000 行</option>
            </select>
            <button
              type="button"
              onClick={loadLogs}
              disabled={logsLoading}
              className="rounded-lg border border-[#d4dbe6] px-3.5 py-2 text-sm text-slate-700 hover:bg-white disabled:opacity-60"
            >
              刷新日志
            </button>
          </div>
        }
      >
        {logsErr ? <p className="text-sm text-red-600">{logsErr}</p> : null}
        <p className="mb-2 text-xs text-slate-500">path: <span className="font-mono">{logs?.path || '-'}</span></p>
        <pre className="max-h-[520px] overflow-auto rounded-xl border border-[#dde3ec] bg-[#0b1220] p-4 text-xs leading-5 text-slate-100">
          {logs?.content || ''}
        </pre>
      </Panel>

      {isAdmin ? (
        <Panel title="受限命令执行">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <input
                value={cmd}
                onChange={(e) => setCmd(e.target.value)}
                className="min-w-[280px] flex-1 rounded-lg border border-[#d4dbe6] bg-white px-3 py-2 text-sm text-slate-800"
                placeholder="例如：pm2 ls"
              />
              <button
                type="button"
                onClick={execCmd}
                disabled={cmdLoading}
                className="rounded-lg border border-[#d4dbe6] px-3.5 py-2 text-sm text-slate-700 hover:bg-white disabled:opacity-60"
              >
                执行
              </button>
            </div>
            <p className="text-xs text-slate-500">
              说明：默认禁用 shell 元字符，仅允许少量命令（pm2/journalctl/ss/ps/df/du/free/uptime/cat/grep/tail/head/ls）。
            </p>
            {cmdErr ? <p className="text-sm text-red-600">{cmdErr}</p> : null}
            {cmdRes ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  exit_code: <span className="font-mono">{cmdRes.exit_code}</span>, duration: <span className="font-mono">{cmdRes.duration_ms}ms</span>
                </p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">stdout</p>
                    <pre className="max-h-[420px] overflow-auto rounded-xl border border-[#dde3ec] bg-[#0b1220] p-4 text-xs leading-5 text-slate-100">
                      {cmdRes.stdout || ''}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">stderr</p>
                    <pre className="max-h-[420px] overflow-auto rounded-xl border border-[#dde3ec] bg-[#0b1220] p-4 text-xs leading-5 text-slate-100">
                      {cmdRes.stderr || ''}
                    </pre>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </Panel>
      ) : null}
    </div>
  )
}


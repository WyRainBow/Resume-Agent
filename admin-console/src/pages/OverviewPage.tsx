import { useEffect, useState } from 'react'
import { getOverview } from '../lib/adminApi'
import { Panel } from '../components/Panel'

export default function OverviewPage() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    void getOverview().then(setData)
  }, [])

  const cards = [
    ['注册用户数', data?.total_users ?? '-'],
    ['成员人数', data?.total_members ?? '-'],
    ['24小时请求', data?.requests_24h ?? '-'],
    ['24小时错误', data?.errors_24h ?? '-'],
    ['错误率', data ? `${data.error_rate_24h}%` : '-'],
    ['平均延迟', data ? `${data.avg_latency_ms_24h} ms` : '-'],
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[#dde3ec] bg-[#f5f7fa] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
            <p className="mt-2 font-mono text-3xl font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>
      <Panel title="系统说明">
        <ul className="space-y-2 text-sm text-slate-600">
          <li>管理员可以管理全部账号角色和额度。</li>
          <li>成员可以管理 user/member，但不能操作 admin 账号。</li>
          <li>请求日志、报错日志、链路日志由后端中间件自动采集。</li>
        </ul>
      </Panel>
    </div>
  )
}

import { Sparkles, Wrench } from 'lucide-react'
import { LegalLayout } from './Legal/LegalLayout'
import { CHANGELOG, LATEST_CHANGELOG } from '@/data/changelog'

/** 更新日志页：复用法务页外壳，倒序展示完整版本历史。 */
export default function Changelog() {
  return (
    <LegalLayout title="更新日志" lastUpdated={LATEST_CHANGELOG.date}>
      <div className="space-y-10">
        {CHANGELOG.map(({ version, date, added, fixed }) => (
          <section key={version}>
            <div className="mb-4 flex items-baseline gap-3">
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">v{version}</h2>
              <span className="text-sm text-slate-400 dark:text-slate-500">{date}</span>
            </div>

            {added && added.length > 0 && (
              <div className="mb-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  新增
                </h3>
                <ul className="space-y-1.5">
                  {added.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300"
                    >
                      <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-blue-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {fixed && fixed.length > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  <Wrench className="h-3.5 w-3.5" />
                  修复
                </h3>
                <ul className="space-y-1.5">
                  {fixed.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300"
                    >
                      <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}
      </div>
    </LegalLayout>
  )
}

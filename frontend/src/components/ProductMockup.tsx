import { motion } from 'framer-motion'
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  Eye,
  GripVertical,
  Info,
  Pencil,
  Check,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'

const popIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  transition: { type: 'spring' as const, stiffness: 120, damping: 20 }
}

export default function ProductMockup() {
  return (
    <div className="relative w-full max-w-6xl mx-auto min-h-[520px] flex items-center justify-center py-8">
      {/* 主应用窗口 */}
      <motion.div
        {...popIn}
        transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.5 }}
        className="relative z-10 w-full max-w-4xl bg-white rounded-xl shadow-[0_25px_80px_-12px_rgba(0,0,0,0.15)] border border-slate-200 overflow-hidden"
      >
        {/* 主窗口 Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Senior Data Scientist</h2>
            <p className="text-xs text-slate-500">Swire Coca-Cola Limited</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-slate-500">Saved</span>
            <span className="text-xs font-medium text-slate-500">Progress 0%</span>
            <button type="button" className="p-1.5 text-slate-400 hover:text-slate-600 rounded">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-4 gap-1">
          {['Job Summary', 'Compatibility', 'Resume', 'Cover Letter', 'Out Reach', 'Research', 'Interview'].map(
            (tab, i) => (
              <button
                key={tab}
                type="button"
                className={cn(
                  'px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors',
                  tab === 'Resume'
                    ? 'text-blue-600 border-blue-600'
                    : 'text-slate-500 border-transparent hover:text-slate-700'
                )}
              >
                {tab}
              </button>
            )
          )}
        </div>

        {/* 左右分栏 */}
        <div className="flex min-h-[340px]">
          {/* 左侧编辑面板 */}
          <div className="w-[42%] min-w-0 border-r border-slate-100 flex flex-col bg-slate-50/30">
            <div className="p-3 border-b border-slate-100 flex items-center gap-2">
              <span className="text-xs text-slate-700 truncate flex-1">Senior Data Scientist_Coca Cola</span>
              <button type="button" className="p-1 text-slate-400 hover:text-slate-600">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {[
                { label: 'Overview', open: false },
                { label: 'Resume Language', open: false },
                { label: 'Layout Formatting', open: false, icon: true },
                { label: 'Templates', open: false },
                { label: 'Resume Sections', open: false },
                { label: 'Personal Information', open: false },
                { label: 'Professional Summary', open: false, hasIcons: true },
                { label: 'Work Experience', open: true, children: ['MST LIMITED', 'ST Limited', 'works Limited'] }
              ].map((item) => (
                <div key={item.label} className="border-b border-slate-100/80">
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100/80"
                  >
                    {item.open ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.icon && <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                    {item.hasIcons && (
                      <span className="flex items-center gap-1 shrink-0">
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                      </span>
                    )}
                  </button>
                  {item.open && item.children && (
                    <div className="pl-6 pr-2 pb-2 space-y-1">
                      {item.children.map((child) => (
                        <div
                          key={child}
                          className="flex items-center gap-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100/80 rounded px-2"
                        >
                          <Eye className="w-3 h-3 text-slate-400 shrink-0" />
                          <GripVertical className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate flex-1">{child}</span>
                          <Trash2 className="w-3 h-3 text-slate-400 shrink-0" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 右侧预览 */}
          <div className="flex-1 min-w-0 flex flex-col bg-white">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700">Preview</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded"
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  className="px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
                >
                  Download pdf
                </button>
                <button
                  type="button"
                  className="px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
                >
                  Download Docx
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-1.5 border-b border-slate-100">
              <button type="button" className="w-6 h-6 flex items-center justify-center text-slate-500 border border-slate-200 rounded text-sm">
                -
              </button>
              <span className="text-xs text-slate-600">74%</span>
              <button type="button" className="w-6 h-6 flex items-center justify-center text-slate-500 border border-slate-200 rounded text-sm">
                +
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-50/50 text-[10px] text-slate-700 leading-snug">
              <p className="font-bold text-slate-900 text-xs">Smithson, Arnold</p>
              <p className="text-slate-600 mt-0.5">Phone · arnold.smithson@gmail.com · https://www.linkedin.com/in/arnold-smithson-1234</p>
              <p className="text-slate-600">NY, United States</p>
              <p className="font-bold text-slate-800 mt-3 uppercase tracking-wide">Work Experience</p>
              {['MST LIMITED', 'ARTWORKS LIMITED', 'SENSRAI LIMITED'].map((company, i) => (
                <div key={company} className="mt-2">
                  <p className="font-semibold text-slate-800">{company}</p>
                  <p className="text-slate-500">APR 2021 - PRESENT</p>
                  <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-slate-600">
                    <li>Bullet point description placeholder for resume content.</li>
                    <li>Second achievement or responsibility line.</li>
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* 浮层 1：主菜单 - 左上 */}
      <motion.div
        {...popIn}
        transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.7 }}
        className="absolute left-0 top-8 z-20 w-56 bg-white rounded-xl border border-slate-200 shadow-xl p-4"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            1
          </div>
          <span className="font-bold text-slate-900 text-sm">FirstResume</span>
        </div>
        <button
          type="button"
          className="w-full py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg mb-3"
        >
          + New Application
        </button>
        <nav className="space-y-0.5 text-sm text-slate-600">
          {['My Applications', 'Questions Bank', 'Pathfinder', 'Resume Builder', 'My Profile'].map((item) => (
            <div key={item} className="py-1.5 px-2 rounded hover:bg-slate-50 cursor-pointer flex items-center gap-2">
              {item}
            </div>
          ))}
        </nav>
      </motion.div>

      {/* 浮层 2：Regenerate Bullet Point - 左中 */}
      <motion.div
        {...popIn}
        transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.82 }}
        className="absolute left-4 top-[40%] z-20 w-64 bg-white rounded-xl border border-slate-200 shadow-xl p-4"
      >
        <h3 className="text-sm font-bold text-slate-800 mb-2">Regenerate Bullet Point</h3>
        <p className="text-xs text-slate-500 mb-3">Want to tell the ai what you don&apos;t like</p>
        <input
          type="text"
          placeholder="Optional"
          readOnly
          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
        />
      </motion.div>

      {/* 浮层 3：Select skills - 左下 */}
      <motion.div
        {...popIn}
        transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.94 }}
        className="absolute left-0 bottom-4 z-20 w-72 bg-white rounded-xl border border-slate-200 shadow-xl p-4"
      >
        <h3 className="text-sm font-bold text-slate-800 mb-3">Select skills you want to add from below.</h3>
        <div className="flex flex-wrap gap-2">
          {['Risk Management', 'Control Environment', 'Interpersonal Skills', 'Data Analytics', 'Software...'].map(
            (skill) => (
              <span
                key={skill}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700"
              >
                {skill}
              </span>
            )
          )}
        </div>
      </motion.div>

      {/* 浮层 4：Templates - 左下偏中 */}
      <motion.div
        {...popIn}
        transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.88 }}
        className="absolute left-12 bottom-20 z-20 w-64 bg-white rounded-xl border border-slate-200 shadow-xl p-4"
      >
        <h3 className="text-sm font-bold text-slate-800 mb-3">Templates</h3>
        <div className="space-y-2">
          {[
            { name: 'Classic (Recommended)', active: true },
            { name: 'Classic Photo', active: false },
            { name: 'Stylish Blue', active: false }
          ].map((t) => (
            <div
              key={t.name}
              className={cn(
                'flex items-center justify-center h-12 rounded-lg border-2 text-xs font-medium',
                t.active ? 'border-blue-500 bg-blue-50/50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-600'
              )}
            >
              {t.name}
            </div>
          ))}
        </div>
      </motion.div>

      {/* 浮层 5：Layout Formatting - 右上 */}
      <motion.div
        {...popIn}
        transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.76 }}
        className="absolute right-4 top-12 z-20 w-56 bg-white rounded-xl border border-slate-200 shadow-xl p-4"
      >
        <h3 className="text-sm font-bold text-slate-800 mb-3">Layout Formatting</h3>
        <div className="flex gap-1 mb-3">
          {['Small', 'Regular', 'Large', 'Custom'].map((size, i) => (
            <button
              key={size}
              type="button"
              className={cn(
                'flex-1 py-1.5 text-[10px] font-medium rounded',
                size === 'Custom' ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-500'
              )}
            >
              {size}
            </button>
          ))}
        </div>
        <div className="space-y-2 text-[10px] text-slate-600">
          <div className="flex items-center justify-between">
            <span>10pt</span>
            <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-blue-500 rounded-full" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span>12pt</span>
            <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full w-2/3 bg-blue-500 rounded-full" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span>14pt</span>
            <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full w-full bg-blue-500 rounded-full" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span>1.3</span>
            <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full w-1/2 bg-blue-500 rounded-full" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span>30</span>
            <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full w-2/3 bg-blue-500 rounded-full" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* 浮层 6：Recommended Change - 右下 */}
      <motion.div
        {...popIn}
        transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 1 }}
        className="absolute right-0 bottom-8 z-20 w-80 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">Recommended</span>
            <button type="button" className="text-xs font-medium text-slate-700 hover:underline">
              Change Item
            </button>
            <span className="text-[10px] text-slate-500">Work Experience &gt; Artcade Ltd</span>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" className="p-1.5 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
            <button type="button" className="p-1.5 text-green-600 hover:text-green-700">
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-4 space-y-2">
          <div className="p-2 rounded bg-red-50 border border-red-100">
            <p className="text-[10px] text-red-700 line-through leading-relaxed">
              • Oversaw development of Web3 technologies, bridging traditional Web2 clients into blockchain-based
              solutions
            </p>
          </div>
          <div className="p-2 rounded bg-green-50 border border-green-100">
            <p className="text-[10px] text-green-800 leading-relaxed">
              • Oversaw development of Web3 technologies, bridging traditional Web2 clients into blockchain-based
              solutions while managing system architecture to ensure scalability and security.
            </p>
          </div>
          <details className="group">
            <summary className="text-xs font-medium text-slate-600 cursor-pointer flex items-center gap-1 list-none [&::-webkit-details-marker]:hidden">
              <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
              Why this change?
            </summary>
            <p className="text-[10px] text-slate-500 mt-2 pl-4 leading-relaxed">
              This change integrates &apos;System Architecture,&apos; a key skill from the user&apos;s profile, into the
              description of their Web3 technology experience, aligning it more closely with the job requirements.
            </p>
          </details>
        </div>
      </motion.div>
    </div>
  )
}

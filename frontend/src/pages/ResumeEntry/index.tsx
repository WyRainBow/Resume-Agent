/**
 * 简历入口页：为每份工作定制申请（图二样式中文版）
 * 粘贴职位描述、添加职位；探索职位入口
 */
import { useState } from 'react'
import WorkspaceLayout from '@/pages/WorkspaceLayout'

export default function ResumeEntryPage() {
  const [jobDescription, setJobDescription] = useState('')

  return (
    <WorkspaceLayout>
      <div className="h-full flex flex-col bg-[#F8F9FA] dark:bg-slate-950">
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 max-w-4xl mx-auto w-full">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 text-center mb-4">
            为每份工作定制申请
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-base md:text-lg text-center max-w-2xl mb-10">
            在下方框中粘贴职位描述并点击「添加职位」
            即可开始用 AI 跟踪并准备你的定制申请。不知道从哪开始？<a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">点击此处查看帮助</a>。
          </p>

          {/* 职位描述输入卡片 */}
          <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 md:p-8 mb-8">
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="粘贴职位描述文本"
              className="w-full min-h-[200px] rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 p-5 text-base resize-y focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent mb-5"
            />
            <div className="flex justify-end">
              <button
                type="button"
                className="px-6 py-3 rounded-xl bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500 font-medium text-base transition-colors"
              >
                添加职位
              </button>
            </div>
          </div>
        </div>

        {/* 页脚 */}
        <footer className="py-4 px-4 text-center text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-800">
          <a href="#" className="hover:text-slate-600 dark:hover:text-slate-400">高级版</a>
          {' · '}
          <a href="#" className="hover:text-slate-600 dark:hover:text-slate-400">博客</a>
          {' · '}
          <a href="#" className="hover:text-slate-600 dark:hover:text-slate-400">求职词典</a>
          {' · '}
          <a href="#" className="hover:text-slate-600 dark:hover:text-slate-400">条款与条件</a>
          {' · '}
          <a href="#" className="hover:text-slate-600 dark:hover:text-slate-400">隐私政策</a>
        </footer>
      </div>
    </WorkspaceLayout>
  )
}

import { ArrowRight, ChevronDown, Check, X, Play } from 'lucide-react'
import { useState } from 'react'

/**
 * Clico Clone（学习复刻用途）
 *
 * 复刻目标：https://tryclico.com/ai-for-google-docs
 *
 * 设计还原所有 sections（按文档顺序）：
 *   01 StickyNav   06 ResponsibleAI  11 ReadyCTA
 *   02 Hero        07 Research       12 RelatedGuides
 *   03 Pain        08 Comparison     13 Footer
 *   04 Workflow    09 Trust
 *   05 ParaEdit    10 FAQ
 *
 * 品牌文案统一改为本项目语境（Resume Agent / 文本框），不复用 Clico 视觉资产。
 */

// 共享设计 token —— 写在最顶部便于一次改色
const C = {
  ink: '#0a0a0a',
  bone: '#F6F3EC',
  cream: '#fffdf8',
  line: '#dadce0',
  mute: '#5a5a5a',
  mute2: '#777',
  green: '#C1F04C',
  greenDeep: '#274006',
  greenMute: '#5A7D11',
  greenWash: '#F8FFE8',
  greenWash2: '#EAF8E0',
  greenWash3: '#24350b',
  orange: '#F26B3A',
  blue: '#4285F4',
  blue2: '#1a73e8',
  blueWash: '#D7E7FF',
  purple: '#C8BFF5',
  purpleInk: '#343047',
  purpleMute: '#3f3a52',
  purple2: '#2f2944',
  purpleWash: '#EFE9F8',
  teal: '#DAF5F0',
  hairline: '#0a0a0a/15',
  // Google Docs mock 内嵌色
  docsBody: '#F1F3F4',
  docsInk: '#202124',
  docsMute: '#5f6368',
  docsHairline: '#eef0f2',
  docsSkeleton: '#e8eaed',
} as const

function StickyNav() {
  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between border-b-[1.5px] border-[#0a0a0a] h-14 px-5 bg-[#F6F3EC]">
      <a href="#" className="flex items-center gap-2.5 font-bold text-[15px] tracking-[-0.01em] text-[#0a0a0a] no-underline">
        <span
          aria-hidden
          className="grid place-items-center w-[26px] h-[26px] rounded-md bg-[#0a0a0a] text-[#C1F04C] font-black text-[13px]"
        >
          R
        </span>
        RESUME AGENT
      </a>
      <div className="hidden md:flex items-center gap-[2px]">
        <button
          type="button"
          className="px-3.5 py-[7px] text-[13px] font-medium text-[#5a5a5a] rounded-md inline-flex items-center gap-1.5 transition-colors hover:text-[#0a0a0a] hover:bg-black/[0.04]"
        >
          功能
          <ChevronDown className="h-3.5 w-3.5 translate-y-[0.5px]" strokeWidth={2} />
        </button>
        <a href="#pricing" className="px-3.5 py-[7px] text-[13px] font-medium text-[#5a5a5a] rounded-md no-underline transition-colors hover:text-[#0a0a0a] hover:bg-black/[0.04]">
          定价
        </a>
        <a href="#faq" className="px-3.5 py-[7px] text-[13px] font-medium text-[#5a5a5a] rounded-md no-underline transition-colors hover:text-[#0a0a0a] hover:bg-black/[0.04]">
          常见问题
        </a>
        <a href="#footer" className="px-3.5 py-[7px] text-[13px] font-medium text-[#5a5a5a] rounded-md no-underline transition-colors hover:text-[#0a0a0a] hover:bg-black/[0.04]">
          联系我们
        </a>
      </div>
      <div className="flex items-center gap-2">
        <a
          href="#ready"
          className="inline-flex items-center bg-[#C1F04C] text-[#0a0a0a] border-2 border-[#0a0a0a] px-[18px] py-2 text-[13px] font-bold rounded-md no-underline cursor-pointer transition-all duration-200"
          style={{ boxShadow: '2px 2px 0 #0a0a0a' }}
        >
          立即试用
        </a>
      </div>
    </nav>
  )
}

function FeatTag({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`inline-flex bg-[#D7E7FF] px-2 py-1 text-[10px] font-black uppercase tracking-[0.06em] text-[#1a73e8] ${className}`}>
      {children}
    </div>
  )
}

function Hero() {
  return (
    <section className="border-b-[1.5px] border-[#0a0a0a] bg-[#fffdf8] px-5 py-[clamp(56px,8vw,104px)] sm:px-6">
      <div className="mx-auto grid max-w-[1220px] items-center gap-12 lg:grid-cols-[0.86fr_1.14fr]">
        <div>
          <FeatTag className="mb-6">AI FOR WRITERS</FeatTag>
          <h1 className="font-serif text-[clamp(44px,6.8vw,82px)] font-normal leading-[0.98] tracking-[-0.03em] text-[#0a0a0a]">
            一段一段重写
            <br />
            <span className="text-[#4285F4]">在你写的地方发生。</span>
          </h1>
          <p className="mt-6 max-w-[650px] text-[17px] leading-[1.75] text-[#5a5a5a]">
            Resume Agent 让你在编辑器里逐段优化文本，调用 GPT / Claude / Gemini 的能力。不用复制粘贴，不用切走窗口。
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#ready"
              className="inline-flex items-center justify-center gap-2 bg-[#C1F04C] text-[#0a0a0a] border-2 border-[#0a0a0a] px-5 py-3 text-[14px] font-bold rounded-md no-underline transition-all duration-200"
              style={{ boxShadow: '3px 3px 0 #0a0a0a' }}
            >
              立即试用
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </a>
            <a
              href="#demo"
              className="inline-flex items-center justify-center gap-2 bg-white text-[#0a0a0a] border-2 border-[#0a0a0a] px-5 py-3 text-[14px] font-bold rounded-md no-underline transition-all duration-200"
              style={{ boxShadow: '3px 3px 0 #0a0a0a' }}
            >
              <Play className="h-4 w-4" strokeWidth={2} /> 看演示
            </a>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] font-black text-[#343434]">
            <span className="inline-flex items-center gap-2">
              <span className="text-[18px] leading-none text-[#0a0a0a]">✱</span>
              <span className="relative inline-block leading-tight">
                <span
                  aria-hidden
                  className="absolute inset-x-[-3px] bottom-0 h-[0.52em] translate-y-[1px]"
                  style={{ backgroundColor: C.green }}
                />
                <span className="relative">在任何文本框内可用</span>
              </span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="text-[18px] leading-none text-[#0a0a0a]">▰</span>
              <span className="relative inline-block leading-tight">
                <span
                  aria-hidden
                  className="absolute inset-x-[-3px] bottom-0 h-[0.52em] translate-y-[1px]"
                  style={{ backgroundColor: '#FFE86B' }}
                />
                <span className="relative">无需注册账号</span>
              </span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="text-[18px] leading-none text-[#0a0a0a]">✦</span>
              <span className="relative inline-block leading-tight">
                <span
                  aria-hidden
                  className="absolute inset-x-[-3px] bottom-0 h-[0.52em] translate-y-[1px]"
                  style={{ backgroundColor: '#FFB7D5' }}
                />
                <span className="relative">你的数据留在你这里</span>
              </span>
            </span>
          </div>
        </div>
        <DocsMock />
      </div>
    </section>
  )
}

function DocsMock() {
  return (
    <div className="overflow-visible">
      <div
        className="rounded-t-[12px] border-2 border-[#0a0a0a] bg-[#f1f3f4] flex items-center justify-between px-3 py-2"
        style={{ borderBottom: 'none' }}
      >
        <div className="flex items-center gap-1.5">
          <span className="block w-2.5 h-2.5 rounded-full bg-[#fc6058]" />
          <span className="block w-2.5 h-2.5 rounded-full bg-[#fdbc40]" />
          <span className="block w-2.5 h-2.5 rounded-full bg-[#34c84a]" />
        </div>
        <div className="text-[11px] text-[#5f6368] tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
          resume-agent.app/editor/故事梳理笔记
        </div>
        <span className="w-9" />
      </div>
      <div
        className="relative min-h-[520px] overflow-hidden bg-[#F1F3F4] p-0 rounded-b-[12px] border-2 border-[#0a0a0a] border-t-0"
      >
        <div className="border-b border-[#dadce0] bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="h-9 w-9 shrink-0 grid place-items-center rounded-md text-[#1a73e8] font-black text-[20px]"
              style={{ background: 'linear-gradient(135deg,#fff 0%,#e8f0fe 100%)' }}
              aria-hidden
            >
              ¶
            </div>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-medium text-[#202124]">编辑器里的笔记</div>
              <div className="mt-1 flex gap-4 overflow-hidden text-[12px] text-[#5f6368]">
                <span className="shrink-0">文件</span>
                <span className="shrink-0">编辑</span>
                <span className="shrink-0">视图</span>
                <span className="shrink-0">插入</span>
                <span className="shrink-0">格式</span>
                <span className="shrink-0">工具</span>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 overflow-hidden border-t border-[#eef0f2] pt-3 text-[11px] font-medium text-[#5f6368]">
            <span className="shrink-0 rounded-[4px] border border-[#dadce0] bg-white px-2.5 py-1.5">100%</span>
            <span className="shrink-0 rounded-[4px] border border-[#dadce0] bg-white px-2.5 py-1.5">正文</span>
            <span className="shrink-0 rounded-[4px] border border-[#dadce0] bg-white px-2.5 py-1.5">Sans</span>
            <span className="shrink-0 rounded-[4px] border border-[#dadce0] bg-white px-2.5 py-1.5">14</span>
            <span className="shrink-0 rounded-[4px] border border-[#dadce0] bg-white px-2.5 py-1.5 font-bold">B</span>
            <span className="shrink-0 rounded-[4px] border border-[#dadce0] bg-white px-2.5 py-1.5 italic">I</span>
            <span className="shrink-0 rounded-[4px] border border-[#dadce0] bg-white px-2.5 py-1.5 underline">U</span>
          </div>
        </div>
        <div className="relative px-4 py-6 sm:px-8">
          <div
            className="mx-auto min-h-[372px] w-full max-w-[560px] bg-white px-6 py-8 sm:px-10 lg:translate-x-[-8%]"
            style={{ boxShadow: '0 1px 2px rgba(60,64,67,0.2), 0 2px 6px rgba(60,64,67,0.15)' }}
          >
            <h3 className="font-serif text-[30px] leading-[1.05] text-[#202124] sm:text-[34px]">
              媒介素养笔记
            </h3>
            <p className="mt-5 text-[14px] leading-[1.75] text-[#3c4043]">
              社交媒体正在改变学生获取新闻的方式。它让信息更容易被发现，但也常常让缺乏依据的观点看起来比它实际更可靠。
            </p>
            <p className="mt-4 text-[14px] leading-[1.75] text-[#3c4043]">
              这一段话需要更清晰的措辞。它应该解释：为什么在写作之前，学生需要把一条观点拿来和可信信源去对比。
            </p>
            <div className="mt-5 space-y-2.5" aria-hidden>
              <div className="h-2.5 w-[92%] rounded-full bg-[#e8eaed]" />
              <div className="h-2.5 w-[80%] rounded-full bg-[#e8eaed]" />
              <div className="h-2.5 w-[70%] rounded-full bg-[#e8eaed]" />
            </div>
          </div>
          <div
            className="mt-5 w-full border-2 border-[#0a0a0a] bg-[#F6F3EC] px-4 pb-3 pt-3.5 lg:absolute lg:right-7 lg:top-[152px] lg:mt-0 lg:w-[350px]"
            style={{ boxShadow: '4px 4px 0 #0a0a0a' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 text-[22px] leading-[1.2] text-[#999] sm:text-[24px]">
                问我任何事……
                <span className="ml-0.5 inline-block h-[24px] w-[2px] animate-pulse bg-[#0a0a0a] align-[-4px]" />
              </div>
              <span className="shrink-0 text-[24px] leading-none text-[#0a0a0a]">×</span>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2 text-[14px] text-[#999]">
              <span>按住</span>
              <kbd className="inline-flex h-7 min-w-7 items-center justify-center rounded-[2px] bg-[#0a0a0a] px-1.5 text-[16px] font-semibold text-[#C1F04C]" style={{ boxShadow: '0 2px 0 #5a5a5a' }}>
                ⌘
              </kbd>
              <span>说话</span>
              <span className="text-[#c9c4bc]">·</span>
              <kbd className="inline-flex h-7 items-center justify-center rounded-[2px] bg-[#0a0a0a] px-2 text-[14px] font-semibold text-[#C1F04C]" style={{ boxShadow: '0 2px 0 #5a5a5a' }}>
                ESC
              </kbd>
              <span>关闭</span>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-[12px] font-semibold text-[#777]">
        选中一段 → 让 Agent 改写 → 审阅后直接采用 → 留在原文里继续写。
      </p>
    </div>
  )
}

function Pain() {
  const oldWay = [
    '把文本复制出去',
    '到聊天工具里粘贴',
    '等 AI 出新版',
    '复制回来',
    '调整格式',
    '自己核对来源',
    '再来一遍',
  ]
  const newWay = ['选中要改的那一段', '一键让模型重写', '顺手把当前标签作为上下文', '不打断写作节奏继续写']
  return (
    <section className="border-b-[1.5px] border-[#0a0a0a] bg-[#F6F3EC] px-5 py-[clamp(64px,8vw,104px)] sm:px-6">
      <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <FeatTag className="mb-5">痛点</FeatTag>
          <h2 className="text-[clamp(36px,5vw,64px)] leading-[1.05] tracking-[-0.025em] font-normal text-[#0a0a0a]">
            过去用 AI 改稿的流程
            <br />
            其实一直在打断你
          </h2>
          <p className="mt-5 max-w-[520px] text-[16px] leading-[1.75] text-[#5a5a5a]">
            草稿在一个标签页，AI 工具在另一个标签页。光是改几句话，就要切换十几次。
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-[12px] border-2 border-[#0a0a0a] bg-white p-6" style={{ boxShadow: '4px 4px 0 #0a0a0a' }}>
            <h3 className="text-[24px] font-black tracking-[-0.02em]">复制粘贴循环</h3>
            <ul className="mt-5 grid gap-3">
              {oldWay.map((t) => (
                <li key={t} className="flex items-center gap-3 text-[14px] font-semibold text-[#5a5a5a]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[#0a0a0a] text-[12px] text-[#F26B3A]">
                    <X className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[12px] border-2 border-[#0a0a0a] bg-[#C1F04C] p-6" style={{ boxShadow: '4px 4px 0 #0a0a0a' }}>
            <h3 className="text-[24px] font-black tracking-[-0.02em]">在这里改写，原地继续</h3>
            <ul className="mt-5 grid gap-3">
              {newWay.map((t) => (
                <li key={t} className="flex items-center gap-3 text-[14px] font-bold text-[#274006]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[#0a0a0a] bg-white text-[#5A7D11]">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

function Workflow() {
  return (
    <section id="demo" className="border-b-[1.5px] border-[#0a0a0a] bg-[#EAF8E0] px-5 py-[clamp(64px,8vw,104px)] sm:px-6">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-10 max-w-[760px]">
          <FeatTag className="mb-5">流程</FeatTag>
          <h2 className="text-[clamp(36px,5vw,64px)] leading-[1.05] tracking-[-0.025em] font-normal text-[#0a0a0a]">
            选中 → 改进 → 继续写
          </h2>
          <p className="mt-5 text-[15px] leading-[1.75] text-[#5a5a5a]">三步，写作者自己掌控节奏。</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {[
            {
              n: '01',
              t: '选中一段',
              d: '在编辑器里高亮任意一句或一段。',
              chips: [],
            },
            {
              n: '02',
              t: '选一个动作',
              d: '重写 / 改清晰 / 扩写 / 总结 / 查资料，一键触发。',
              chips: ['重写', '改清晰', '扩写', '总结', '查资料'],
            },
            {
              n: '03',
              t: '插入并继续',
              d: '改写好的文本会回到你选中的位置，光标不丢，继续写。',
              chips: [],
            },
          ].map((s) => (
            <div
              key={s.n}
              className="min-h-[270px] rounded-[12px] border-2 border-[#0a0a0a] bg-white p-7"
              style={{ boxShadow: '5px 5px 0 #0a0a0a' }}
            >
              <div
                className="mb-8 flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#0a0a0a] bg-[#C1F04C] text-[14px] font-black"
                style={{ boxShadow: '2px 2px 0 #0a0a0a' }}
              >
                {s.n}
              </div>
              <h3 className="text-[24px] font-black leading-[1.15] tracking-[-0.02em]">{s.t}</h3>
              <p className="mt-4 text-[15px] leading-[1.65] text-[#5a5a5a]">{s.d}</p>
              {s.chips.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {s.chips.map((c) => (
                    <span
                      key={c}
                      className="rounded-sm border-2 border-[#0a0a0a] bg-[#F6F3EC] px-2.5 py-1 text-[12px] font-bold"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div
          className="mt-8 overflow-hidden rounded-[12px] border-2 border-[#0a0a0a] bg-white"
          style={{ boxShadow: '5px 5px 0 #0a0a0a' }}
        >
          <div className="border-b-2 border-[#0a0a0a] bg-[#F6F3EC] px-4 py-3 text-[13px] font-bold">
            演示：Agent 在你写的地方唤起
          </div>
          {/* 视频替身：用渐变背景 + 播放按钮展示 */}
          <div
            className="block aspect-video w-full bg-[#F6F3EC] relative"
            role="img"
            aria-label="演示视频占位：此处将播放 Agent 调用演示（点击 / 选中 / 重写）"
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-50"
              style={{
                background:
                  'radial-gradient(circle at 30% 20%, rgba(193,240,76,0.5), transparent 50%), radial-gradient(circle at 80% 70%, rgba(242,107,58,0.18), transparent 55%)',
              }}
            />
            <button
              type="button"
              className="absolute inset-0 m-auto h-20 w-20 rounded-full border-2 border-[#0a0a0a] bg-white grid place-items-center"
              style={{ boxShadow: '4px 4px 0 #0a0a0a' }}
              aria-label="播放演示视频"
            >
              <Play className="h-8 w-8 translate-x-[2px] text-[#0a0a0a]" strokeWidth={2.5} fill="#0a0a0a" />
            </button>
            <div className="absolute bottom-3 left-3 text-[12px] font-bold text-[#0a0a0a]/70">
              DEMO · 24s
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ParaEdit() {
  const items = ['只改你选中的那一段', '只调语气，不重写整篇', '修掉生硬或过翻译腔的表达', '把简短的笔记扩成可发表的段落', '保留你自己的语气与观点']
  return (
    <section className="border-b-[1.5px] border-[#0a0a0a] bg-[#fffdf8] px-5 py-[clamp(72px,9vw,124px)] sm:px-6">
      <div className="mx-auto grid max-w-[1220px] gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
        <div>
          <div className="mb-5 inline-flex bg-[#EFE9F8] px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#343047]">
            段落编辑
          </div>
          <h2 className="max-w-[640px] text-[clamp(42px,5.5vw,68px)] leading-[1.08] tracking-[-0.025em] font-normal text-[#0a0a0a]">
            改一段，不是重写整篇文档
          </h2>
          <div className="mt-6 grid gap-3">
            {items.map((t) => (
              <div key={t} className="flex items-start gap-3 text-[15px] font-semibold leading-[1.6] text-[#343434]">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[#0a0a0a] bg-[#C1F04C] text-[#0a0a0a]">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                {t}
              </div>
            ))}
          </div>
        </div>
        <div
          className="rounded-[16px] border-2 border-[#0a0a0a] bg-[#C1F04C] p-4 sm:p-6"
          style={{ boxShadow: '7px 7px 0 #0a0a0a' }}
        >
          <div className="grid gap-8 overflow-hidden rounded-[10px] bg-white p-5 sm:p-7 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#777]">已选中的段落</div>
                <span className="bg-[#D7E7FF] px-2 py-1 text-[10px] font-black uppercase tracking-[0.06em] text-[#1a73e8]">
                  高亮
                </span>
              </div>
              <p className="rounded-sm bg-[#D7E7FF] px-3 py-2 text-[16px] leading-[1.75] text-[#0a0a0a]">
                现在的学生写作业很容易被假信息带跑，因为网上的观点被浏览量压过了事实，需要先核对再写。
              </p>
              <div className="mt-6 bg-[#F6F3EC] p-4 text-[14px] leading-[1.6]">
                把这一段改写得更清楚一点，保留我想表达的意思，语气自然一点。
              </div>
            </div>
            <div>
              <div className="mb-4 text-[12px] font-bold uppercase tracking-[0.08em] text-[#5A7D11]">改写后</div>
              <p className="text-[16px] font-medium leading-[1.75] text-[#0a0a0a]">
                社交媒体让可信信息和不可信信息混在一起。学生需要先比对不同来源，再把观点写进作业里。
              </p>
              <button
                type="button"
                className="mt-6 w-full rounded-sm border-2 border-[#0a0a0a] bg-[#0a0a0a] px-4 py-3 text-[13px] font-bold text-white"
              >
                插入到原文
              </button>
            </div>
          </div>
          <p className="mt-4 text-center text-[12px] font-bold text-[#274006]">
            选哪段、改不改、采不采纳——你说了算。
          </p>
        </div>
      </div>
    </section>
  )
}

function ResponsibleAI() {
  return (
    <section className="border-b-[1.5px] border-[#0a0a0a] bg-[#F6F3EC] px-5 py-[clamp(84px,10vw,140px)] sm:px-6">
      <div className="mx-auto max-w-[1080px]">
        <div className="grid gap-8 lg:grid-cols-[0.82fr_1fr] lg:items-start">
          <div>
            <FeatTag className="mb-5">负责任的 AI 写作</FeatTag>
            <h2 className="text-[clamp(38px,5.2vw,66px)] leading-[1.08] tracking-[-0.025em] font-normal text-[#0a0a0a]">
              担心一眼被看出用了 AI？
            </h2>
          </div>
          <div className="rounded-[10px] border-2 border-[#0a0a0a] bg-white p-6 sm:p-7" style={{ boxShadow: '4px 4px 0 #0a0a0a' }}>
            <div className="mb-4 inline-flex bg-[#F6F3EC] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#5a5a5a]">
              这件事为什么重要
            </div>
            <div className="max-w-[680px] space-y-5 text-[17px] leading-[1.78] text-[#4b4b4b]">
              <p>
                作业写作者真正担心的，往往不只是 AI 改出来的那几句话，而是文档里那一长串“怎么突然变成这样”的痕迹——
                想法改了、说法改了、语气改了，看上去像另一个人写的。
              </p>
              <p>
                所以我们把流程拆成很小的步骤：先写自己的稿子，再用 Agent 一次只动一段，最后由你自己决定接不接受每一处修改。这样写出来的稿子，
                <em>看起来还像你写的</em>。
              </p>
            </div>
          </div>
        </div>
        <figure className="mt-10 max-w-[820px] rounded-[18px] bg-[#F8FFE8] p-6 sm:p-8">
          <blockquote className="text-[clamp(22px,3vw,34px)] font-black leading-[1.22] tracking-[-0.02em] text-[#24350b]">
            “一段一段改、留下改动痕迹的工作流，让人写起来更放心，也更像在写自己的稿子。”
          </blockquote>
          <figcaption className="mt-4 text-[14px] font-bold text-[#5A7D11]">—— 节选自用户使用反馈</figcaption>
        </figure>
        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          {[
            {
              head: '旧流程',
              headColor: '#F26B3A',
              tone: 'disconnected',
              items: ['一次让 AI 出整篇', '复制粘贴到文档', '修改痕迹不清晰', '改完像换了个人写的'],
            },
            {
              head: '更稳的流程',
              headColor: '#5A7D11',
              tone: 'connected',
              items: ['先用自己的话开始写', '一次只让 Agent 动一段', '参考材料随时开着', '每一步改动都自己拍板'],
            },
          ].map((col) => (
            <div key={col.head}>
              <div className="mb-4 text-[12px] font-bold uppercase tracking-[0.1em]" style={{ color: col.headColor }}>
                {col.head}
              </div>
              <div className="space-y-3">
                {col.items.map((t, i) => (
                  <div key={t} className="flex items-center gap-4">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-black"
                      style={{
                        backgroundColor: col.tone === 'connected' ? C.green : 'white',
                        color: col.tone === 'connected' ? C.ink : C.orange,
                        border: `2px solid ${col.tone === 'connected' ? C.ink : C.orange}`,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span
                      className="text-[17px] font-black leading-[1.35]"
                      style={{ color: col.tone === 'connected' ? C.greenWash3 : '#343434' }}
                    >
                      {t}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-12 max-w-[760px] text-[20px] font-black leading-[1.5] tracking-[-0.01em] text-[#0a0a0a]">
          Resume Agent 鼓励这种节奏：先自己写，再用 AI 改一段、改一段，直到把一篇稿子打磨出来。整个修改过程都留在文档的本地版本里，
          <a className="underline decoration-[#C1F04C] decoration-[3px] underline-offset-4 hover:text-[#5A7D11]" href="#">
            关于如何使用
          </a>
          ，你可以看
          <a className="underline decoration-[#C1F04C] decoration-[3px] underline-offset-4 hover:text-[#5A7D11]" href="#">
            完整指南
          </a>
          。
        </p>
      </div>
    </section>
  )
}

function Research() {
  const sources = ['@维基百科', '@研究论文', '@相关报道', '@笔记', '@报告']
  return (
    <section className="border-b-[1.5px] border-[#0a0a0a] bg-[#C8BFF5] px-5 py-[clamp(64px,8vw,104px)] sm:px-6">
      <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <FeatTag className="mb-5">研究上下文</FeatTag>
          <h2 className="text-[clamp(40px,6vw,72px)] leading-[1.05] tracking-[-0.025em] font-normal text-[#0a0a0a]">
            顺手把查资料的页面
            <br />
            当成改稿时的背景
          </h2>
          <p className="mt-5 text-[16px] leading-[1.75] text-[#3f3a52]">
            需要的话，可以把已经打开的几个标签页作为附加上下文，让 Agent 在改写时看到对应的资料。
          </p>
          <div className="mt-6 grid gap-3 text-[15px] font-semibold text-[#2f2944] sm:grid-cols-2">
            {[
              '表达更贴近资料',
              '上下文更稳',
              '少一处算错的地方',
              '让引用更直白',
            ].map((t) => (
              <div key={t} className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#0a0a0a] bg-white text-[#5A7D11]">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                {t}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[14px] border-2 border-[#0a0a0a] bg-white p-5" style={{ boxShadow: '5px 5px 0 #0a0a0a' }}>
          <div className="rounded-[10px] border-2 border-[#0a0a0a] bg-[#F6F3EC] p-4 text-[15px] leading-[1.6]">
            把上面这一段用 @研究论文 和 @课程笔记 的观点重新表达，保留我的立场，引用那些资料时小心一点。
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sources.map((s, i) => (
              <div
                key={s}
                className="rounded-[8px] border-2 border-[#0a0a0a] bg-[#fffdf8] p-4"
                style={{ boxShadow: '2px 2px 0 #0a0a0a' }}
              >
                <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[#777]">
                  资料 0{i + 1}
                </div>
                <div className="text-[16px] font-bold">{s}</div>
                <div className="mt-3 space-y-1.5" aria-hidden>
                  <div className="h-2 w-full bg-[#0a0a0a]/10" />
                  <div className="h-2 w-[82%] bg-[#0a0a0a]/10" />
                  <div className="h-2 w-[58%] bg-[#0a0a0a]/10" />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12px] font-semibold leading-[1.6] text-[#777]">
            是否使用资料，由你决定；最终每一段都需要你审过再写进文档。
          </p>
        </div>
      </div>
    </section>
  )
}

function Comparison() {
  const rows = [
    { need: '可以编辑选中的段落', a: '手动复制粘贴', b: '不支持', c: '支持' },
    { need: '不离开正在写的文本框', a: '否', b: '是', c: '是' },
    { need: '同时调用 GPT / Claude / Gemini', a: '只能选一个', b: '不支持', c: '可以' },
    { need: '使用当前打开的页面作为上下文', a: '手动粘贴', b: '不支持', c: '按需启用' },
    { need: '不打断思路地继续写', a: '需要切走', b: '受限', c: '很顺' },
  ]
  return (
    <section className="border-b-[1.5px] border-[#0a0a0a] bg-[#F6F3EC] px-5 py-[clamp(64px,8vw,104px)] sm:px-6">
      <div className="mx-auto max-w-[1080px]">
        <div className="mb-10 max-w-[760px]">
          <FeatTag className="mb-5">对比</FeatTag>
          <h2 className="text-[clamp(36px,5vw,64px)] leading-[1.05] tracking-[-0.025em] font-normal text-[#0a0a0a]">
            为什么很多写作者选 Resume Agent
          </h2>
          <p className="mt-5 text-[15px] leading-[1.75] text-[#5a5a5a]">一张表对比 3 类工具在文本框里的体验。</p>
        </div>
        <div className="overflow-x-auto rounded-[12px] border-2 border-[#0a0a0a] bg-white" style={{ boxShadow: '4px 4px 0 #0a0a0a' }}>
          <table className="w-full min-w-[680px] border-collapse text-left text-[14px]">
            <thead className="bg-[#fffdf8]">
              <tr>
                <th className="border-b-2 border-[#0a0a0a] p-4 font-black">能力</th>
                <th className="border-b-2 border-[#0a0a0a] p-4 font-black">聊天类 AI</th>
                <th className="border-b-2 border-[#0a0a0a] p-4 font-black">编辑器自带联想</th>
                <th className="border-b-2 border-[#0a0a0a] bg-[#C1F04C] p-4 font-black">Resume Agent</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.need} className={idx > 0 ? 'border-t border-[#0a0a0a]/15' : ''}>
                  <td className="p-4 font-semibold">{r.need}</td>
                  <td className="p-4 text-[#5a5a5a]">{r.a}</td>
                  <td className="p-4 text-[#5a5a5a]">{r.b}</td>
                  <td className="bg-[#F8FFE8] p-4 font-bold text-[#0a0a0a]">{r.c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function Trust() {
  const cards = [
    { t: '调用主流模型', d: 'GPT / Claude / Gemini 共用同一个调用层，按需切换。' },
    { t: '只看你允许的内容', d: 'Resume Agent 只在你主动打开的资料里工作，不在后台扫描任何文档。' },
    { t: '为专注写作而做', d: '一次改一段，审过后继续写。不需要整套自动生成。' },
    { t: '随你写在哪', d: '几乎所有现代浏览器里的文本框都能用。' },
  ]
  return (
    <section className="border-b-[1.5px] border-[#0a0a0a] bg-[#fffdf8] px-5 py-[clamp(64px,8vw,104px)] sm:px-6">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-10 max-w-[760px]">
          <FeatTag className="mb-5">值得信任</FeatTag>
          <h2 className="text-[clamp(36px,5vw,64px)] leading-[1.05] tracking-[-0.025em] font-normal text-[#0a0a0a]">
            一种更安静的 AI 写作方式
          </h2>
          <p className="mt-5 text-[15px] leading-[1.75] text-[#5a5a5a]">
            Resume Agent 把 AI 放回写作者掌控的位置——让你写得更清楚，保留你的声音，少一点被工具推着走的感觉。
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div
              key={c.t}
              className="rounded-[12px] border-2 border-[#0a0a0a] bg-white p-6"
              style={{ boxShadow: '3px 3px 0 #0a0a0a' }}
            >
              <div className="mb-4 text-[#F26B3A]">
                <Check className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <h3 className="text-[19px] font-black leading-[1.2] tracking-[-0.01em]">{c.t}</h3>
              <p className="mt-3 text-[14px] leading-[1.65] text-[#5a5a5a]">{c.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FAQ() {
  const qs = [
    {
      q: 'Resume Agent 能帮我在文本框里做什么？',
      a: '可以改写选中的段落、改进拗口的措辞、做总结、扩写，以及在做这些事的时候顺手调用已经打开的资料。',
    },
    {
      q: '我的数据 / 隐私会被怎么处理？',
      a: 'Resume Agent 只接触你主动交给它的内容；不会在后台持续读取你的文档、邮箱或本地文件。',
    },
    {
      q: 'Resume Agent 接入了哪些模型？',
      a: '接入了主流的闭源与开源模型，包括 GPT、Claude、Gemini 等，可以根据任务特性选用。',
    },
    {
      q: '能在课堂作业 / 公司文档里用吗？',
      a: '可以。但请遵守学校、公司或所在平台的 AI 使用规范。',
    },
    {
      q: 'Resume Agent 怎么用我打开的网页作为上下文？',
      a: '在支持的场景里，你可以指定若干已打开的标签页作为附加上下文；Agent 会参考其中的要点，再交回给你定稿。',
    },
    {
      q: '我会失去改动痕迹吗？',
      a: '不会。每一次调用都是一次明确的改动请求，结果会先展示给你看，由你决定是否插入原文——改动始终由你经手。',
    },
  ]
  return (
    <section id="faq" className="border-b-[1.5px] border-[#0a0a0a] bg-[#DAF5F0] px-5 py-[clamp(64px,8vw,104px)] sm:px-6">
      <div className="mx-auto max-w-[920px]">
        <div className="mb-10 max-w-[760px]">
          <FeatTag className="mb-5">常见问题</FeatTag>
          <h2 className="text-[clamp(36px,5vw,64px)] leading-[1.05] tracking-[-0.025em] font-normal text-[#0a0a0a]">
            写作者最常问的几件事
          </h2>
          <p className="mt-5 text-[15px] leading-[1.75] text-[#5a5a5a]">关于 Resume Agent 在文本框中起作用的简短回答。</p>
        </div>
        <div className="space-y-4">
          {qs.map((it) => (
            <details
              key={it.q}
              className="rounded-[10px] border-2 border-[#0a0a0a] bg-white p-5"
              style={{ boxShadow: '3px 3px 0 #0a0a0a' }}
            >
              <summary className="cursor-pointer text-[17px] font-bold list-none flex items-center justify-between gap-3">
                <span>{it.q}</span>
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-[14px] leading-[1.7] text-[#5a5a5a]">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function ReadyCTA() {
  return (
    <section id="ready" className="border-b-[1.5px] border-[#0a0a0a] bg-[#F6F3EC] px-5 py-[clamp(64px,8vw,104px)] sm:px-6">
      <div className="mx-auto grid max-w-[1180px] gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <FeatTag className="mb-5">开始使用</FeatTag>
          <h2 className="text-[clamp(40px,6vw,72px)] leading-[1.05] tracking-[-0.025em] font-normal text-[#0a0a0a]">
            写得更好，<br />就发生在你正在写的地方。
          </h2>
          <p className="mt-4 max-w-[620px] text-[15px] leading-[1.75] text-[#5a5a5a]">
            加入每天在文本框里调用 Resume Agent 改进稿子的写作者、研究者和团队。
          </p>
        </div>
        <a
          href="#ready"
          className="inline-flex items-center justify-center gap-2 bg-[#C1F04C] text-[#0a0a0a] border-2 border-[#0a0a0a] px-6 py-4 text-[15px] font-bold rounded-md no-underline transition-all duration-200"
          style={{ boxShadow: '4px 4px 0 #0a0a0a' }}
        >
          立即试用
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </a>
      </div>
    </section>
  )
}

function RelatedGuides() {
  const guides = [
    { t: '逐段改写', d: '在原文里一段一段地打磨，不打断写作节奏。' },
    { t: '写作研究助手', d: '把当前打开的资料作为上下文来改稿。' },
    { t: '整篇快速总结', d: '先看到一篇长文的关键要点，再决定改哪里。' },
  ]
  return (
    <section className="border-b-[1.5px] border-[#0a0a0a] bg-[#F6F3EC] px-5 py-[clamp(56px,7vw,88px)] sm:px-6">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-8 max-w-[720px]">
          <FeatTag className="mb-5">相关功能</FeatTag>
          <h2 className="text-[clamp(34px,4.6vw,58px)] leading-[1.05] tracking-[-0.025em] font-normal text-[#0a0a0a]">
            还有这些场景也用得到
          </h2>
          <p className="mt-4 text-[15px] leading-[1.75] text-[#5a5a5a]">
            写作、研究、安全地用 AI——看看其他功能页。
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {guides.map((g) => (
            <a
              key={g.t}
              href="#"
              className="group rounded-[12px] border-2 border-[#0a0a0a] bg-white p-6 transition hover:-translate-y-0.5"
              style={{ boxShadow: '3px 3px 0 #0a0a0a' }}
            >
              <h3 className="text-[20px] font-black leading-[1.2] tracking-[-0.01em]">{g.t}</h3>
              <p className="mt-3 text-[14px] leading-[1.65] text-[#5a5a5a]">{g.d}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-[13px] font-bold text-[#0a0a0a]">
                查看页面
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={2} />
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

function Footer() {
  const cols = [
    { h: '产品', items: ['定价', '安全说明', '下载', '登录'] },
    { h: '功能', items: ['段落改写', 'AI 总结', '写作研究助手', '邮件润色', '提示词生成', 'AI 文本润色'] },
    { h: '对比', items: ['替代 Grammarly', '替代 Notion AI', '替代 Compose AI'] },
    { h: '资料', items: ['常见问题', '博客'] },
    { h: '联系', items: ['邮箱', 'Discord', 'X / Twitter', 'YouTube', 'TikTok', 'Instagram'] },
  ]
  return (
    <footer id="footer" className="py-10 bg-[#F6F3EC]">
      <div className="max-w-[1200px] mx-auto px-5 sm:px-10">
        <div className="grid grid-cols-1 min-[600px]:grid-cols-2 min-[1000px]:grid-cols-[1.35fr_0.7fr_0.95fr_0.85fr_0.75fr_0.95fr] gap-6 min-[900px]:gap-10 items-start">
          <div>
            <a className="flex items-center gap-2 text-[14px] font-bold no-underline text-[#0a0a0a]" href="#">
              <span
                aria-hidden
                className="grid place-items-center w-5 h-5 rounded-[4px] bg-[#0a0a0a] text-[#C1F04C] font-black text-[11px]"
              >
                R
              </span>
              Resume Agent
            </a>
            <p className="text-[12px] text-[#5a5a5a] leading-[1.6] max-w-[240px] mt-2.5">
              一个真正嵌入文本框的写作 Agent。 在你正在写的地方，原地改稿。
            </p>
            <p className="text-[11px] text-[#999] mt-3.5">
              © 2026 Resume Agent
              <br />
              <a href="#" className="text-[#999] hover:text-[#0a0a0a] no-underline transition-colors">
                隐私政策
              </a>{' '}
              ·{' '}
              <a href="#" className="text-[#999] hover:text-[#0a0a0a] no-underline transition-colors">
                服务条款
              </a>
            </p>
          </div>
          {cols.map((col) => (
            <div key={col.h}>
              <h4 className="text-[11px] font-semibold text-[#999] uppercase tracking-[0.06em] mb-3">{col.h}</h4>
              {col.items.map((it) => (
                <a
                  key={it}
                  href="#"
                  className="block text-[13px] text-[#5a5a5a] mb-2 hover:text-[#0a0a0a] no-underline transition-colors"
                >
                  {it}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </footer>
  )
}

export default function ClicoClonePage() {
  return (
    <main className="font-sans antialiased bg-[#F6F3EC] text-[#0a0a0a]">
      <div className="site-frame">
        <StickyNav />
        <Hero />
        <Pain />
        <Workflow />
        <ParaEdit />
        <ResponsibleAI />
        <Research />
        <Comparison />
        <Trust />
        <FAQ />
        <ReadyCTA />
        <RelatedGuides />
        <Footer />
      </div>
    </main>
  )
}

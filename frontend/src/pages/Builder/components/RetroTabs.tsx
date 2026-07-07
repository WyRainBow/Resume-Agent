/**
 * Swiss International Style Tabs —— 移植自 Resume-Matcher components/ui/retro-tabs.tsx。
 * 差异:RM token 换算(bg-secondary→#E5E5E0、paper-tint→#F1F2F5、steel-grey/ink-soft→灰阶 hex)。
 */
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface Tab {
  id: string
  label: string
  disabled?: boolean
}

export interface RetroTabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  className?: string
}

export const RetroTabs: React.FC<RetroTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className,
}) => {
  return (
    <div className={cn('flex gap-0 border-b border-black', className)}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        const isDisabled = tab.disabled

        return (
          <button
            key={tab.id}
            onClick={() => !isDisabled && onTabChange(tab.id)}
            disabled={isDisabled}
            className={cn(
              'px-4 py-2 font-mono text-xs uppercase tracking-wider transition-all',
              'border border-b-0 border-black -mb-px',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2',
              isActive && [
                'bg-white text-black font-bold',
                'shadow-[2px_-2px_0px_0px_rgba(0,0,0,0.1)]',
                'border-b-white',
              ],
              !isActive &&
                !isDisabled && ['bg-[#E5E5E0] text-[#444850] hover:bg-[#D8D8D2] hover:text-black'],
              isDisabled && ['bg-[#F1F2F5] text-[#878E99] cursor-not-allowed opacity-50']
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

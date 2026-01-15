import React from 'react'
import { cn } from '@/lib/utils'

export type ResumeStep = 
  | 'education'
  | 'target-position'
  | 'internship'
  | 'organization'
  | 'project'
  | 'skills'
  | 'certificates'
  | 'basic-info'
  | 'template'

export interface ProgressNavProps {
  currentStep: ResumeStep
  steps: Array<{ key: ResumeStep; label: string }>
}

export const ProgressNav: React.FC<ProgressNavProps> = ({ currentStep, steps }) => {
  return (
    <div className="sticky top-16 z-40 bg-gray-50 border-b border-gray-200">
      <div 
        className="flex items-center gap-0 overflow-x-auto px-4 py-3 progress-nav-scroll" 
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {steps.map((step, index) => {
          const isActive = step.key === currentStep
          const isCompleted = steps.findIndex(s => s.key === currentStep) > index
          
          return (
            <React.Fragment key={step.key}>
              <div
                className={cn(
                  "px-3 py-1.5 text-sm whitespace-nowrap transition-all duration-200 cursor-default",
                  isActive
                    ? "bg-gray-200 text-gray-900 font-medium"
                    : "text-gray-400"
                )}
              >
                {step.label}
              </div>
              {index < steps.length - 1 && (
                <span className="text-gray-300 text-sm mx-1">›</span>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}


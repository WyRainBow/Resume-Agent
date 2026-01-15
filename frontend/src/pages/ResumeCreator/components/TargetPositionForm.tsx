import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { ClipboardList, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TargetPositionFormProps {
  onSkip: () => void
  onSubmit: (position: string) => void
}

export const TargetPositionForm: React.FC<TargetPositionFormProps> = ({ onSkip, onSubmit }) => {
  const [position, setPosition] = useState('')

  const recommendations = ['前端开发工程师', '后端开发工程师', '产品经理', 'UI设计师']

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 w-full max-w-xl"
    >
      {/* 头部引导 */}
      <div className="flex items-start gap-5 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
          <ClipboardList className="w-7 h-7 text-blue-600" />
        </div>
        <div>
          <h3 className="text-[19px] font-bold text-gray-900 mb-2">选择你的目标职位</h3>
          <p className="text-gray-500 text-[15px] leading-relaxed">为了简历的针对性，请选择你最想投递的职位</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* 输入框 */}
        <div className="relative">
          <input
            type="text"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="请选择或者输入你的目标职位..."
            className="w-full px-6 py-5 rounded-2xl border-2 border-blue-100 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all text-gray-700 text-lg"
          />
        </div>

        {/* 推荐职位 */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-500">根据过往经历推荐职位:</p>
          <div className="flex flex-wrap gap-2">
            {recommendations.map((rec) => (
              <button
                key={rec}
                onClick={() => setPosition(rec)}
                className={cn(
                  "px-4 py-2 rounded-xl border text-sm transition-all",
                  position === rec
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "bg-white border-gray-100 text-gray-600 hover:border-blue-200 hover:bg-gray-50"
                )}
              >
                {rec}
              </button>
            ))}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center gap-4 pt-4">
          <button
            onClick={onSkip}
            className="flex-1 py-4 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-2xl font-bold text-[16px] transition-all"
          >
            暂时跳过
          </button>
          <button
            onClick={() => position.trim() && onSubmit(position)}
            disabled={!position.trim()}
            className={cn(
              "flex-[2] py-4 rounded-2xl font-bold text-[16px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20",
              position.trim()
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
            )}
          >
            <Send className="w-4 h-4 transform rotate-45" />
            提交
          </button>
        </div>
      </div>
    </motion.div>
  )
}


import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, Send, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Skill {
  name: string
  level: string
}

interface SkillsFormProps {
  onSkip: () => void
  onSubmit: (skills: string[]) => void
}

export const SkillsForm: React.FC<SkillsFormProps> = ({ onSkip, onSubmit }) => {
  const [inputValue, setInputValue] = useState('')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [isSubmitted, setIsSubmitted] = useState(false)

  const recommendations = [
    "Java后端: Spring框架 分布式系统 高并发处理",
    "MySQL数据库: SQL优化 索引设计 事务处理",
    "项目管理: 需求分析 任务分解 进度跟踪",
    "系统设计: 架构设计 性能优化 可扩展性",
    "沟通表达: 技术文档 需求沟通 团队协作"
  ]

  const toggleSkill = (skill: string) => {
    if (isSubmitted) return
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter(s => s !== skill))
    } else {
      setSelectedSkills([...selectedSkills, skill])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isSubmitted) return
    if (e.key === 'Enter' && inputValue.trim()) {
      if (!selectedSkills.includes(inputValue.trim())) {
        setSelectedSkills([...selectedSkills, inputValue.trim()])
      }
      setInputValue('')
    }
  }

  const handleSubmit = () => {
    if (selectedSkills.length > 0 && !isSubmitted) {
      setIsSubmitted(true)
      onSubmit(selectedSkills)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-white rounded-2xl p-8 shadow-sm border border-gray-100 w-full max-w-xl transition-opacity",
        isSubmitted && "opacity-70 pointer-events-none"
      )}
    >
      {/* 头部引导 */}
      <div className="flex items-start gap-5 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
          <Settings className="w-7 h-7 text-blue-600" />
        </div>
        <div>
          <h3 className="text-[19px] font-bold text-gray-900 mb-2">展示你的技能特长</h3>
          <p className="text-gray-500 text-[15px] leading-relaxed">UP 简历为你精心推荐的技能，让我们一起展示你的专业实力</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* 已选技能 & 输入框 */}
        <div className={cn(
          "flex flex-wrap gap-2 p-4 rounded-2xl border-2 bg-white min-h-[80px] transition-all",
          isSubmitted ? "border-gray-100" : "border-blue-100 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50"
        )}>
          <AnimatePresence>
            {selectedSkills.map((skill) => (
              <motion.div
                key={skill}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-sm font-medium"
              >
                {skill}
                {!isSubmitted && (
                  <button onClick={() => toggleSkill(skill)} className="hover:bg-blue-700 rounded-full p-0.5 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          <input
            type="text"
            disabled={isSubmitted}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isSubmitted ? "" : (selectedSkills.length === 0 ? "请输入你的技能..." : "继续输入...")}
            className="flex-1 min-w-[120px] outline-none text-gray-700 py-1.5 bg-transparent"
          />
        </div>

        {/* 推荐技能 */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-500 font-bold">推荐技能:</p>
          <div className="flex flex-col gap-2">
            {recommendations.map((skill) => {
              const isSelected = selectedSkills.includes(skill)
              return (
                <button
                  key={skill}
                  disabled={isSubmitted}
                  onClick={() => toggleSkill(skill)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl border transition-all text-sm font-medium flex items-center justify-between group",
                    isSelected
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-gray-50/50 border-gray-100 text-gray-700 hover:border-blue-200 hover:bg-white",
                    isSubmitted && isSelected && "bg-blue-400 border-blue-400"
                  )}
                >
                  <span>{skill}</span>
                  {!isSelected && !isSubmitted && <Plus className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center gap-4 pt-4">
          <button
            onClick={onSkip}
            disabled={isSubmitted}
            className={cn(
              "flex-1 py-4 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-2xl font-bold text-[16px] transition-all",
              isSubmitted && "opacity-50 cursor-not-allowed"
            )}
          >
            暂时跳过
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedSkills.length === 0 || isSubmitted}
            className={cn(
              "flex-[2] py-4 rounded-2xl font-bold text-[16px] flex items-center justify-center gap-2 transition-all shadow-lg",
              selectedSkills.length > 0 && !isSubmitted
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20"
                : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
            )}
          >
            <Send className="w-4 h-4 transform rotate-45" />
            {isSubmitted ? '已提交' : '提交'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}


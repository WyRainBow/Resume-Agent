import React from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardTitle, CardDescription } from './ui/card'
import { Plus } from './Icons'
import { cn } from '@/lib/utils'

interface CreateCardProps {
  onClick: () => void
}

export const CreateCard: React.FC<CreateCardProps> = ({ onClick }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -8, transition: { duration: 0.2 } }}
      onClick={onClick}
      className="relative group"
    >
      {/* 悬停时的环境光效果 */}
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <Card
        className={cn(
          "relative overflow-hidden cursor-pointer h-[310px] flex flex-col rounded-2xl border-2 border-dashed transition-all duration-300",
          "bg-white/40 dark:bg-slate-900/20 backdrop-blur-md",
          "border-slate-200 dark:border-slate-800",
          "hover:border-blue-400 dark:hover:border-blue-500/50 hover:bg-white/60 dark:hover:bg-slate-900/40",
          "shadow-[0_8px_30px_rgb(0,0,0,0.02)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)]"
        )}
      >
        <CardContent className="flex-1 pt-6 text-center flex flex-col items-center justify-center h-full z-10">
          <motion.div
            className="mb-6 p-6 rounded-full bg-white dark:bg-slate-800 shadow-xl shadow-blue-500/10 dark:shadow-none border border-slate-100 dark:border-slate-700"
            whileHover={{ scale: 1.15, rotate: 90 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          >
            <Plus className="h-10 w-10 text-blue-600 dark:text-blue-400" />
          </motion.div>
          
          <CardTitle className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100">
            新建简历
          </CardTitle>
          
          <CardDescription className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400 max-w-[160px]">
            开启你的职业新篇章：从这里开始。
          </CardDescription>
        </CardContent>

        {/* 装饰线 */}
        <div className="absolute bottom-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 transform translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
      </Card>
    </motion.div>
  )
}


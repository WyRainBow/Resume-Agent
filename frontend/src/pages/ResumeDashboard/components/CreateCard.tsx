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
      whileHover={{ y: 2, x: 2, transition: { duration: 0.1 } }}
      onClick={onClick}
      className="relative group"
    >
      <Card
        className={cn(
          "relative overflow-hidden cursor-pointer h-[380px] flex flex-col rounded-none border-2 border-dashed border-black transition-[box-shadow,transform] duration-100",
          "bg-[#F0F0E8]",
          "hover:bg-[#E5E5E0] group-hover:shadow-none",
          "fresh:border-slate-300 fresh:hover:bg-slate-50 fresh:group-hover:shadow-md"
        )}
      >
        <CardContent className="flex-1 pt-6 text-center flex flex-col items-center justify-center h-full z-10">
          <motion.div
            className="mb-6 p-6 rounded-none bg-[#4285F4] text-white shadow-[2px_2px_0px_0px_#000000] border-2 border-black fresh:rounded-lg fresh:border-blue-500 fresh:shadow-sm"
            whileHover={{ x: 1, y: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          >
            <Plus className="h-10 w-10 text-white" />
          </motion.div>

          <CardTitle className="text-2xl font-sans font-black tracking-tight text-slate-700">
            新建简历
          </CardTitle>

          <CardDescription className="mt-3 text-sm font-mono text-[#6B7280] max-w-[160px]">
            开启你的职业新篇章：从这里开始。
          </CardDescription>
        </CardContent>

        {/* 装饰线 */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-black transform translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
      </Card>
    </motion.div>
  )
}


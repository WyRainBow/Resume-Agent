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
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      onClick={onClick}
    >
      <Card
        className={cn(
          "relative border border-dashed cursor-pointer h-[260px] transition-all duration-200",
          "hover:border-gray-400 hover:bg-gray-50",
          "dark:hover:border-primary dark:hover:bg-primary/10"
        )}
      >
        <CardContent className="flex-1 pt-6 text-center flex flex-col items-center justify-center h-full">
          <motion.div
            className="mb-4 p-4 rounded-full bg-gray-100 dark:bg-primary/10"
            whileHover={{ rotate: 90 }}
            transition={{ duration: 0.2 }}
          >
            <Plus className="h-8 w-8 text-gray-600 dark:text-primary" />
          </motion.div>
          <CardTitle className="text-xl text-gray-900 dark:text-gray-100">
            新简历
          </CardTitle>
          <CardDescription className="mt-2 text-gray-600 dark:text-gray-400">
            首先，创建一个新的简历。
          </CardDescription>
        </CardContent>
      </Card>
    </motion.div>
  )
}

import React from 'react'
import { motion } from 'framer-motion'
import { Button } from './ui/button'
import { Plus, Upload } from './Icons'

interface HeaderProps {
  onImport: () => void
  onCreate: () => void
}

export const Header: React.FC<HeaderProps> = ({ onImport, onCreate }) => {
  return (
    <motion.div
      className="px-4 sm:px-6 flex items-center justify-between"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
        我的简历
      </h1>
      <div className="flex items-center space-x-2">
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <Button
            onClick={onImport}
            variant="outline"
            className="hover:bg-gray-100 dark:border-primary/50 dark:hover:bg-primary/10"
          >
            <Upload className="mr-2 h-4 w-4" />
            导入 JSON
          </Button>
        </motion.div>
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <Button
            onClick={onCreate}
            variant="default"
            className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            创建简历
          </Button>
        </motion.div>
      </div>
    </motion.div>
  )
}

import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "./ui/button";
import UserMenu from "@/components/UserMenu";
import { Plus, Upload, Trash2, FileText } from "./Icons";

interface HeaderProps {
  onImport: () => void;
  onCreate: () => void;
  /** AI 智能导入回调 */
  onAIImport?: () => void;
  /** 选中的简历数量（用于批量删除） */
  selectedCount?: number;
  /** 批量删除回调 */
  onBatchDelete?: () => void;
  /** 简历总数 */
  totalCount?: number;
  /** 是否处于多选模式 */
  isMultiSelectMode?: boolean;
  /** 切换多选模式 */
  onToggleMultiSelectMode?: () => void;
  /** 退出多选模式 */
  onExitMultiSelectMode?: () => void;
  /** 全选当前列表 */
  onSelectAll?: () => void;
  /** 取消全选 */
  onClearSelection?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onImport,
  onCreate,
  onAIImport,
  selectedCount = 0,
  onBatchDelete,
  totalCount = 0,
  isMultiSelectMode = false,
  onToggleMultiSelectMode,
  onExitMultiSelectMode,
  onSelectAll,
  onClearSelection,
}) => {
  const navigate = useNavigate();
  const allSelected = totalCount > 0 && selectedCount === totalCount;

  return (
    <motion.div
      className="px-2 sm:px-4 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="flex items-center space-x-6">
        <div
          className="flex items-center gap-4 cursor-pointer group"
          onClick={() => navigate("/")}
        >
          <div className="w-14 h-14 bg-slate-900 dark:bg-white rounded-2xl flex items-center justify-center shadow-xl shadow-slate-200 dark:shadow-none group-hover:scale-105 group-hover:rotate-3 transition-all duration-300">
            <span className="text-white dark:text-slate-900 font-black text-2xl italic">
              RA
            </span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-none">
              Resume.AI
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-bold tracking-[0.2em] uppercase">
                Dashboard
              </span>
              <div className="h-1 w-1 rounded-full bg-slate-300" />
              <span className="text-xs text-slate-400 font-medium">
                共 {totalCount} 份简历
              </span>
            </div>
          </div>
        </div>

        {selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white shadow-lg shadow-slate-200"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-bold">已选 {selectedCount}</span>
          </motion.div>
        )}
      </div>

      <div className="flex items-center flex-wrap gap-3">
        {/* 多选模式按钮 */}
        {totalCount > 0 && onToggleMultiSelectMode && (
          <Button
            onClick={onToggleMultiSelectMode}
            variant={isMultiSelectMode ? "default" : "outline"}
            className={`rounded-xl h-11 px-5 font-bold transition-all duration-300 border ${
              isMultiSelectMode
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-slate-200"
            }`}
          >
            {isMultiSelectMode ? "退出多选" : "多选"}
          </Button>
        )}

        {/* 多选模式下：全选 / 取消全选 */}
        {isMultiSelectMode &&
          totalCount > 0 &&
          onSelectAll &&
          onClearSelection && (
            <Button
              onClick={allSelected ? onClearSelection : onSelectAll}
              variant="outline"
              className="rounded-xl h-11 px-5 font-bold border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
            >
              {allSelected ? "取消全选" : "全选"}
            </Button>
          )}

        {/* 批量删除 */}
        {selectedCount > 0 && onBatchDelete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Button
              onClick={onBatchDelete}
              className="rounded-xl h-11 px-5 font-bold bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-100 transition-all duration-300"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除
            </Button>
          </motion.div>
        )}

        <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

        {/* AI 智能导入按钮 */}
        {onAIImport && (
          <Button
            onClick={onAIImport}
            variant="outline"
            className="rounded-xl h-11 px-5 font-bold border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all duration-300"
          >
            <Upload className="mr-2 h-4 w-4 text-slate-900" />
            AI 智能导入
          </Button>
        )}

        {/* 创建按钮 */}
        <Button
          onClick={onCreate}
          className="rounded-xl h-11 px-6 font-black bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-200 transition-all duration-300 transform hover:scale-105 active:scale-95"
        >
          <Plus className="mr-2 h-5 w-5 stroke-[3px]" />
          新建简历
        </Button>

        <div className="ml-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <UserMenu />
        </div>
      </div>
    </motion.div>
  );
};

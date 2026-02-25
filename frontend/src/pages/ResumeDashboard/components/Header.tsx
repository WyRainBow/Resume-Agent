import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "./ui/button";
import UserMenu from "@/components/UserMenu";
import { Plus, Upload, Trash2, FileText, Sparkles } from "./Icons";
import { cn } from "@/lib/utils";

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

  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const importMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        importMenuRef.current &&
        !importMenuRef.current.contains(event.target as Node)
      ) {
        setImportMenuOpen(false);
      }
    };
    if (importMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [importMenuOpen]);

  return (
    <motion.div
      className="px-2 sm:px-4 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="flex items-center space-x-6">
        {selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-100"
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

        {/* 统一导入下拉：AI 智能上传 / JSON 导入 */}
        {(onAIImport || onImport) && (
          <div className="relative" ref={importMenuRef}>
            <button
              onClick={() => setImportMenuOpen((v) => !v)}
              className={cn(
                "px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 h-11",
                "bg-white border border-slate-200 dark:border-slate-800",
                "text-slate-700 dark:text-slate-300 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-slate-700",
                "active:scale-95 shadow-sm"
              )}
            >
              <Upload className="w-4 h-4 text-blue-500" />
              导入
            </button>

            {importMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden z-50">
                {onAIImport && (
                  <button
                    onClick={() => {
                      setImportMenuOpen(false);
                      onAIImport();
                    }}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-slate-900 dark:text-slate-100" />
                    AI 智能上传
                  </button>
                )}
                {onImport && (
                  <button
                    onClick={() => {
                      setImportMenuOpen(false);
                      onImport();
                    }}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 border-t border-slate-100 dark:border-slate-700/50"
                  >
                    <Upload className="w-4 h-4 text-blue-500" />
                    JSON 导入
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 创建按钮 */}
        <Button
          onClick={onCreate}
          className="rounded-xl h-11 px-6 font-black bg-blue-500 hover:bg-blue-600 text-white shadow-xl shadow-blue-100 transition-all duration-300 transform hover:scale-105 active:scale-95"
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

import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIImportButtonProps {
  onClick: () => void;
  className?: string;
  variant?: 'outline' | 'ghost' | 'default';
  showIcon?: boolean;
}

export const AIImportButton: React.FC<AIImportButtonProps> = ({
  onClick,
  className,
  variant = 'outline',
  showIcon = true,
}) => {
  const baseStyles = "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all active:scale-95 shadow-sm";
  
  const variants = {
    outline: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300",
    ghost: "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700",
    default: "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(baseStyles, variants[variant], className)}
    >
      {showIcon && <Sparkles className="h-4 w-4 text-slate-900 dark:text-slate-100 animate-pulse" />}
      AI 智能导入
    </button>
  );
};

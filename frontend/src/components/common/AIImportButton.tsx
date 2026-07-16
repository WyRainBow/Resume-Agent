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
  const baseStyles = "inline-flex items-center justify-center gap-2 rounded-none px-5 py-2.5 text-sm font-mono font-bold uppercase tracking-wide transition-[transform,box-shadow,background-color] duration-100 ease-out disabled:pointer-events-none disabled:opacity-50";

  const variants = {
    outline: "bg-[#F0F0E8] text-black border border-black shadow-[2px_2px_0px_0px_#000000] hover:bg-[#E5E5E0] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none active:translate-y-[2px] active:translate-x-[2px]",
    ghost: "bg-transparent text-black border-none shadow-none hover:bg-[#E5E5E0] active:bg-[#E5E5E0]",
    default: "bg-blue-700 text-white border border-black shadow-[2px_2px_0px_0px_#000000] hover:bg-blue-800 hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none active:translate-y-[2px] active:translate-x-[2px]",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(baseStyles, variants[variant], className)}
    >
      {showIcon && <Sparkles className="h-4 w-4" />}
      AI 智能导入
    </button>
  );
};

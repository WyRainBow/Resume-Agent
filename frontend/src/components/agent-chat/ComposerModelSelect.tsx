import { ChevronDown } from "lucide-react";

import type { AgentModelOption } from "@/services/agentModels";

interface ComposerModelSelectProps {
  options: AgentModelOption[];
  value: string;
  isLoading: boolean;
  isDisabled: boolean;
  onChange: (value: string) => void;
}

export default function ComposerModelSelect({
  options,
  value,
  isLoading,
  isDisabled,
  onChange,
}: ComposerModelSelectProps) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">选择大语言模型</span>
      <select
        value={value}
        disabled={isDisabled || isLoading || options.length === 0}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 max-w-[168px] appearance-none rounded-full border border-slate-300 bg-white pl-3 pr-8 text-sm text-slate-600 outline-none transition-colors hover:border-indigo-300 focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        title="选择当前对话使用的大语言模型"
      >
        {isLoading && <option value="">加载模型中...</option>}
        {!isLoading && options.length === 0 && <option value="">暂无可选模型</option>}
        {!isLoading && options.length > 0 && !value && (
          <option value="">请选择模型</option>
        )}
        {!isLoading &&
          options.map((option) => (
            <option
              key={option.id}
              value={option.id}
              disabled={!option.available}
            >
              {option.label}
              {!option.available
                ? option.supported
                  ? " (未配置)"
                  : " (暂不支持)"
                : ""}
            </option>
          ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-4 text-slate-400" />
    </label>
  );
}

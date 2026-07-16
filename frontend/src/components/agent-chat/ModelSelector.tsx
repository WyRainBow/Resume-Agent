import { Sparkles } from "lucide-react";
import PortalDropdown from "@/components/common/PortalDropdown";

/** Agent 可选模型（与后端 _ALLOWED_AGENT_MODELS 白名单一致） */
export const AGENT_MODELS = [
  { value: "deepseek-v4-flash", label: "DeepSeek V4 Flash", hint: "快速 · 高性价比 · 默认推荐" },
  { value: "qwen-max", label: "Qwen Max", hint: "强力 · 复杂任务 · 深度优化" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", hint: "智能 · 结构化精准 · 长上下文" },
];

export const DEFAULT_AGENT_MODEL = "deepseek-v4-flash";

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

/** 对话页模型选择器（参考 Manus 顶部模型下拉），复用 PortalDropdown */
export default function ModelSelector({ value, onChange }: ModelSelectorProps) {
  // 只有一个模型时不显示选择器
  if (AGENT_MODELS.length <= 1) return null;

  return (
    <div className="w-[13rem] shrink-0">
      <PortalDropdown
        value={value}
        options={AGENT_MODELS}
        placeholder="选择模型"
        onSelect={(v) => v && onChange(v)}
        selectedIcon={<Sparkles className="size-4 shrink-0 text-chat-accent dark:text-amber-400" />}
        dropdownClassName="min-w-[16rem]"
        triggerClassName="h-8 px-2.5"
        triggerLabelClassName="text-[15px]"
      />
    </div>
  );
}

import { Sparkles } from "lucide-react";
import PortalDropdown from "@/components/common/PortalDropdown";

/** Agent 可选模型（与后端 _ALLOWED_AGENT_MODELS 白名单一致） */
export const AGENT_MODELS = [
  { value: "qwen-max", label: "Qwen Max", hint: "强力 · 复杂任务 · 深度优化" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", hint: "均衡 · 综合能力强 · 结构化精准" },
];

export const DEFAULT_AGENT_MODEL = "qwen-max";

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

/** 对话页模型选择器（参考 Manus 顶部模型下拉），复用 PortalDropdown */
export default function ModelSelector({ value, onChange }: ModelSelectorProps) {
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

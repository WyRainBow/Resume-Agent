/**
 * AI 导入弹窗组件（从 v1 移植）
 * 支持全局导入和分模块导入
 */
import {
  ChevronDown,
  Copy,
  RotateCcw,
  Save,
  Wand2,
  X,
  Upload,
  FileText,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../../../lib/utils";
import FileUploadZone from "./FileUploadZone";
import { getApiBaseUrl } from "@/lib/runtimeEnv";

// DeepSeek 官方 logo（Wikimedia Commons，MIT/Expat）
const DEEPSEEK_LOGO_URL =
  "https://upload.wikimedia.org/wikipedia/commons/e/ec/DeepSeek_logo.svg";

// 可用的 AI 模型列表
const AI_MODELS = [
  {
    id: "deepseek-v3.2",
    name: "DeepSeek",
    description: "智能解析简历内容",
    logoUrl: DEEPSEEK_LOGO_URL,
  },
];

export type SectionType =
  | "contact"
  | "education"
  | "experience"
  | "projects"
  | "skills"
  | "awards"
  | "summary"
  | "opensource"
  | "all"; // 全局导入

export interface AIImportModalProps {
  isOpen: boolean;
  sectionType: SectionType | string;
  sectionTitle: string;
  onClose: () => void;
  onSave: (data: any) => void;
}

// AI 导入提示词占位符
const aiImportPlaceholders: Record<string, string> = {
  contact:
    "张三\n电话: 13800138000\n邮箱: zhangsan@example.com\n地区: 北京\n求职意向: 后端开发工程师",
  education:
    "华南理工大学\n本科 · 计算机科学与技术\n2020.09 - 2024.06\nGPA: 3.8/4.0",
  experience:
    "字节跳动 · 后端开发实习生\n2023.06 - 2023.09\n- 负责推荐系统后端开发\n- 优化接口性能，QPS 提升 50%",
  projects:
    "智能简历系统\n技术负责人 · 2023.01 - 2023.06\n- 使用 React + FastAPI 开发\n- 集成 AI 自动生成功能\nGitHub: https://github.com/xxx/resume",
  skills:
    "编程语言: Java, Python, Go\n数据库: MySQL, Redis, MongoDB\n框架: Spring Boot, FastAPI",
  awards: "国家奖学金 · 2023\nACM 省级一等奖 · 2022\n优秀毕业生 · 2024",
  summary:
    "3年后端开发经验，熟悉 Java/Go 技术栈，擅长高并发系统设计与优化，有丰富的微服务架构经验。",
  opensource:
    "Kubernetes\n核心贡献者 · 2023.03 - 2024.06\n- 提交性能优化 PR #12345，优化 Pod 调度算法，被成功合并\n- 修复关键 Bug #12346，解决内存泄漏问题\n- 参与社区讨论，协助新贡献者\n仓库: https://github.com/kubernetes/kubernetes\n\nVue.js\n贡献者 · 2022.08 - 2023.12\n- 实现新特性：响应式系统性能优化\n- 修复 SSR 渲染问题，提升首屏加载速度 30%\n- 编写单元测试，提升代码覆盖率\n仓库: https://github.com/vuejs/vue\n\nReact\n社区维护者 · 2021.05 - 2022.10\n- 维护 React 官方文档中文翻译\n- 提交多个 Bug 修复和性能优化 PR\n- 组织线上技术分享活动\n仓库: https://github.com/facebook/react",
  all: "张三\n电话: 13800138000\n邮箱: zhangsan@example.com\n求职意向: 后端开发工程师\n\n教育经历:\n北京大学\n计算机科学与技术\n2022.09 - 2026.06\n学校: 清华大学\n学历: 本科\n专业: 电子信息\n\n实习经历:\n实习经历一\n算法实习生\n2025.06 - 2025.10\n\n实习经历二\n后端开发实习生\n2025.02 - 2025.06\n\n实习经历三\n前端开发实习生\n2024.12 - 2025.01\n\n项目经历:\n项目一\n- 子项目甲\n  * 描述该子项目的主要目标和解决的问题\n  * 概述采用的核心技术手段或架构思路\n  * 说明实现过程中的关键策略或容灾措施\n- 子项目乙\n  * 介绍从 0 到 1 搭建某模块的背景与价值\n  * 说明缓存或性能优化的思路与结果\n  * 描述数据一致性或稳定性保障方案\n- 子项目丙\n  * 总结优化高风险操作的范围与收益\n  * 概括查询调优、索引策略等具体动作\n  * 解释资源隔离或负载转移方式\n\n项目二\n- 项目描述：\n  概述一个具备多模态检索、长文阅读与结构化输出能力的智能系统，强调其解决的痛点与特性。\n- 核心职责与产出：\n  描述在需求拆解、链路打通以及配套平台建设中的角色与贡献。\n  * 模块一：说明如何利用大模型进行推理规划与查询扩展，提升召回能力\n  * 模块二：概括多源融合检索架构，指出使用的检索方式与调度策略\n  * 模块三：描述 RAG 或抗幻觉生成的实现思路、Prompt 策略与输出形式\n  * 模块四：介绍广告或数据闭环链路的建设，涵盖埋点、分析与反馈机制\n\n开源经历:\n社区贡献一（某分布式项目）\n* 仓库：[https://example.com/repo1](https://example.com/repo1)\n* 简述提交的核心 PR 或 Issue 处理经验\n* 说明在社区内承担的协作职责\n\n社区贡献二\n* 组件一：列举涉及的技术栈与能力范围\n* 仓库：[https://example.com/repo2（可演示）](https://example.com/repo2（可演示）)\n* 能力二：描述检索、知识构建或多 Agent 流程的实现\n* 成果：简述分享传播与社区反馈\n\n专业技能:\n后端: 熟悉若干编程语言或服务框架\n数据库: 了解常见数据库及调优思路\n缓存: 掌握缓存策略与典型问题处理\n网络: 熟悉常见网络协议与连接管理\n操作系统: 理解进程线程与资源管理机制\nAI: 了解 Agent、RAG、Function Call 与 Prompt 工程\n\n荣誉奖项:\n例如学科竞赛、省级奖项等",
};

export function AIImportModal({
  isOpen,
  sectionType,
  sectionTitle,
  onClose,
  onSave,
}: AIImportModalProps) {
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [finalTime, setFinalTime] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState("deepseek-v3.2");
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const [importMode, setImportMode] = useState<"file" | "text">("file");
  const [currentStep, setCurrentStep] = useState<"input" | "results">("input");
  const [testKeysLoading, setTestKeysLoading] = useState(false);
  const [testKeysResult, setTestKeysResult] = useState<Record<
    string,
    { configured: boolean; ok?: boolean; error?: string }
  > | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowModelDropdown(false);
      }
    };
    if (showModelDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showModelDropdown]);

  // 计时器逻辑
  useEffect(() => {
    if (parsing) {
      setElapsedTime(0);
      setFinalTime(null);
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTimeRef.current);
      }, 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      if (startTimeRef.current > 0) {
        setFinalTime(Date.now() - startTimeRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [parsing]);

  // 重置状态
  useEffect(() => {
    if (!isOpen) {
      setText("");
      setParsedData(null);
      setFinalTime(null);
      setSelectedFile(null);
      setImportMode("file");
      setCurrentStep("input");
    }
  }, [isOpen]);

  // AI 解析
  const handleParse = async () => {
    if (!text.trim()) return;
    setParsing(true);
    setParsedData(null);

    try {
      // 处理命名不一致：openSource -> opensource
      const normalizedType =
        sectionType === "openSource" ? "opensource" : sectionType;

      // 根据是否全局导入选择不同的 API
      const apiBase = getApiBaseUrl();
      const endpoint =
        sectionType === "all"
          ? `${apiBase}/api/resume/parse` // 全局解析
          : `${apiBase}/api/resume/parse-section`; // 分模块解析

      const body =
        sectionType === "all"
          ? { text: text.trim(), model: selectedModel }
          : {
              text: text.trim(),
              section_type: normalizedType,
              model: selectedModel,
            };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let errMsg = "解析失败";
        try {
          const err = await response.json();
          errMsg = err.detail || errMsg;
        } catch {
          errMsg = `HTTP ${response.status}`;
        }
        throw new Error(errMsg);
      }

      const result = await response.json();
      // 全局解析返回 { resume: {...} }，提取 resume 字段
      if (sectionType === "all") {
        setParsedData(result.resume || result);
      } else {
        setParsedData(result.data || result);
      }
      setCurrentStep("results");
    } catch (err: any) {
      console.error("AI 解析失败:", err);
      alert("解析失败: " + err.message);
    } finally {
      setParsing(false);
    }
  };

  const handlePdfUpload = async () => {
    if (!selectedFile) return;
    setParsing(true);
    setParsedData(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("model", selectedModel);

      const response = await fetch(`${getApiBaseUrl()}/api/resume/upload-pdf`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errMsg = "解析失败";
        try {
          const err = await response.json();
          errMsg = err.detail || errMsg;
        } catch {
          errMsg = `HTTP ${response.status}`;
        }
        throw new Error(errMsg);
      }

      const result = await response.json();
      setParsedData(result.resume || result.data || result);
      setCurrentStep("results");
    } catch (err: any) {
      console.error("PDF 解析失败:", err);
      alert("解析失败: " + err.message);
    } finally {
      setParsing(false);
    }
  };

  // 保存数据
  const handleSave = () => {
    if (parsedData) {
      onSave(parsedData);
      onClose();
    }
  };

  const handleCopyJson = async () => {
    if (!parsedData) return;
    const jsonText = JSON.stringify(parsedData, null, 2);
    try {
      await navigator.clipboard.writeText(jsonText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = jsonText;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } finally {
        document.body.removeChild(textarea);
      }
    }
  };

  const formatTime = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
  const getTimeColor = (ms: number) => {
    if (ms < 2000) return "text-green-400";
    if (ms < 5000) return "text-yellow-400";
    return "text-red-400";
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative w-full transition-all duration-300",
          currentStep === "results" ? "max-w-4xl" : "max-w-2xl",
          "max-h-[90vh] flex flex-col",
          "bg-white dark:bg-slate-900",
          "rounded-2xl shadow-2xl",
          "border border-slate-200 dark:border-slate-700",
          "overflow-hidden",
          "animate-in fade-in-0 zoom-in-95 duration-200",
        )}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 flex items-center justify-center">
              <Upload className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {parsing
                  ? "正在解析内容"
                  : currentStep === "results"
                    ? "解析结果预览"
                    : sectionType === "all"
                      ? "导入简历"
                      : `AI 导入 - ${sectionTitle}`}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {parsing
                  ? "AI 正在处理您的请求，请稍候..."
                  : currentStep === "results"
                    ? "请检查解析出的数据是否准确，点击下方按钮填充到表单"
                    : sectionType === "all"
                      ? "上传或粘贴简历内容，系统将自动解析并导入"
                      : "粘贴或输入该模块的文本内容：AI 将自动解析并填充"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300",
              "hover:bg-slate-100 dark:hover:bg-slate-800",
              "transition-colors",
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-hidden p-6 flex flex-col min-h-[450px]">
          {/* 第一步：输入视图 */}
          {currentStep === "input" && !parsing && (
            <div className="space-y-4 animate-in fade-in duration-300 flex-1 flex flex-col overflow-y-auto custom-scrollbar pr-2">
              {/* 如果已经有解析结果，显示一个提示条 */}
              {parsedData && (
                <div className="mb-4 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 flex items-center justify-between animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">
                      已有解析好的数据
                    </span>
                  </div>
                  <button
                    onClick={() => setCurrentStep("results")}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    查看结果
                    <ChevronDown className="w-3 h-3 -rotate-90" />
                  </button>
                </div>
              )}

              {/* 模型选择器 */}
              <div className="relative" ref={dropdownRef}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    选择 AI 模型
                  </label>
                  <button
                    type="button"
                    disabled={testKeysLoading}
                    onClick={async () => {
                      setTestKeysLoading(true);
                      setTestKeysResult(null);
                      try {
                        const res = await fetch(`${getApiBaseUrl()}/api/ai/test-keys`);
                        const data = await res.json();
                        if (res.ok) setTestKeysResult(data);
                        else setTestKeysResult({ _: { configured: false, ok: false, error: "请求失败" } });
                      } catch (e) {
                        setTestKeysResult({
                          _: { configured: false, ok: false, error: (e as Error).message },
                        });
                      } finally {
                        setTestKeysLoading(false);
                      }
                    }}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-lg border transition-colors",
                      "border-slate-200 dark:border-slate-600",
                      "text-slate-600 dark:text-slate-400",
                      "hover:bg-slate-100 dark:hover:bg-slate-700",
                      testKeysLoading && "opacity-60 pointer-events-none",
                    )}
                  >
                    {testKeysLoading ? "检测中…" : "测试 AI"}
                  </button>
                </div>
                {testKeysResult && !("_" in testKeysResult) && (
                  <div className="mb-2 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    {(["zhipu", "doubao", "deepseek"] as const).map((key) => {
                      const r = testKeysResult[key];
                      if (!r) return null;
                      const label = { zhipu: "智谱", doubao: "豆包", deepseek: "DeepSeek" }[key];
                      const text = !r.configured
                        ? `${label}: 未配置`
                        : r.ok
                          ? `${label}: 可用`
                          : `${label}: 不可用${r.error ? ` (${r.error})` : ""}`;
                      return (
                        <div
                          key={key}
                          className={cn(
                            !r.configured && "text-slate-400 dark:text-slate-500",
                            r.configured && r.ok && "text-green-600 dark:text-green-400",
                            r.configured && !r.ok && "text-amber-600 dark:text-amber-400",
                          )}
                        >
                          {text}
                        </div>
                      );
                    })}
                  </div>
                )}
                {testKeysResult && "_" in testKeysResult && (
                  <div className="mb-2 text-xs text-amber-600 dark:text-amber-400">
                    检测失败: {(testKeysResult as Record<string, { error?: string }>)._?.error ?? "未知错误"}
                  </div>
                )}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl",
                      "bg-slate-50 dark:bg-slate-800",
                      "border border-slate-200 dark:border-slate-700",
                      "text-slate-900 dark:text-slate-100",
                      "text-left",
                      "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent",
                      "transition-all",
                      "flex items-center justify-between",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-20 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden p-2">
                        {AI_MODELS.find((m) => m.id === selectedModel)?.logoUrl ? (
                          <img
                            src={AI_MODELS.find((m) => m.id === selectedModel)!.logoUrl}
                            alt="DeepSeek"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Wand2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold">
                          {AI_MODELS.find((m) => m.id === selectedModel)?.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {
                            AI_MODELS.find((m) => m.id === selectedModel)
                              ?.description
                          }
                        </div>
                      </div>
                    </div>
                    <ChevronDown
                      className={cn(
                        "w-5 h-5 text-slate-400 transition-transform",
                        showModelDropdown && "rotate-180",
                      )}
                    />
                  </button>

                  {/* 下拉菜单 */}
                  {showModelDropdown && (
                    <div className="absolute z-10 w-full mt-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">
                      {AI_MODELS.map((model) => (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => {
                            setSelectedModel(model.id);
                            setShowModelDropdown(false);
                          }}
                          className={cn(
                            "w-full px-4 py-3 text-left transition-colors",
                            "hover:bg-slate-50 dark:hover:bg-slate-700",
                            selectedModel === model.id &&
                              "bg-purple-50 dark:bg-purple-900/20",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "w-20 h-20 rounded-lg flex items-center justify-center overflow-hidden p-2",
                                selectedModel === model.id
                                  ? "bg-slate-100 dark:bg-slate-700 ring-2 ring-purple-500"
                                  : "bg-slate-200 dark:bg-slate-700",
                              )}
                            >
                              {"logoUrl" in model && model.logoUrl ? (
                                <img
                                  src={model.logoUrl}
                                  alt={model.name}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <Wand2
                                  className={cn(
                                    "w-4 h-4",
                                    selectedModel === model.id
                                      ? "text-purple-600 dark:text-purple-400"
                                      : "text-slate-500 dark:text-slate-400",
                                  )}
                                />
                              )}
                            </div>
                            <div>
                              <div
                                className={cn(
                                  "font-semibold",
                                  selectedModel === model.id
                                    ? "text-purple-700 dark:text-purple-400"
                                    : "text-slate-900 dark:text-slate-100",
                                )}
                              >
                                {model.name}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {model.description}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {sectionType === "all" ? (
                <div className="space-y-4 flex-1 flex flex-col">
                  {/* Tab 切换 */}
                  <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl flex-shrink-0">
                    <button
                      onClick={() => setImportMode("file")}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all",
                        importMode === "file"
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                      )}
                    >
                      <Upload className="w-4 h-4" />
                      文件上传
                    </button>
                    <button
                      onClick={() => setImportMode("text")}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all",
                        importMode === "text"
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                      )}
                    >
                      <FileText className="w-4 h-4" />
                      文本粘贴
                    </button>
                  </div>

                  {/* 内容区域 */}
                  <div className="flex-1 flex flex-col min-h-[350px]">
                    {importMode === "file" && (
                      <div className="flex-1 flex flex-col space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex-shrink-0">
                          文件上传
                        </div>
                        <div className="flex-1 min-h-0 overflow-hidden">
                          <FileUploadZone
                            file={selectedFile}
                            onFileSelect={setSelectedFile}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handlePdfUpload}
                          disabled={!selectedFile || parsing}
                          className={cn(
                            "w-full rounded-xl px-4 py-2.5 text-sm font-semibold flex-shrink-0",
                            "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30",
                            "hover:bg-indigo-600",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            "transition-all",
                          )}
                        >
                          {parsing ? "解析中..." : "上传解析 PDF"}
                        </button>
                      </div>
                    )}

                    {importMode === "text" && (
                      <div className="flex-1 flex flex-col space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex-shrink-0">
                          文本粘贴
                        </div>
                        <div className="flex-1 min-h-0 flex flex-col space-y-2 overflow-hidden">
                          <label className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
                            粘贴简历内容（按 Tab 键快速填充示例内容）
                          </label>
                          <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Tab") {
                                const placeholder =
                                  aiImportPlaceholders["all"] || "";
                                if (
                                  placeholder &&
                                  (!text || placeholder.startsWith(text))
                                ) {
                                  e.preventDefault();
                                  setText(placeholder);
                                }
                              }
                            }}
                            placeholder={aiImportPlaceholders["all"] || "请输入文本内容..."}
                            className={cn(
                              "w-full flex-1 p-4 rounded-xl resize-none",
                              "bg-slate-50 dark:bg-slate-800/50",
                              "border border-slate-200 dark:border-slate-700",
                              "text-slate-900 dark:text-slate-100 text-sm",
                              "placeholder:text-slate-400 dark:placeholder:text-slate-500",
                              "outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent",
                              "transition-all",
                              "font-mono",
                            )}
                          />
                          {text && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
                              字符数: {text.length}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={handleParse}
                          disabled={!text.trim() || parsing}
                          className={cn(
                            "w-full rounded-xl px-4 py-2.5 text-sm font-semibold flex-shrink-0",
                            "bg-gradient-to-r from-purple-500 to-indigo-600 text-white",
                            "hover:from-purple-600 hover:to-indigo-700",
                            "shadow-lg shadow-purple-500/30",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            "transition-all",
                          )}
                        >
                          {parsing ? "解析中..." : "AI 解析文本"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 flex-1 flex flex-col">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-shrink-0">
                    文本内容
                    <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">
                      （按 Tab 键快速填充示例内容）
                    </span>
                  </label>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Tab") {
                        const normalizedType =
                          sectionType === "openSource" ? "opensource" : sectionType;
                        const placeholder =
                          aiImportPlaceholders[normalizedType] || "";
                        if (
                          placeholder &&
                          (!text || placeholder.startsWith(text))
                        ) {
                          e.preventDefault();
                          setText(placeholder);
                        }
                      }
                    }}
                    placeholder={(() => {
                      const normalizedType =
                        sectionType === "openSource" ? "opensource" : sectionType;
                      return (
                        aiImportPlaceholders[normalizedType] || "请输入文本内容..."
                      );
                    })()}
                    className={cn(
                      "w-full flex-1 p-4 rounded-xl resize-none",
                      "bg-slate-50 dark:bg-slate-800/50",
                      "border border-slate-200 dark:border-slate-700",
                      "text-slate-900 dark:text-slate-100 text-sm",
                      "placeholder:text-slate-400 dark:placeholder:text-slate-500",
                      "outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent",
                      "transition-all",
                      "font-mono",
                    )}
                  />
                  {text && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
                      字符数: {text.length}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 解析结果预览 */}
          {currentStep === "results" && !parsing && parsedData && (
            <div
              className={cn(
                "flex-1 flex flex-col p-6 rounded-2xl overflow-hidden",
                "bg-green-50/50 dark:bg-green-900/10",
                "border border-green-200 dark:border-green-800/50",
                "animate-in zoom-in-95 duration-300",
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/20">
                    <span className="text-white text-lg font-bold">✓</span>
                  </div>
                  <div>
                    <span className="text-green-800 dark:text-green-300 text-base font-bold block">
                      解析成功！
                    </span>
                    <span className="text-green-600/80 dark:text-green-400/80 text-xs">
                      共解析出 {Object.keys(parsedData).length} 个核心数据项
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold",
                    "bg-white dark:bg-slate-800",
                    "border border-green-200 dark:border-green-800",
                    "text-green-700 dark:text-green-400",
                    "hover:bg-green-50 dark:hover:bg-green-900/30",
                    "transition-all shadow-sm",
                  )}
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? "已复制" : "复制结果"}
                </button>
              </div>
              
              <div className="flex-1 min-h-0 overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-inner">
                <div className="h-full overflow-auto p-4 custom-scrollbar">
                  <pre className="m-0 text-slate-700 dark:text-slate-300 text-sm whitespace-pre-wrap break-words font-mono leading-relaxed">
                    {JSON.stringify(parsedData, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-green-100 dark:border-green-900/20 text-xs text-green-700/70 dark:text-green-400/70 flex items-center gap-2 flex-shrink-0">
                <FileText className="w-3.5 h-3.5" />
                提示：您可以点击右下角的“填充到表单”按钮，将这些数据自动填写到简历编辑器中。
              </div>
            </div>
          )}

          {/* 加载状态 */}
          {parsing && (
            <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 animate-in fade-in duration-300">
              <div className="relative mb-8">
                <div className="w-20 h-20 border-4 border-purple-100 dark:border-purple-900/30 rounded-full" />
                <div className="absolute inset-0 w-20 h-20 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Wand2 className="w-8 h-8 text-purple-500 animate-pulse" />
                </div>
              </div>
              
              <div className="text-center space-y-3 max-w-xs">
                <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  AI 正在深度解析...
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  我们的 AI 正在提取关键信息并进行结构化处理 这通常需要 3-10 秒钟。
                </p>
              </div>

              <div className="mt-8 w-full max-w-[240px] bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-purple-500 h-full w-full animate-pulse" />
              </div>

              <div className={cn(
                "mt-6 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm",
                "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
                getTimeColor(elapsedTime)
              )}>
                {formatTime(elapsedTime)}
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          {currentStep === "input" ? (
            <>
              <button
                onClick={onClose}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium",
                  "text-slate-700 dark:text-slate-300",
                  "hover:bg-slate-100 dark:hover:bg-slate-700",
                  "transition-colors",
                )}
              >
                取消
              </button>

              {/* 解析按钮（非全局导入时显示，全局导入时按钮在内容区） */}
              {sectionType !== "all" && (
                <div className="flex items-center gap-2">
                  {parsedData && (
                    <button
                      onClick={() => setCurrentStep("results")}
                      className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      查看已有结果
                    </button>
                  )}
                  <button
                    onClick={handleParse}
                    disabled={!text.trim() || parsing}
                    className={cn(
                      "px-6 py-2.5 rounded-lg text-sm font-semibold",
                      "bg-gradient-to-r from-purple-500 to-indigo-600 text-white",
                      "hover:from-purple-600 hover:to-indigo-700",
                      "shadow-lg shadow-purple-500/30",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "flex items-center gap-2 transition-all",
                    )}
                  >
                    {parsing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        解析中...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        {parsedData ? "重新解析" : "AI 解析"}
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setCurrentStep("input");
                }}
                className={cn(
                  "px-4 py-2.5 rounded-lg text-sm font-medium",
                  "text-slate-700 dark:text-slate-300",
                  "hover:bg-slate-100 dark:hover:bg-slate-700",
                  "transition-colors",
                  "flex items-center gap-2",
                )}
              >
                <RotateCcw className="w-4 h-4" />
                返回修改
              </button>
              <button
                onClick={handleSave}
                className={cn(
                  "px-6 py-2.5 rounded-lg text-sm font-semibold",
                  "bg-gradient-to-r from-green-500 to-emerald-600 text-white",
                  "hover:from-green-600 hover:to-emerald-700",
                  "shadow-lg shadow-green-500/30",
                  "flex items-center gap-2 transition-all",
                )}
              >
                <Save className="w-4 h-4" />
                确认并填充
                {finalTime !== null && (
                  <span
                    className={cn(
                      "text-xs font-medium ml-1 opacity-70",
                    )}
                  >
                    ({formatTime(finalTime)})
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AIImportModal;

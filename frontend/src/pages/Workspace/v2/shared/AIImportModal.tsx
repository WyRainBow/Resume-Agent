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

// 可用的 AI 模型列表
const AI_MODELS = [
  {
    id: "deepseek-chat",
    name: "DeepSeek",
    description: "智能解析简历内容",
  },
];

// 处理 API_BASE，确保有协议前缀
const rawApiBase =
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || "";
const API_BASE = rawApiBase
  ? rawApiBase.startsWith("http")
    ? rawApiBase
    : `https://${rawApiBase}`
  : import.meta.env.PROD
    ? "" // 生产环境使用相对路径
    : "http://localhost:9000"; // 开发环境

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
  const [selectedModel, setSelectedModel] = useState("deepseek-chat");
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const [importMode, setImportMode] = useState<"file" | "text">("file");
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
      const endpoint =
        sectionType === "all"
          ? `${API_BASE}/api/resume/parse` // 全局解析
          : `${API_BASE}/api/resume/parse-section`; // 分模块解析

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

      const response = await fetch(`${API_BASE}/api/resume/upload-pdf`, {
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
          "relative w-full max-w-2xl",
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
                {sectionType === "all"
                  ? "导入简历"
                  : `AI 导入 - ${sectionTitle}`}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {sectionType === "all"
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
        <div className="p-6 space-y-4">
          {/* 模型选择器 */}
          <div className="relative" ref={dropdownRef}>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
              选择 AI 模型
            </label>
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
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                    <Wand2 className="w-4 h-4 text-white" />
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
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            selectedModel === model.id
                              ? "bg-gradient-to-br from-purple-500 to-indigo-600"
                              : "bg-slate-200 dark:bg-slate-700",
                          )}
                        >
                          <Wand2
                            className={cn(
                              "w-4 h-4",
                              selectedModel === model.id
                                ? "text-white"
                                : "text-slate-500 dark:text-slate-400",
                            )}
                          />
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
            <div className="space-y-4">
              {/* Tab 切换 */}
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
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
              <div className="h-[350px]">
                {importMode === "file" && (
                  <div className="h-full flex flex-col space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      文件上传
                    </div>
                    <div className="flex-1 overflow-hidden">
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
                  <div className="h-full flex flex-col space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      文本粘贴
                    </div>
                    <div className="flex-1 flex flex-col space-y-2 overflow-hidden">
                      <label className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
                        粘贴简历内容（按 Tab 键快速填充示例内容）
                      </label>
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Tab") {
                            const normalizedType =
                              sectionType === "openSource"
                                ? "opensource"
                                : sectionType;
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
                            sectionType === "openSource"
                              ? "opensource"
                              : sectionType;
                          return (
                            aiImportPlaceholders[normalizedType] ||
                            "请输入文本内容..."
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
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
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
                  "w-full min-h-[200px] p-4 rounded-xl resize-y",
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
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  字符数: {text.length}
                </div>
              )}
            </div>
          )}

          {/* 解析结果预览 */}
          {parsedData && (
            <div
              className={cn(
                "p-4 rounded-xl",
                "bg-green-50 dark:bg-green-900/20",
                "border border-green-200 dark:border-green-800",
                "animate-in slide-in-from-top-2 duration-300",
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <span className="text-green-700 dark:text-green-400 text-sm font-semibold">
                    解析成功！
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium",
                    "border border-green-200 dark:border-green-800",
                    "text-green-700 dark:text-green-400",
                    "hover:bg-green-100 dark:hover:bg-green-900/30",
                    "transition-colors",
                  )}
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? "已复制" : "复制 JSON"}
                </button>
              </div>
              <div className="max-h-[200px] overflow-auto rounded-lg bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-700">
                <pre className="m-0 text-slate-700 dark:text-slate-300 text-xs whitespace-pre-wrap break-words font-mono">
                  {JSON.stringify(parsedData, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* 加载状态 */}
          {parsing && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <div className="flex-1">
                <div className="text-sm font-medium text-purple-700 dark:text-purple-400">
                  AI 正在解析中...
                </div>
                <div className="text-xs text-purple-600 dark:text-purple-500 mt-1">
                  预计需要几秒钟：请稍候
                </div>
              </div>
              <span
                className={cn(
                  "text-sm font-medium min-w-[50px] text-right",
                  getTimeColor(elapsedTime),
                )}
              >
                {formatTime(elapsedTime)}
              </span>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
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

          {/* 解析按钮（非全局导入时使用） */}
          {!parsedData && sectionType !== "all" && (
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
                  AI 解析
                </>
              )}
            </button>
          )}

          {/* 保存按钮 */}
          {parsedData && (
            <>
              <button
                onClick={() => {
                  setParsedData(null);
                  setFinalTime(null);
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
                重新解析
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
                填充到表单
                {finalTime !== null && (
                  <span
                    className={cn(
                      "text-xs font-medium ml-1",
                      getTimeColor(finalTime),
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

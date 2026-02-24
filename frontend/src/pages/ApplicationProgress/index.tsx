/**
 * 投递进展表：多维表格形式，白底 UI
 * 工具栏：撤销/重做/插入新行/置顶选中/删除选中/导出表格
 * 列：公司、投递链接、行业、职位、地点、进展、备注、投递时间、内推码、使用的 PDF
 */
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useLayoutEffect,
  type ClipboardEvent,
} from "react";
import { createPortal } from "react-dom";
import WorkspaceLayout from "@/pages/WorkspaceLayout";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Undo2,
  Redo2,
  Plus,
  ArrowUp,
  Trash2,
  Download,
  GripVertical,
  ExternalLink,
  Wand2,
  ChevronLeft,
  ChevronRight,
  Check,
  MousePointer2,
  Calendar,
  X,
  FileText,
  Keyboard,
  Type,
  ImageIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getAllResumes } from "@/services/resumeStorage";
import PortalDropdown, {
  type PortalDropdownOption,
} from "@/components/common/PortalDropdown";
import type { SavedResume } from "@/services/storage/StorageAdapter";
import {
  listApplicationProgress,
  createApplicationProgress,
  aiParseApplicationProgress,
  updateApplicationProgress,
  deleteApplicationProgress,
  reorderApplicationProgress,
  type ApplicationProgressEntry,
  type ApplicationProgressPayload,
} from "@/services/applicationProgressApi";
import { cn } from "@/lib/utils";

function loadCachedResumes(): SavedResume[] {
  try {
    const raw = localStorage.getItem("resume_resumes");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedResume[]) : [];
  } catch {
    return [];
  }
}

function extractErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "请求失败，请稍后重试";
  const err = error as {
    response?: { data?: { detail?: string } };
    message?: string;
  };
  return err.response?.data?.detail || err.message || "请求失败，请稍后重试";
}

const COLUMNS = [
  { key: "company", label: "公司", width: "180px" },
  { key: "application_link", label: "投递链接", width: "120px" },
  { key: "industry", label: "行业", width: "120px" },
  { key: "position", label: "职位", width: "200px" },
  { key: "location", label: "地点", width: "120px" },
  { key: "progress", label: "进展", width: "140px" },
  { key: "application_date", label: "投递时间", width: "160px" },
  { key: "referral_code", label: "内推码", width: "120px" },
  { key: "resume_id", label: "使用的 PDF", width: "260px" },
  { key: "notes", label: "备注", width: "240px" },
] as const;

const PROGRESS_OPTIONS = [
  "已投简历",
  "简历挂",
  "测评未做",
  "测评完成",
  "等待一面",
  "一面完成",
  "一面被刷",
  "等待二面",
  "二面完成",
  "二面被刷",
];
const PROGRESS_BADGE_CLASS: Record<string, string> = {
  已投简历: "bg-[#E7EDF8] text-[#44506A]",
  简历挂: "bg-[#FF7373] text-white",
  测评未做: "bg-[#BDE8FF] text-[#1F3B4D]",
  测评完成: "bg-[#F7EABD] text-[#4B4122]",
  等待一面: "bg-[#BEEBE3] text-[#1E4A43]",
  一面完成: "bg-[#F7DFE1] text-[#53333A]",
  一面被刷: "bg-[#BFE8B9] text-[#234624]",
  等待二面: "bg-[#E3DAF6] text-[#39334E]",
  二面完成: "bg-[#F0D9EE] text-[#4A3347]",
  二面被刷: "bg-[#D3E68D] text-[#3B4A1F]",
};
const INDUSTRY_OPTIONS = ["互联网", "金融", "制造业"];
const LOCATION_OPTIONS = ["深圳", "北京", "上海", "广州"];
const POSITION_OPTIONS_DEFAULT = ["后端开发工程师", "前端开发工程师"];
const POSITION_OPTIONS_STORAGE_KEY = "application_progress_position_options";

function EmptyEditableCell({
  label = "可编辑",
  title = "点击可编辑",
}: {
  label?: string;
  title?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-slate-300 dark:text-slate-600"
      title={title}
      aria-label={title}
    >
      <MousePointer2 className="w-3 h-3" />
      <span className="text-sm font-medium">{label}</span>
    </span>
  );
}

function loadPositionOptions(): string[] {
  try {
    const raw = localStorage.getItem(POSITION_OPTIONS_STORAGE_KEY);
    if (!raw) return POSITION_OPTIONS_DEFAULT;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return POSITION_OPTIONS_DEFAULT;
    const cleaned = parsed
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
    const merged = Array.from(
      new Set([...POSITION_OPTIONS_DEFAULT, ...cleaned]),
    );
    return merged.length > 0 ? merged : POSITION_OPTIONS_DEFAULT;
  } catch {
    return POSITION_OPTIONS_DEFAULT;
  }
}

function parseAIImportText(rawText: string): ApplicationProgressPayload | null {
  const text = String(rawText || "").trim();
  if (!text) return null;

  const urlMatch = text.match(/https?:\/\/[^\s，,；;。)）]+/i);
  const url = urlMatch?.[0] || null;
  const firstLine =
    text
      .split("\n")
      .map((s) => s.trim())
      .find(Boolean) || "";

  // 公司：优先匹配「投递了X的...」/「投递X」
  const companyMatch =
    text.match(/投递了?\s*([^，,。；;、\s]+?)\s*的/) ||
    text.match(/投递了?\s*([^，,。；;、\s]+)/);
  let company = companyMatch?.[1]?.trim() || null;
  // 兜底：支持“快手 Java 开发工程师”这类简写句式，取首行首词作为公司
  if (!company && firstLine) {
    const fallbackCompany = firstLine.match(
      /^([^\s，,。；;、:：]+)(?=\s|，|,|。|；|;|$)/,
    );
    company = fallbackCompany?.[1]?.trim() || null;
  }

  // 部门：匹配「X的Y部门」
  const deptMatch = text.match(
    /投递了?\s*[^，,。；;、\s]+\s*的([^，,。；;、]+?(?:部门|组|团队))/,
  );
  const department = deptMatch?.[1]?.trim() || null;

  // 职位：优先常见选项，再兜底「xxx工程师」
  const positionMatch =
    text.match(
      /(后端开发工程师|前端开发工程师|AI\s*应用开发工程师|Java\s*开发工程师|Golang\s*开发工程师|Python\s*开发工程师|开发工程师)/i,
    ) || text.match(/([A-Za-z\u4e00-\u9fa5\s]{2,40}工程师)/);
  const position = positionMatch?.[1]?.replace(/\s+/g, " ").trim() || null;

  // 投递时间：今天 / YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD
  let applicationDate: string | null = null;
  if (/今天/.test(text)) {
    applicationDate = formatDateString(new Date());
  } else {
    const d = text.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
    if (d) {
      const y = d[1];
      const m = String(Number(d[2])).padStart(2, "0");
      const day = String(Number(d[3])).padStart(2, "0");
      applicationDate = `${y}-${m}-${day}`;
    }
  }

  // 行业/地点按关键字匹配
  const industry = INDUSTRY_OPTIONS.find((i) => text.includes(i)) || null;
  const location = LOCATION_OPTIONS.find((l) => text.includes(l)) || null;

  const payload: ApplicationProgressPayload = {
    company,
    position,
    industry,
    location,
    application_link: url,
    application_date: applicationDate,
    progress: "已投简历",
    notes: department ? `部门：${department}` : null,
  };

  // 至少要有核心字段之一
  if (!payload.company && !payload.position && !payload.application_link) {
    return null;
  }
  return payload;
}

function parseDateString(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d)
    return null;
  return dt;
}

function formatDateString(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("读取图片失败"));
    };
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

function InlineDatePicker({
  value,
  placeholder,
  onSelect,
}: {
  value: string | null;
  placeholder: string;
  onSelect: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0, width: 0 });
  const selectedDate = parseDateString(value);
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(
    selectedDate?.getFullYear() ?? today.getFullYear(),
  );
  const [currentMonth, setCurrentMonth] = useState(
    selectedDate?.getMonth() ?? today.getMonth(),
  );

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      const portalRoot = document.getElementById(
        "application-progress-date-picker-portal",
      );
      if (triggerRef.current?.contains(target)) return;
      if (portalRoot?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPopupPos({
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 280),
    });
  }, [open, currentYear, currentMonth]);

  const firstDay = new Date(currentYear, currentMonth, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const prevDays = new Date(currentYear, currentMonth, 0).getDate();

  const dayCells: Array<{ day: number; inMonth: boolean; date: Date }> = [];
  for (let i = startWeekday - 1; i >= 0; i -= 1) {
    const day = prevDays - i;
    dayCells.push({
      day,
      inMonth: false,
      date: new Date(currentYear, currentMonth - 1, day),
    });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    dayCells.push({
      day,
      inMonth: true,
      date: new Date(currentYear, currentMonth, day),
    });
  }
  while (dayCells.length < 42) {
    const day = dayCells.length - (startWeekday + daysInMonth) + 1;
    dayCells.push({
      day,
      inMonth: false,
      date: new Date(currentYear, currentMonth + 1, day),
    });
  }

  const selectedStr = selectedDate ? formatDateString(selectedDate) : "";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full h-8 rounded-lg border px-2 text-left flex items-center justify-between gap-1 transition-all duration-200",
          "bg-transparent border-transparent hover:border-slate-300 dark:hover:border-slate-600",
        )}
      >
        <span
          className={cn(
            "truncate text-sm",
            selectedDate
              ? "font-semibold text-slate-800 dark:text-slate-200"
              : "text-slate-400 font-medium",
          )}
        >
          {selectedDate ? formatDateString(selectedDate) : placeholder}
        </span>
        <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-400" />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id="application-progress-date-picker-portal"
            className="fixed inset-0 z-[10000]"
            style={{ pointerEvents: "none" }}
          >
            <div
              className="absolute rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-3"
              style={{
                top: popupPos.top,
                left: popupPos.left,
                width: popupPos.width,
                pointerEvents: "auto",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => {
                    if (currentMonth === 0) {
                      setCurrentYear((y) => y - 1);
                      setCurrentMonth(11);
                    } else {
                      setCurrentMonth((m) => m - 1);
                    }
                  }}
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {currentYear}年 {String(currentMonth + 1).padStart(2, "0")}月
                </div>
                <button
                  type="button"
                  className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => {
                    if (currentMonth === 11) {
                      setCurrentYear((y) => y + 1);
                      setCurrentMonth(0);
                    } else {
                      setCurrentMonth((m) => m + 1);
                    }
                  }}
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>
              <div className="grid grid-cols-7 text-xs text-slate-500 px-1 mb-1">
                {["日", "一", "二", "三", "四", "五", "六"].map((w) => (
                  <span key={w} className="text-center py-1">
                    {w}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {dayCells.map((cell, idx) => {
                  const dateStr = formatDateString(cell.date);
                  const active = dateStr === selectedStr;
                  return (
                    <button
                      key={`${dateStr}-${idx}`}
                      type="button"
                      className={cn(
                        "h-8 rounded-md text-sm transition-colors",
                        active
                          ? "bg-blue-600 text-white"
                          : cell.inMonth
                            ? "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            : "text-slate-300 dark:text-slate-600 hover:bg-slate-100/60",
                      )}
                      onClick={() => {
                        onSelect(dateStr);
                        setOpen(false);
                      }}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-between gap-2">
                <button
                  type="button"
                  className="h-8 px-3 rounded-md border border-slate-300 text-sm text-slate-600 hover:bg-slate-50"
                  onClick={() => {
                    onSelect(null);
                    setOpen(false);
                  }}
                >
                  清空
                </button>
                <button
                  type="button"
                  className="h-8 px-3 rounded-md border border-slate-300 text-sm text-slate-600 hover:bg-slate-50"
                  onClick={() => {
                    onSelect(formatDateString(new Date()));
                    setOpen(false);
                  }}
                >
                  今天
                </button>
                <button
                  type="button"
                  className="h-8 px-3 rounded-md text-sm text-slate-500 hover:bg-slate-50"
                  onClick={() => setOpen(false)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function SortableTableRow({
  row,
  columns,
  resumes,
  selectedIds,
  editingCell,
  onToggleSelect,
  onEditingCell,
  onCellChange,
  renderCell,
}: {
  row: ApplicationProgressEntry;
  columns: readonly { key: string; label: string; width: string }[];
  resumes: SavedResume[];
  selectedIds: Set<string>;
  editingCell: { id: string; key: string } | null;
  onToggleSelect: (id: string) => void;
  onEditingCell: (cell: { id: string; key: string } | null) => void;
  onCellChange: (
    id: string,
    key: string,
    value: string | string[] | null,
  ) => void;
  renderCell: (
    row: ApplicationProgressEntry,
    col: { key: string; label: string; width: string },
  ) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: row.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group h-12",
        selectedIds.has(row.id) && "bg-slate-50 dark:bg-slate-800/40",
        isDragging
          ? "opacity-50 bg-white dark:bg-slate-800 shadow-xl z-[100]"
          : "relative z-0",
      )}
    >
      <td className="p-0 text-center border-r border-slate-50 dark:border-slate-800">
        <div className="flex items-center justify-center h-12">
          <input
            type="checkbox"
            checked={selectedIds.has(row.id)}
            onChange={() => onToggleSelect(row.id)}
            className="rounded w-4 h-4 border-slate-300 text-slate-900 focus:ring-slate-500 transition-transform active:scale-90"
          />
        </div>
      </td>
      <td
        className="p-0 text-slate-300 group-hover:text-slate-400 cursor-grab active:cursor-grabbing transition-colors border-r border-slate-50 dark:border-slate-800"
        {...attributes}
        {...listeners}
      >
        <div className="flex items-center justify-center h-12">
          <GripVertical className="w-4 h-4" />
        </div>
      </td>
      {columns.map((col) => (
        <td
          key={col.key}
          className="p-0 border-r border-slate-50 dark:border-slate-800 align-middle relative"
          onClick={() => {
            // 下拉列单击直接由组件处理，不进入文本编辑态
            if (
              col.key === "resume_id" ||
              col.key === "position" ||
              col.key === "industry" ||
              col.key === "location" ||
              col.key === "progress" ||
              col.key === "application_date"
            ) {
              return;
            }
            onEditingCell({ id: row.id, key: col.key });
          }}
        >
          <div className="h-12 px-4 flex items-center overflow-visible">
            {renderCell(row, col)}
          </div>
        </td>
      ))}
    </tr>
  );
}

export default function ApplicationProgressPage() {
  const { isAuthenticated, openModal } = useAuth();
  const [entries, setEntries] = useState<ApplicationProgressEntry[]>([]);
  const [resumes, setResumes] = useState<SavedResume[]>([]);
  const [resumesLoaded, setResumesLoaded] = useState(false);
  const [resumesLoading, setResumesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{
    id: string;
    key: string;
  } | null>(null);
  const [history, setHistory] = useState<ApplicationProgressEntry[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [positionOptions, setPositionOptions] = useState<string[]>(() =>
    loadPositionOptions(),
  );
  const [aiImportOpen, setAiImportOpen] = useState(false);
  const [aiImportText, setAiImportText] = useState("");
  const [aiImportLoading, setAiImportLoading] = useState(false);
  const [aiImportImageDataUrl, setAiImportImageDataUrl] = useState<
    string | null
  >(null);
  const pasteShortcutLabel =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform)
      ? "Cmd+V"
      : "Ctrl+V";

  const loadData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let nextEntries = await listApplicationProgress();
      if (nextEntries.length === 0) {
        try {
          const seeded = await createApplicationProgress({
            sort_order: 0,
            company: "字节跳动",
            application_link:
              "https://jobs.bytedance.com/campus/position/application",
          });
          nextEntries = [seeded];
        } catch (seedError) {
          console.error(seedError);
        }
      }
      setEntries(nextEntries);
      setHistory([nextEntries]);
      setHistoryIndex(0);
    } catch (e) {
      console.error(e);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const ensureResumesLoaded = useCallback(async () => {
    if (!isAuthenticated || resumesLoading || resumesLoaded) return;
    setResumesLoading(true);
    try {
      const loaded = await getAllResumes();
      setResumes(loaded.length > 0 ? loaded : loadCachedResumes());
    } catch (e) {
      console.error(e);
      setResumes(loadCachedResumes());
    } finally {
      setResumesLoaded(true);
      setResumesLoading(false);
    }
  }, [isAuthenticated, resumesLoading, resumesLoaded]);

  useEffect(() => {
    if (!isAuthenticated) {
      openModal("login");
    }
  }, [isAuthenticated, openModal]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === entries.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(entries.map((e) => e.id)));
  };

  const handleInsertRow = async () => {
    if (!isAuthenticated) {
      openModal("login");
      return;
    }
    const tempId = `tmp_${Date.now()}`;
    const tempRow: ApplicationProgressEntry = {
      id: tempId,
      user_id: 0,
      sort_order: 0,
      company: null,
      application_link: null,
      industry: null,
      position: null,
      location: null,
      progress: null,
      notes: null,
      application_date: null,
      referral_code: null,
      resume_id: null,
    };
    setEntries((prev) => [tempRow, ...prev]);
    setEditingCell({ id: tempId, key: "company" });
    try {
      const created = await createApplicationProgress({ sort_order: 0 });
      setEntries((prev) => [
        created,
        ...prev.filter((row) => row.id !== tempId),
      ]);
      setEditingCell({ id: created.id, key: "company" });
      // 后台拉取一次，确保与服务端排序/数据一致
      void loadData();
    } catch (e) {
      console.error(e);
      setEntries((prev) => prev.filter((row) => row.id !== tempId));
      setEditingCell(null);
      alert(`插入新行失败：${extractErrorMessage(e)}`);
    }
  };

  const handleAIImport = async () => {
    if (!isAuthenticated) {
      openModal("login");
      return;
    }
    setAiImportLoading(true);
    try {
      let payload = null as ApplicationProgressPayload | null;
      try {
        payload = await aiParseApplicationProgress(
          aiImportText.trim() || undefined,
          "zhipu",
          "glm-4.6v",
          aiImportImageDataUrl || undefined,
        );
      } catch (apiError) {
        if (aiImportImageDataUrl) {
          throw apiError;
        }
        console.error("[AI导入] 后端 AI 解析失败，回退本地解析:", apiError);
        payload = parseAIImportText(aiImportText);
      }

      if (
        !payload ||
        (!payload.company && !payload.position && !payload.application_link)
      ) {
        alert("未识别到可导入信息，请至少包含公司/职位/链接中的一项");
        setAiImportLoading(false);
        return;
      }

      const created = await createApplicationProgress({
        sort_order: 0,
        ...payload,
      });
      setEntries((prev) => [created, ...prev]);
      setAiImportOpen(false);
      setAiImportText("");
      setAiImportImageDataUrl(null);
    } catch (e) {
      console.error(e);
      alert(`AI 导入失败：${extractErrorMessage(e)}`);
    } finally {
      setAiImportLoading(false);
    }
  };

  const handleAiImportPasteImage = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const items = Array.from(event.clipboardData?.items || []);
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (!file) return;
      event.preventDefault();
      void fileToDataUrl(file)
        .then((dataUrl) => setAiImportImageDataUrl(dataUrl))
        .catch((err) => alert(extractErrorMessage(err)));
    },
    [],
  );

  const handleDeleteSelected = async () => {
    if (!isAuthenticated || selectedIds.size === 0) return;
    const idsToDelete = Array.from(selectedIds);
    const prevEntries = entries;
    setEntries((prev) => prev.filter((item) => !selectedIds.has(item.id)));
    setSelectedIds(new Set());
    try {
      const results = await Promise.allSettled(
        idsToDelete.map((id) => deleteApplicationProgress(id)),
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        setEntries(prevEntries);
        alert(`删除失败：${failed.length} 条记录删除失败，请重试`);
        return;
      }
      await loadData();
    } catch (e) {
      console.error(e);
      setEntries(prevEntries);
      alert(`删除失败：${extractErrorMessage(e)}`);
    }
  };

  const handlePinSelected = async () => {
    if (!isAuthenticated || selectedIds.size === 0) return;
    const pinned = entries.filter((e) => selectedIds.has(e.id));
    const rest = entries.filter((e) => !selectedIds.has(e.id));
    const newOrder = [...pinned, ...rest].map((e) => e.id);
    try {
      await reorderApplicationProgress(newOrder);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = entries.findIndex((e) => e.id === active.id);
      const newIndex = entries.findIndex((e) => e.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const newOrder = arrayMove(
        entries.map((e) => e.id),
        oldIndex,
        newIndex,
      );
      try {
        await reorderApplicationProgress(newOrder);
        await loadData();
      } catch (e) {
        console.error(e);
      }
    },
    [entries, loadData],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleCreatePositionOption = useCallback(
    (label: string): string | null => {
      const next = label.trim();
      if (!next) return null;
      if (positionOptions.includes(next)) return next;
      const merged = [...positionOptions, next];
      setPositionOptions(merged);
      localStorage.setItem(
        POSITION_OPTIONS_STORAGE_KEY,
        JSON.stringify(merged),
      );
      return next;
    },
    [positionOptions],
  );

  const renderCell = useCallback(
    (
      row: ApplicationProgressEntry,
      col: { key: string; label: string; width: string },
    ) => {
      if (col.key === "resume_id") {
        const hasResumes = resumes.length > 0;
        const resumeOptions: PortalDropdownOption[] = resumes.map((r) => ({
          value: r.id,
          label: r.alias || r.name,
          hint: r.alias && r.alias !== r.name ? r.name : undefined,
        }));
        return (
          <PortalDropdown
            value={row.resume_id ?? null}
            options={resumeOptions}
            placeholder={
              resumesLoading
                ? "加载 PDF 中..."
                : hasResumes
                  ? "未选择（不使用 PDF）"
                  : resumesLoaded
                    ? "无可选 PDF"
                    : "点击加载 PDF 列表"
            }
            disabled={resumesLoading}
            onOpen={ensureResumesLoaded}
            selectedIcon={
              <FileText className="w-4 h-4 text-slate-500 shrink-0" />
            }
            onSelect={(val) => handleCellChange(row.id, col.key, val)}
          />
        );
      }
      if (col.key === "position") {
        const mergedPositionOptions = Array.from(
          new Set([
            ...positionOptions,
            ...(row.position ? [row.position] : []),
          ]),
        );
        const options: PortalDropdownOption[] = mergedPositionOptions.map(
          (o) => ({ value: o, label: o }),
        );
        return (
          <PortalDropdown
            value={row.position ?? null}
            options={options}
            placeholder="请选择职位"
            allowCreate
            createPlaceholder="输入自定义职位"
            onCreateOption={handleCreatePositionOption}
            onSelect={(val) => handleCellChange(row.id, col.key, val)}
          />
        );
      }
      if (col.key === "industry") {
        const options: PortalDropdownOption[] = INDUSTRY_OPTIONS.map((o) => ({
          value: o,
          label: o,
        }));
        return (
          <PortalDropdown
            value={row.industry ?? null}
            options={options}
            placeholder="请选择行业"
            onSelect={(val) => handleCellChange(row.id, col.key, val)}
          />
        );
      }
      if (col.key === "location") {
        const options: PortalDropdownOption[] = LOCATION_OPTIONS.map((o) => ({
          value: o,
          label: o,
        }));
        return (
          <PortalDropdown
            value={row.location ?? null}
            options={options}
            placeholder="请选择地点"
            onSelect={(val) => handleCellChange(row.id, col.key, val)}
          />
        );
      }
      if (col.key === "progress") {
        const options: PortalDropdownOption[] = PROGRESS_OPTIONS.map((o) => ({
          value: o,
          label: o,
        }));
        return (
          <PortalDropdown
            value={row.progress ?? null}
            options={options}
            placeholder="请设置状态"
            dropdownClassName="max-h-[320px] overflow-auto"
            renderBadgeOption
            badgeClassByValue={PROGRESS_BADGE_CLASS}
            onSelect={(val) => handleCellChange(row.id, col.key, val)}
          />
        );
      }
      if (col.key === "application_date") {
        return (
          <InlineDatePicker
            value={row.application_date ?? null}
            placeholder="请选择日期"
            onSelect={(val) => handleCellChange(row.id, col.key, val)}
          />
        );
      }

      if (editingCell?.id === row.id && editingCell?.key === col.key) {
        return (
          <input
            type="text"
            className="w-full h-8 border border-slate-900 dark:border-slate-100 rounded-lg px-2 text-sm font-semibold bg-white dark:bg-slate-800 shadow-sm z-20 outline-none transition-all"
            defaultValue={String(
              (row as unknown as Record<string, unknown>)[col.key] ?? "",
            )}
            onBlur={(e) => {
              const v = e.target.value.trim() || null;
              handleCellChange(row.id, col.key, v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            autoFocus
          />
        );
      }
      if (col.key === "application_link") {
        const val = (row as unknown as Record<string, unknown>)[col.key];
        return val ? (
          <a
            href={val as string}
            target="_blank"
            rel="noopener noreferrer"
            className="h-7 px-2.5 rounded-md bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-900 hover:text-white dark:hover:bg-slate-100 dark:hover:text-slate-900 transition-all inline-flex items-center gap-1.5 text-[11px] font-bold border border-slate-200 dark:border-slate-700 shadow-sm active:scale-95"
            onClick={(e) => e.stopPropagation()}
          >
            前往链接 <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <EmptyEditableCell />
        );
      }
      const val = (row as unknown as Record<string, unknown>)[col.key];
      return (
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 px-1">
          {val != null ? String(val) : <EmptyEditableCell />}
        </span>
      );
    },
    [
      editingCell,
      resumes,
      resumesLoaded,
      resumesLoading,
      ensureResumesLoaded,
      handleCreatePositionOption,
      handleCellChange,
      positionOptions,
      setEditingCell,
    ],
  );

  const handleExportCsv = () => {
    const headers = [
      "公司",
      "投递链接",
      "行业",
      "职位",
      "地点",
      "进展",
      "投递时间",
      "内推码",
      "使用的 PDF",
      "备注",
    ];
    const rows = entries.map((e) => [
      e.company ?? "",
      e.application_link ?? "",
      e.industry ?? "",
      e.position ?? "",
      e.location ?? "",
      e.progress ?? "",
      e.application_date ?? "",
      e.referral_code ?? "",
      resumes.find((r) => r.id === e.resume_id)?.alias ||
        resumes.find((r) => r.id === e.resume_id)?.name ||
        "",
      e.notes ?? "",
    ]);
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `投递进展表_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  async function handleCellChange(
    id: string,
    key: string,
    value: string | string[] | null,
  ) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    setEditingCell(null);
    const optimisticValue = value ?? null;
    setEntries((prev) =>
      prev.map((row) =>
        row.id === id
          ? ({ ...row, [key]: optimisticValue } as ApplicationProgressEntry)
          : row,
      ),
    );

    const payload: ApplicationProgressPayload = {};
    (payload as Record<string, unknown>)[key] = optimisticValue;
    try {
      const updated = await updateApplicationProgress(id, payload);
      setEntries((prev) => prev.map((row) => (row.id === id ? updated : row)));
    } catch (e) {
      console.error(e);
      setEntries((prev) => prev.map((row) => (row.id === id ? entry : row)));
      alert(`更新失败：${extractErrorMessage(e)}`);
    }
  }

  if (!isAuthenticated) {
    return (
      <WorkspaceLayout>
        <div className="h-full flex flex-col items-center justify-center bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400">
          <p>请先登录后使用投递进展表。</p>
        </div>
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout>
      <div className="h-full flex flex-col bg-[#F6F8FC] dark:bg-slate-900">
        {/* 工具栏 */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/80 backdrop-blur-md shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-1.5 mr-2">
            <button
              type="button"
              className="p-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-90"
              title="撤销"
            >
              <Undo2 className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="p-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-90"
              title="重做"
            >
              <Redo2 className="w-5 h-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleInsertRow}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-semibold transition-all active:scale-95 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            插入新行
          </button>

          <button
            type="button"
            onClick={() => setAiImportOpen(true)}
            className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-sm font-bold shadow-md shadow-slate-200 dark:shadow-none transition-all active:scale-95"
          >
            <Wand2 className="w-4.5 h-4.5" />
            AI 智能导入
          </button>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

          <button
            type="button"
            onClick={handlePinSelected}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 text-sm font-semibold transition-all active:scale-95"
          >
            <ArrowUp className="w-4 h-4" />
            置顶选中
          </button>

          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 text-sm font-semibold transition-all active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            删除选中
          </button>

          <div className="flex-1" />

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-semibold transition-all active:scale-95 shadow-sm"
          >
            <Download className="w-4 h-4" />
            导出表格
          </button>
        </div>

        {/* 标题 */}
        <div className="px-8 py-6 bg-white dark:bg-slate-900">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            我的投递进展记录
          </h1>
        </div>

        {/* 表格 */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-12 text-center text-slate-500 font-medium">
              加载中...
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                <table className="w-full border-collapse table-fixed">
                  <thead className="sticky top-0 bg-slate-50/95 dark:bg-slate-800/95 z-10 backdrop-blur-md">
                    <tr>
                      <th className="border-b border-r border-slate-200 dark:border-slate-700 p-0 w-12 text-center">
                        <div className="flex items-center justify-center h-12">
                          <input
                            type="checkbox"
                            checked={
                              entries.length > 0 &&
                              selectedIds.size === entries.length
                            }
                            onChange={toggleSelectAll}
                            className="rounded w-4 h-4 border-slate-300 text-slate-900 focus:ring-slate-500"
                          />
                        </div>
                      </th>
                      <th className="border-b border-r border-slate-200 dark:border-slate-700 p-0 w-10" />
                      {COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          className="border-b border-r border-slate-200 dark:border-slate-700 px-4 h-12 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs"
                          style={{ width: col.width }}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <SortableContext
                    items={entries.map((e) => e.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <tbody>
                      {entries.map((row) => (
                        <SortableTableRow
                          key={row.id}
                          row={row}
                          columns={COLUMNS}
                          resumes={resumes}
                          selectedIds={selectedIds}
                          editingCell={editingCell}
                          onToggleSelect={toggleSelect}
                          onEditingCell={setEditingCell}
                          onCellChange={handleCellChange}
                          renderCell={renderCell}
                        />
                      ))}
                    </tbody>
                  </SortableContext>
                </table>
              </div>
            </DndContext>
          )}
        </div>

        {aiImportOpen && (
          <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/50 backdrop-blur-[3px] px-4">
            <div
              className="w-full max-w-3xl overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]"
              style={{
                fontFamily:
                  "'Space Grotesk','PingFang SC','Noto Sans SC',sans-serif",
              }}
            >
              <div className="relative flex items-center justify-between px-6 py-5 border-b border-slate-100">
                <div className="absolute inset-x-0 top-0 h-1 bg-slate-900 dark:bg-slate-100" />
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                    <Wand2 className="h-5 w-5 text-slate-900 dark:text-slate-100" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      AI 导入投递记录
                    </h3>
                    <p className="text-xs font-medium text-slate-500">
                      支持文字粘贴和截图识别，自动填充表格字段
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
                  onClick={() => {
                    if (aiImportLoading) return;
                    setAiImportOpen(false);
                    setAiImportText("");
                    setAiImportImageDataUrl(null);
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div
                className="px-6 py-5 space-y-4"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 100% 0%, rgba(36,87,255,0.08), transparent 45%)",
                }}
              >
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-slate-50/40 to-white p-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">
                      步骤 1
                    </span>
                    <Keyboard className="w-4 h-4 text-slate-900" />
                    选择导入方式
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm transition-transform hover:-translate-y-0.5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <Type className="w-4 h-4 text-slate-500" />
                        文字粘贴
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        粘贴投递描述：AI 自动识别公司/职位/时间/链接
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-900/10 bg-slate-900/5 px-3 py-3 shadow-sm transition-transform hover:-translate-y-0.5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <ImageIcon className="w-4 h-4" />
                        截图粘贴
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        点击下方输入框后按
                        <span className="ml-1 rounded-md border border-slate-900/20 bg-white px-1.5 py-0.5 font-bold text-slate-900">
                          {pasteShortcutLabel}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        步骤 2
                      </span>
                      粘贴文字或截图
                    </div>
                    <button
                      type="button"
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                      onClick={() =>
                        setAiImportText(
                          "我投递了字节跳动机器审核部门后端开发工程师，时间为今天，链接为https://join.qq.com/",
                        )
                      }
                    >
                      填入示例
                    </button>
                  </div>
                  <textarea
                    value={aiImportText}
                    onChange={(e) => setAiImportText(e.target.value)}
                    onPaste={handleAiImportPasteImage}
                    placeholder={`在这里粘贴文字、或直接按 ${pasteShortcutLabel} 粘贴截图`}
                    className="w-full min-h-[188px] resize-y rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-base leading-7 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                </div>
                {aiImportImageDataUrl && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                        <Check className="h-4 w-4" />
                        已粘贴图片：导入时将优先识别截图内容
                      </span>
                      <button
                        type="button"
                        className="text-xs text-emerald-700 hover:text-emerald-800"
                        onClick={() => setAiImportImageDataUrl(null)}
                      >
                        移除
                      </button>
                    </div>
                    <img
                      src={aiImportImageDataUrl}
                      alt="AI导入截图"
                      className="max-h-44 rounded-lg border border-emerald-200 object-contain bg-white"
                    />
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
                <button
                  type="button"
                  className="h-11 px-5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setAiImportOpen(false);
                    setAiImportText("");
                    setAiImportImageDataUrl(null);
                  }}
                  disabled={aiImportLoading}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="h-11 px-5 rounded-xl bg-slate-900 text-white font-semibold shadow-lg hover:bg-slate-800 disabled:opacity-60 transition-all"
                  onClick={handleAIImport}
                  disabled={
                    aiImportLoading ||
                    (!aiImportText.trim() && !aiImportImageDataUrl)
                  }
                >
                  {aiImportLoading ? "导入中..." : "导入到表格"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </WorkspaceLayout>
  );
}

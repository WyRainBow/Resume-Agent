/**
 * 编辑区三列布局（在 WorkspaceLayout 的基础上）：
 * 第一列：模块选择（窄，约 150px）
 * 第二列：详细编辑面板
 * 第三列：预览面板（可拖拽调整宽度）
 */
import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../../lib/utils";
import EditPanel from "./EditPanel";
import PreviewPanel from "./PreviewPanel";
import ScrollEditMode from "./ScrollEditMode";
import { SidePanel } from "./SidePanel";
import type {
  ResumeData,
  MenuSection,
  GlobalSettings,
  BasicInfo,
  Project,
  Experience,
  Education,
  OpenSource,
  Award,
} from "./types";

type EditMode = "click" | "scroll";

interface EditPreviewLayoutProps {
  editMode: EditMode;
  resumeData: ResumeData;
  activeSection: string;
  setActiveSection: (id: string) => void;
  toggleSectionVisibility: (id: string) => void;
  updateMenuSections: (sections: MenuSection[]) => void;
  reorderSections: (sections: MenuSection[]) => void;
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => void;
  addCustomSection: () => void;
  updateBasicInfo: (info: Partial<BasicInfo>) => void;
  updateProject: (project: Project) => void;
  deleteProject: (id: string) => void;
  reorderProjects: (projects: Project[]) => void;
  updateExperience: (experience: Experience) => void;
  deleteExperience: (id: string) => void;
  reorderExperiences: (experiences: Experience[]) => void;
  updateEducation: (education: Education) => void;
  deleteEducation: (id: string) => void;
  reorderEducations: (educations: Education[]) => void;
  updateOpenSource: (openSource: OpenSource) => void;
  deleteOpenSource: (id: string) => void;
  reorderOpenSources: (openSources: OpenSource[]) => void;
  updateAward: (award: Award) => void;
  deleteAward: (id: string) => void;
  reorderAwards: (awards: Award[]) => void;
  updateSkillContent: (content: string) => void;
  handleAIImport: (section: string) => void;
  pdfBlob: Blob | null;
  loading: boolean;
  progress: string;
  handleRender: () => void;
  handleDownload: () => void;
}

// 拖拽分隔线组件（用 RAF 节流，避免高频 setState 导致抖动）
function DragHandle({
  onDrag,
  onDragStart,
  onDragEnd,
  className,
}: {
  onDrag: (delta: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  className?: string;
}) {
  const isDragging = useRef(false);
  const startX = useRef(0);
  const rafId = useRef(0);
  const pendingDelta = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true;
      startX.current = e.clientX;
      pendingDelta.current = 0;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      onDragStart?.();

      const flush = () => {
        if (pendingDelta.current !== 0) {
          onDrag(pendingDelta.current);
          pendingDelta.current = 0;
        }
      };

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = e.clientX - startX.current;
        startX.current = e.clientX;
        pendingDelta.current += delta;
        cancelAnimationFrame(rafId.current);
        rafId.current = requestAnimationFrame(flush);
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        cancelAnimationFrame(rafId.current);
        flush(); // 确保最后一帧被应用
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        onDragEnd?.();
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [onDrag, onDragStart, onDragEnd],
  );

  return (
    <div
      className={cn(
        "w-1 cursor-ew-resize group relative shrink-0 transition-colors",
        "bg-slate-200 dark:bg-slate-800",
        "hover:bg-slate-400 dark:hover:bg-slate-600",
        "active:bg-slate-500 dark:active:bg-slate-500",
        className,
      )}
      style={{
        cursor: "ew-resize",
        touchAction: "none",
      }}
      onMouseDown={handleMouseDown}
    >
      {/* 扩大可点击区域 */}
      <div className="absolute inset-y-0 -left-2 -right-2 cursor-ew-resize" />
    </div>
  );
}

export default function EditPreviewLayout(props: EditPreviewLayoutProps) {
  const {
    editMode,
    resumeData,
    activeSection,
    setActiveSection,
    toggleSectionVisibility,
    updateMenuSections,
    reorderSections,
    updateGlobalSettings,
    addCustomSection,
    updateBasicInfo,
    updateProject,
    deleteProject,
    reorderProjects,
    updateExperience,
    deleteExperience,
    reorderExperiences,
    updateEducation,
    deleteEducation,
    reorderEducations,
    updateOpenSource,
    deleteOpenSource,
    reorderOpenSources,
    updateAward,
    deleteAward,
    reorderAwards,
    updateSkillContent,
    handleAIImport,
    pdfBlob,
    loading,
    progress,
    handleRender,
    handleDownload,
  } = props;

  // 列宽状态
  const [sidePanelWidth] = useState(300); // 模块选择列宽度（固定）
  const [editPanelWidth, setEditPanelWidth] = useState(700); // 编辑面板宽度（可拖动调整，范围 400-1400px）
  const [isDragging, setIsDragging] = useState(false);

  // 拖拽处理 - 调整编辑面板宽度
  const handleDrag = useCallback((delta: number) => {
    setEditPanelWidth((w) => Math.max(400, Math.min(1400, w + delta)));
  }, []);
  const handleDragStart = useCallback(() => setIsDragging(true), []);
  const handleDragEnd = useCallback(() => setIsDragging(false), []);

  return (
    <div className="h-[calc(100vh-64px)] flex relative z-10 overflow-hidden">
      {/* 内容区域 */}
      <div className="flex-1 flex overflow-hidden">
        <AnimatePresence mode="wait">
          {editMode === "click" ? (
            <motion.div
              key="click-mode"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="flex"
            >
              {/* 点击编辑模式：三列布局 */}
              {/* 第一列：模块选择（窄） */}
              <div
                className={cn(
                  "h-full overflow-y-auto shrink-0",
                  "bg-white/80 dark:bg-slate-900/80",
                  "backdrop-blur-sm border-r border-slate-200 dark:border-slate-800",
                )}
                style={{ width: sidePanelWidth }}
              >
                <SidePanel
                  menuSections={resumeData.menuSections}
                  activeSection={activeSection}
                  globalSettings={resumeData.globalSettings}
                  setActiveSection={setActiveSection}
                  toggleSectionVisibility={toggleSectionVisibility}
                  updateMenuSections={updateMenuSections}
                  reorderSections={reorderSections}
                  updateGlobalSettings={updateGlobalSettings}
                  addCustomSection={addCustomSection}
                />
              </div>

              {/* 分隔线 1 */}
              <div className="w-px bg-slate-200 dark:bg-slate-700 shrink-0" />

              {/* 第二列：编辑面板（固定宽度，拖拽时启用 GPU 合成避免抖动） */}
              <div
                className={cn(
                  "h-full overflow-y-auto shrink-0",
                  "bg-white/80 dark:bg-slate-900/80",
                  "backdrop-blur-sm border-r border-slate-200 dark:border-slate-800",
                )}
                style={{
                  width: editPanelWidth,
                  willChange: isDragging ? "width" : "auto",
                  pointerEvents: isDragging ? "none" : "auto",
                }}
              >
                <EditPanel
                  key={activeSection}
                  activeSection={activeSection}
                  menuSections={resumeData.menuSections}
                  resumeData={resumeData}
                  updateBasicInfo={updateBasicInfo}
                  updateProject={updateProject}
                  deleteProject={deleteProject}
                  reorderProjects={reorderProjects}
                  updateExperience={updateExperience}
                  deleteExperience={deleteExperience}
                  reorderExperiences={reorderExperiences}
                  updateEducation={updateEducation}
                  deleteEducation={deleteEducation}
                  reorderEducations={reorderEducations}
                  updateOpenSource={updateOpenSource}
                  deleteOpenSource={deleteOpenSource}
                  reorderOpenSources={reorderOpenSources}
                  updateAward={updateAward}
                  deleteAward={deleteAward}
                  reorderAwards={reorderAwards}
                  updateSkillContent={updateSkillContent}
                  updateMenuSections={updateMenuSections}
                  updateGlobalSettings={updateGlobalSettings}
                  onAIImport={handleAIImport}
                />
              </div>

              {/* 分隔线 2（可拖拽调整编辑面板宽度） */}
              <DragHandle
                onDrag={handleDrag}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              />
            </motion.div>
          ) : (
            <motion.div
              key="scroll-mode"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="flex"
            >
              {/* 滚动编辑模式：两列布局 */}
              {/* 第一列：滚动编辑区域 */}
              <div
                className={cn(
                  "h-full overflow-hidden shrink-0",
                  "bg-white/80 dark:bg-slate-900/80",
                  "backdrop-blur-sm border-r border-slate-200 dark:border-slate-800",
                )}
                style={{
                  width: editPanelWidth,
                  willChange: isDragging ? "width" : "auto",
                  pointerEvents: isDragging ? "none" : "auto",
                }}
              >
                <ScrollEditMode
                  menuSections={resumeData.menuSections}
                  resumeData={resumeData}
                  updateBasicInfo={updateBasicInfo}
                  updateProject={updateProject}
                  deleteProject={deleteProject}
                  reorderProjects={reorderProjects}
                  updateExperience={updateExperience}
                  deleteExperience={deleteExperience}
                  reorderExperiences={reorderExperiences}
                  updateEducation={updateEducation}
                  deleteEducation={deleteEducation}
                  reorderEducations={reorderEducations}
                  updateOpenSource={updateOpenSource}
                  deleteOpenSource={deleteOpenSource}
                  reorderOpenSources={reorderOpenSources}
                  updateAward={updateAward}
                  deleteAward={deleteAward}
                  reorderAwards={reorderAwards}
                  updateSkillContent={updateSkillContent}
                  updateGlobalSettings={updateGlobalSettings}
                  updateMenuSections={updateMenuSections}
                  handleAIImport={handleAIImport}
                />
              </div>

              {/* 分隔线（可拖拽调整编辑面板宽度） */}
              <DragHandle
                onDrag={handleDrag}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 预览面板（始终显示；拖拽时禁用指针避免 iframe 抢占事件） */}
        <div
          className={cn(
            "h-full overflow-hidden flex-1",
            "bg-slate-100/80 dark:bg-slate-800/80",
            "backdrop-blur-sm",
          )}
          style={{ pointerEvents: isDragging ? "none" : "auto" }}
        >
          <PreviewPanel
            resumeData={resumeData}
            pdfBlob={pdfBlob}
            loading={loading}
            progress={progress}
            onRender={handleRender}
            onDownload={handleDownload}
          />
        </div>
      </div>
    </div>
  );
}

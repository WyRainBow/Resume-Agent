import { useCallback, useState } from "react";
import { renderPDFStream } from "@/services/api";
import { ResumeData } from "@/pages/Workspace/v2/types";
import { ResumePdfPreviewState, EMPTY_RESUME_PDF_STATE } from "@/types/resumePreview";

export { EMPTY_RESUME_PDF_STATE };

export function useResumePreview() {
  const [resumePdfPreview, setResumePdfPreview] = useState<Record<string, ResumePdfPreviewState>>({});

  const updateResumePdfState = useCallback(
    (resumeId: string, state: Partial<ResumePdfPreviewState>) => {
      setResumePdfPreview((prev) => ({
        ...prev,
        [resumeId]: {
          ...(prev[resumeId] || EMPTY_RESUME_PDF_STATE),
          ...state,
        },
      }));
    },
    [],
  );

  const renderResumePdfPreview = useCallback(
    async (resumeEntry: { id: string; resumeData?: ResumeData }) => {
      if (!resumeEntry?.resumeData || !resumeEntry?.id) return;
      const resumeId = resumeEntry.id;

      // 如果已经在加载中，不重复触发
      if (resumePdfPreview[resumeId]?.loading) return;
      // 如果已经有预览且没有强制刷新的需求，也可以跳过（这里暂时每次都刷）

      updateResumePdfState(resumeId, {
        loading: true,
        progress: "正在生成 PDF 预览...",
        error: null,
      });

      try {
        let pdfBlob: Blob | null = null;
        await renderPDFStream(resumeEntry.resumeData, {
          onProgress: (msg) => updateResumePdfState(resumeId, { progress: msg }),
          onComplete: (blob) => { pdfBlob = blob; },
          onError: (err) => { throw err; },
        });

        if (pdfBlob) {
          updateResumePdfState(resumeId, {
            blob: pdfBlob,
            loading: false,
            progress: "",
            error: null,
          });
        }
      } catch (err) {
        console.error("[ResumePreview] PDF 渲染失败:", err);
        updateResumePdfState(resumeId, {
          blob: null,
          loading: false,
          progress: "",
          error: err instanceof Error ? err.message : "PDF 渲染失败",
        });
      }
    },
    [resumePdfPreview, updateResumePdfState],
  );

  return {
    resumePdfPreview,
    setResumePdfPreview,
    updateResumePdfState,
    renderResumePdfPreview,
    EMPTY_RESUME_PDF_STATE,
  };
}

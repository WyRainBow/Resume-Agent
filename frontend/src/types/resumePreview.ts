/**
 * Resume PDF Preview State
 */
export interface ResumePdfPreviewState {
  blob: Blob | null;
  loading: boolean;
  progress: string;
  error: string | null;
}

export const EMPTY_RESUME_PDF_STATE: ResumePdfPreviewState = {
  blob: null,
  loading: false,
  progress: "",
  error: null,
};

/**
 * Loaded Resume Entry
 */
export interface LoadedResume {
  id: string;
  name: string;
  messageId: string;
  resumeData?: import('@/pages/Workspace/v2/types').ResumeData;
}

/**
 * Resume PDF Preview State (for PDF rendering with blob)
 */
export interface ResumePdfPreviewStateWithBlob extends ResumePdfPreviewState {
  blob: Blob;
}

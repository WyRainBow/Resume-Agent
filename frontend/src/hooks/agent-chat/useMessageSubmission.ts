import { useCallback } from "react";
import { Message } from "@/types/chat";
import { ResumeData } from "@/pages/Workspace/v2/types";

// Re-using types from SophiaChat or defining them here if needed
interface ResumePdfPreviewState {
  blob: Blob | null;
  loading: boolean;
  progress: string;
  error: string | null;
}

interface UseMessageSubmissionProps {
  apiBaseUrl: string;
  user: any;
  isProcessing: boolean;
  isUploadingFile: boolean;
  setIsUploadingFile: (loading: boolean) => void;
  pendingAttachments: File[];
  setPendingAttachments: (files: File[]) => void;
  setResumeError: (error: string | null) => void;
  setResumeData: (data: ResumeData | null) => void;
  setLoadedResumes: React.Dispatch<React.SetStateAction<any[]>>;
  setSelectedResumeId: (id: string | null) => void;
  setAllowPdfAutoRender: (allow: boolean) => void;
  updateResumePdfState: (id: string, state: Partial<ResumePdfPreviewState>) => void;
  sendUserTextMessage: (
    text: string,
    attachments?: File[],
    resumeData?: ResumeData | null,
  ) => Promise<void>;
  normalizeImportedResumeToCanonical: (
    source: Record<string, any>,
    opts: { resumeId: string; title: string },
  ) => ResumeData;
  saveResume: (data: ResumeData, id: string) => Promise<any>;
}

export function useMessageSubmission({
  apiBaseUrl,
  user,
  isProcessing,
  isUploadingFile,
  setIsUploadingFile,
  pendingAttachments,
  setPendingAttachments,
  setResumeError,
  setResumeData,
  setLoadedResumes,
  setSelectedResumeId,
  setAllowPdfAutoRender,
  updateResumePdfState,
  sendUserTextMessage,
  normalizeImportedResumeToCanonical,
  saveResume,
}: UseMessageSubmissionProps) {
  const handleSubmit = useCallback(
    async (e: React.FormEvent, input: string, setInput: (val: string) => void) => {
      e.preventDefault();
      const trimmedInput = input.trim();
      const hasAttachments = pendingAttachments.length > 0;
      if ((!trimmedInput && !hasAttachments) || isProcessing || isUploadingFile)
        return;

      // 每轮新消息开始前清理可能残留的状态
      setResumeError(null);

      const userMessage = trimmedInput;
      const attachmentsToProcess = [...pendingAttachments];
      setInput("");
      setPendingAttachments([]);

      try {
        if (!hasAttachments) {
          await sendUserTextMessage(userMessage);
          return;
        }

        setIsUploadingFile(true);
        const attachmentBlocks: string[] = [];
        let latestResumeDataForRequest: ResumeData | null = null;

        for (const file of attachmentsToProcess) {
          const isPdf =
            file.type === "application/pdf" ||
            file.name.toLowerCase().endsWith(".pdf");
          if (isPdf) {
            const resumeEntryId = `uploaded-pdf-${file.lastModified}-${file.size}`;
            const resumeDisplayName =
              file.name.replace(/\.pdf$/i, "") || "上传简历";
            const uploadMessageId = `upload-pdf-${file.lastModified}-${file.size}`;

            // 1) 先本地预览：不等待后端解析完成
            setLoadedResumes((prev) => {
              const nextEntry = {
                id: resumeEntryId,
                name: resumeDisplayName,
                messageId: uploadMessageId,
              };
              const existingIndex = prev.findIndex(
                (item) => item.id === resumeEntryId,
              );
              if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = {
                  ...updated[existingIndex],
                  ...nextEntry,
                };
                return updated;
              }
              return [...prev, nextEntry];
            });
            updateResumePdfState(resumeEntryId, {
              blob: file,
              loading: true,
              progress: "已加载原始 PDF，正在解析简历内容...",
              error: null,
            });
            setAllowPdfAutoRender(true);
            setSelectedResumeId(resumeEntryId);

            // 2) 后台继续上传与结构化解析
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch(`${apiBaseUrl}/api/resume/upload-pdf`, {
              method: "POST",
              body: formData,
            });
            if (!response.ok) {
              throw new Error(`PDF 解析失败: ${response.status}`);
            }

            const data = await response.json();
            const parsedResume = data?.resume;
            if (parsedResume && typeof parsedResume === "object") {
              const resolvedUserId = user?.id ?? null;
              const canonical = normalizeImportedResumeToCanonical(
                parsedResume as Record<string, any>,
                {
                  resumeId: resumeEntryId,
                  title: resumeDisplayName,
                },
              );
              const resumeDataWithMeta = {
                ...canonical,
                user_id: resolvedUserId,
                resume_id: resumeEntryId,
                _meta: {
                  ...(canonical as any)._meta,
                  user_id: resolvedUserId,
                  resume_id: resumeEntryId,
                },
              } as ResumeData;
              latestResumeDataForRequest = resumeDataWithMeta;
              setResumeData(resumeDataWithMeta);
              // 上传成功后尝试持久化到简历存储（登录态会入库，未登录回落本地）
              try {
                await saveResume(resumeDataWithMeta, resumeEntryId);
              } catch (saveError) {
                console.warn("[AgentChat] 上传简历保存失败:", saveError);
              }
              setLoadedResumes((prev) => {
                const nextEntry = {
                  id: resumeEntryId,
                  name: resumeDisplayName,
                  messageId: uploadMessageId,
                  resumeData: resumeDataWithMeta,
                };
                const existingIndex = prev.findIndex(
                  (item) => item.id === resumeEntryId,
                );
                if (existingIndex >= 0) {
                  const updated = [...prev];
                  updated[existingIndex] = nextEntry;
                  return updated;
                }
                return [...prev, nextEntry];
              });
              updateResumePdfState(resumeEntryId, {
                loading: false,
                progress: "",
                error: null,
              });
              attachmentBlocks.push(
                `已上传并解析 PDF 文件《${file.name}》。请基于这份简历内容进行分析并给出优化建议。`,
              );
            } else {
              updateResumePdfState(resumeEntryId, {
                loading: false,
                progress: "",
                error: "未解析出结构化简历内容，当前展示原始 PDF。",
              });
              attachmentBlocks.push(
                `已上传 PDF 文件《${file.name}》，但未解析出结构化简历内容。`,
              );
            }
            continue;
          }

          const isTextLike =
            file.type.startsWith("text/") ||
            /\.(txt|md|json|csv)$/i.test(file.name);
          if (!isTextLike) {
            throw new Error("仅支持 pdf/txt/md/json/csv 文件");
          }

          const rawText = await file.text();
          const maxLen = 12000;
          const clipped = rawText.slice(0, maxLen);
          const truncatedNote =
            rawText.length > maxLen
              ? "\n[文件内容过长，已截断为前 12000 字符]"
              : "";
          attachmentBlocks.push(
            `文件《${file.name}》内容：\n${clipped}${truncatedNote}`,
          );
        }

        const baseMessage =
          userMessage || "我上传了附件，请先提炼关键信息并给出下一步建议。";
        const finalMessage = attachmentBlocks.length
          ? `${baseMessage}\n\n${attachmentBlocks.join("\n\n")}`
          : baseMessage;
        await sendUserTextMessage(
          finalMessage,
          attachmentsToProcess,
          latestResumeDataForRequest,
        );
      } catch (error) {
        console.error("[AgentChat] Failed to send message:", error);
        setPendingAttachments(attachmentsToProcess);
        setResumeError(
          error instanceof Error ? error.message : "文件上传失败，请稍后重试",
        );
      } finally {
        setIsUploadingFile(false);
      }
    },
    [
      apiBaseUrl,
      isProcessing,
      isUploadingFile,
      normalizeImportedResumeToCanonical,
      pendingAttachments,
      saveResume,
      sendUserTextMessage,
      setAllowPdfAutoRender,
      setLoadedResumes,
      setPendingAttachments,
      setResumeData,
      setResumeError,
      setSelectedResumeId,
      setIsUploadingFile,
      updateResumePdfState,
      user,
    ],
  );

  return { handleSubmit };
}

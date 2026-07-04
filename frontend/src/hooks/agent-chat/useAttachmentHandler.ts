import { useCallback, useState } from "react";
import { toast } from '@/lib/toast'

export function useAttachmentHandler(isProcessing: boolean) {
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const handleUploadFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? []);
      if (selectedFiles.length === 0) return;
      if (isProcessing) {
        toast.error("当前正在处理消息，请稍后再上传。");
        event.target.value = "";
        return;
      }

      setPendingAttachments((prev) => {
        const existingKeys = new Set(
          prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`),
        );
        const unique = selectedFiles.filter((file) => {
          const key = `${file.name}-${file.size}-${file.lastModified}`;
          return !existingKeys.has(key);
        });
        return [...prev, ...unique];
      });
      event.target.value = "";
    },
    [isProcessing],
  );

  const handleRemoveAttachment = useCallback((target: File) => {
    const targetKey = `${target.name}-${target.size}-${target.lastModified}`;
    setPendingAttachments((prev) =>
      prev.filter(
        (file) =>
          `${file.name}-${file.size}-${file.lastModified}` !== targetKey,
      ),
    );
  }, []);

  const clearAttachments = useCallback(() => {
    setPendingAttachments([]);
  }, []);

  return {
    pendingAttachments,
    setPendingAttachments,
    isUploadingFile,
    setIsUploadingFile,
    handleUploadFile,
    handleRemoveAttachment,
    clearAttachments,
  };
}

import { useCallback } from 'react';
import { getAllResumes, getResume } from '@/services/resumeStorage';
import { ResumeData } from '@/pages/Workspace/v2/types';

interface LoadedResume {
  id: string;
  name: string;
  messageId: string;
  resumeData?: ResumeData;
}

interface UseResumeDetectionProps {
  user: { id: string } | null;
  loadedResumes: LoadedResume[];
  setLoadedResumes: React.Dispatch<React.SetStateAction<LoadedResume[]>>;
}

export function useResumeDetection({
  user,
  loadedResumes,
  setLoadedResumes,
}: UseResumeDetectionProps) {
  const detectAndLoadResume = useCallback(
    async (input: string, messageId: string) => {
      // 检查是否已经为这条消息加载过简历
      if (loadedResumes.some((r) => r.messageId === messageId)) {
        return;
      }

      // 检测简历加载的关键词
      const resumeLoadPatterns = [
        /(?:加载|打开|查看|显示)(?:我的|这个|一份)?(?:简历|CV)/,
        /(?:简历|CV)(?:名称|ID)?[:：]\s*([^\n]+)/,
      ];

      let resumeIdOrName: string | null = null;
      for (const pattern of resumeLoadPatterns) {
        const match = input.match(pattern);
        if (match) {
          if (match[1]) {
            // 提取了简历名称或ID
            resumeIdOrName = match[1].trim();
          } else {
            // 只是检测到关键词，没有具体名称
            resumeIdOrName = "";
          }
          break;
        }
      }

      // 如果没有检测到关键词，直接返回
      if (resumeIdOrName === null) {
        return;
      }

      try {
        let resume: any = null;
        let resumeName = "";

        if (resumeIdOrName === "") {
          // 没有指定具体简历，尝试获取用户的第一份简历
          const allResumes = await getAllResumes();
          if (allResumes.length > 0) {
            resume = allResumes[0];
            resumeName = resume.name || "我的简历";
          } else {
            console.log("[AgentChat] 用户没有简历");
            return;
          }
        } else {
          // 尝试通过ID或名称查找简历
          const allResumes = await getAllResumes();
          resume = allResumes.find(
            (r) => r.id === resumeIdOrName || r.name === resumeIdOrName,
          );

          if (!resume) {
            // 如果找不到，尝试直接通过ID获取
            resume = await getResume(resumeIdOrName);
          }

          if (resume) {
            resumeName = resume.name || resumeIdOrName;
          } else {
            console.log("[AgentChat] 未找到简历:", resumeIdOrName);
            return;
          }
        }

        if (resume) {
          const resolvedUserId = user?.id ?? (resume as any).user_id ?? null;
          const resumeDataWithMeta = {
            ...(resume.data || {}),
            resume_id: resume.id,
            user_id: resolvedUserId,
            alias: resume.alias,
            _meta: {
              resume_id: resume.id,
              user_id: resolvedUserId,
            },
          };

          // 添加到加载的简历列表
          setLoadedResumes((prev) => [
            ...prev,
            {
              id: resume.id,
              name: resumeName,
              messageId,
              resumeData: resumeDataWithMeta as ResumeData,
            },
          ]);

          console.log("[AgentChat] 检测到简历加载:", resume.id, resumeName);
        }
      } catch (err) {
        console.error("[AgentChat] 加载简历失败:", err);
      }
    },
    [loadedResumes, user?.id, setLoadedResumes],
  );

  return { detectAndLoadResume };
}

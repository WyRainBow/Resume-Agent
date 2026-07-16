import { useState } from "react";

import DiagnosisToolCards from "@/components/agent-chat/DiagnosisToolCards";
import {
  StructuredCards,
  type StructuredEventData,
} from "@/components/agent-chat/StructuredCardRegistry";
import type { ConversationRunState } from "@/agent-presentation/model";
import { isResumeDiagnosisStructuredData } from "@/types/resumeDiagnosis";
import SearchCard from "@/components/chat/SearchCard";
import SearchSummary from "@/components/chat/SearchSummary";
import ResumeEditDiffCard from "@/components/chat/ResumeEditDiffCard";
import ResumeCard from "@/components/chat/ResumeCard";
import { ResumeGeneratedCard } from "@/components/agent-chat/ResumeGeneratedCard";
import {
  ApplyAllPatchesBar,
  ResumeDiffCard,
} from "@/components/agent-chat/ResumeDiffCard";
import {
  type PendingPatch,
  useOptionalResumeContext,
} from "@/contexts/ResumeContext";
import { formatResumeDiffPreview } from "@/utils/resumePatch";
import type { ResumeData } from "@/pages/Workspace/v2/types";

import type { ConversationAction } from "./ConversationTurnView";
import type { AskQuestionContextValue } from "./AskQuestionContext";

const MIGRATING_LEGACY_KINDS = new Set([
  "legacy_placeholder",
  "resume_reference",
]);

const PATCH_STATUSES = new Set([
  "pending",
  "applied",
  "rejected",
  "superseded",
]);

function toPendingPatch(
  payload: Record<string, unknown>,
): PendingPatch | null {
  if (typeof payload.patch_id !== "string" || !payload.patch_id) return null;
  return {
    patch_id: payload.patch_id,
    message_id:
      typeof payload.message_id === "string" ? payload.message_id : "current",
    paths: Array.isArray(payload.paths)
      ? payload.paths.filter((path): path is string => typeof path === "string")
      : [],
    before:
      payload.before && typeof payload.before === "object"
        ? (payload.before as Record<string, unknown>)
        : {},
    after:
      payload.after && typeof payload.after === "object"
        ? (payload.after as Record<string, unknown>)
        : {},
    summary: typeof payload.summary === "string" ? payload.summary : "简历修改建议",
    operation:
      payload.operation === "append" ||
      payload.operation === "remove" ||
      payload.operation === "set"
        ? payload.operation
        : "set",
    status:
      typeof payload.status === "string" && PATCH_STATUSES.has(payload.status)
        ? (payload.status as PendingPatch["status"])
        : "pending",
  };
}

interface ConversationArtifactStackProps {
  artifacts: ConversationRunState["artifacts"];
  onAction(action: ConversationAction): void;
  askQuestionHandler?: AskQuestionContextValue;
  useLivePatchState?: boolean;
  className?: string;
}

export default function ConversationArtifactStack({
  artifacts,
  onAction,
  askQuestionHandler,
  useLivePatchState = false,
  className = "",
}: ConversationArtifactStackProps) {
  const resumeContext = useOptionalResumeContext();
  const [dismissedArtifactIds, setDismissedArtifactIds] = useState<Set<string>>(
    () => new Set(),
  );
  const diagnosisItems = artifacts
    .map((artifact) => artifact.payload)
    .filter(isResumeDiagnosisStructuredData);
  const searchItems = artifacts.flatMap((artifact) => {
    if (!new Set(["search", "search_result"]).has(artifact.kind)) return [];
    const payload = artifact.payload;
    if (
      typeof payload.query !== "string" ||
      !Array.isArray(payload.results)
    ) {
      return [];
    }
    return [payload];
  });
  const editDiffItems = artifacts.flatMap((artifact) => {
    if (artifact.kind !== "resume_edit_diff") return [];
    const before = formatResumeDiffPreview(artifact.payload.before);
    const after = formatResumeDiffPreview(artifact.payload.after);
    return before || after ? [{ before, after }] : [];
  });
  const patchItems = Array.from(
    artifacts
      .filter((artifact) => artifact.kind === "resume_patch")
      .reduce((items, artifact) => {
        const fallback = toPendingPatch(artifact.payload);
        if (!fallback) return items;
        const current = useLivePatchState
          ? resumeContext?.pendingPatches.find(
              (patch) => patch.patch_id === fallback.patch_id,
            )
          : undefined;
        items.set(fallback.patch_id, current ?? fallback);
        return items;
      }, new Map<string, PendingPatch>())
      .values(),
  );
  const resumeReferences = artifacts.flatMap((artifact) => {
    if (artifact.kind !== "resume_reference") return [];
    const resume =
      artifact.payload.resume && typeof artifact.payload.resume === "object"
        ? (artifact.payload.resume as Record<string, unknown>)
        : artifact.payload;
    const id = typeof resume.id === "string" ? resume.id : "";
    const name =
      typeof resume.name === "string" && resume.name.trim()
        ? resume.name.trim()
        : "已加载简历";
    return id ? [{ id, name, payload: artifact.payload }] : [];
  });
  const generatedResumes = artifacts.flatMap((artifact) => {
    if (
      artifact.kind !== "resume_generated" ||
      dismissedArtifactIds.has(artifact.artifactId) ||
      !artifact.payload.resume ||
      typeof artifact.payload.resume !== "object"
    ) {
      return [];
    }
    return [
      {
        artifactId: artifact.artifactId,
        resume: artifact.payload.resume as ResumeData,
        summary:
          typeof artifact.payload.summary === "string"
            ? artifact.payload.summary
            : "已生成简历",
      },
    ];
  });
  const structuredItems = artifacts.flatMap((artifact) => {
    if (
      artifact.kind === "resume_diagnosis" ||
      artifact.kind === "resume_generated" ||
      MIGRATING_LEGACY_KINDS.has(artifact.kind)
    ) {
      return [];
    }
    const payload = artifact.payload;
    const type =
      typeof payload.type === "string" && payload.type.trim()
        ? payload.type
        : artifact.kind;
    return [{ ...payload, type } as StructuredEventData];
  });

  if (
    diagnosisItems.length === 0 &&
    searchItems.length === 0 &&
    editDiffItems.length === 0 &&
    patchItems.length === 0 &&
    resumeReferences.length === 0 &&
    generatedResumes.length === 0 &&
    structuredItems.length === 0
  ) {
    return null;
  }
  return (
    <div className={className}>
      {diagnosisItems.length > 0 && (
        <DiagnosisToolCards
          items={diagnosisItems}
          className="mb-4 mt-2"
          onActionClick={(message) =>
            onAction({ type: "send_message", message })
          }
        />
      )}
      {searchItems.map((item, index) => {
        const metadata =
          item.metadata && typeof item.metadata === "object"
            ? (item.metadata as Record<string, unknown>)
            : {};
        const totalResults =
          typeof item.total_results === "number"
            ? item.total_results
            : item.results.length;
        const searchTime =
          typeof metadata.search_time === "string" ||
          typeof metadata.search_time === "number"
            ? metadata.search_time
            : undefined;
        return (
          <div key={`search-${item.query}-${index}`} className="my-4">
            <SearchCard
              query={item.query}
              totalResults={totalResults}
              searchTime={searchTime}
              onOpen={() => onAction({ type: "search.open", data: item })}
            />
            <SearchSummary
              query={item.query}
              results={item.results}
              searchTime={searchTime}
            />
          </div>
        );
      })}
      {editDiffItems.map((item, index) => (
        <ResumeEditDiffCard
          key={`resume-edit-diff-${index}`}
          before={item.before || ""}
          after={item.after || ""}
        />
      ))}
      {resumeContext && patchItems.length > 0 && (
        <div className="mb-4 space-y-2">
          <ApplyAllPatchesBar patches={patchItems} />
          {patchItems.map((patch) => (
            <ResumeDiffCard
              key={patch.patch_id}
              patch={patch}
              defaultCollapsed={
                patchItems.filter((item) => item.status === "pending").length >= 2
              }
            />
          ))}
        </div>
      )}
      {resumeReferences.map((resume) => (
        <div key={`resume-reference-${resume.id}`} className="my-4">
          <ResumeCard
            resumeId={resume.id}
            title={resume.name}
            subtitle="已加载简历"
            onClick={() =>
              onAction({ type: "resume.open", data: resume.payload })
            }
            onChangeResume={() => onAction({ type: "resume.selector.open" })}
          />
        </div>
      ))}
      {resumeContext &&
        generatedResumes.map((item) => (
          <ResumeGeneratedCard
            key={item.artifactId}
            resume={item.resume}
            summary={item.summary}
            onDismiss={() =>
              setDismissedArtifactIds((previous) => {
                const next = new Set(previous);
                next.add(item.artifactId);
                return next;
              })
            }
          />
        ))}
      {structuredItems.length > 0 && (
        <StructuredCards
          items={structuredItems}
          className="mb-4 mt-2"
          askQuestionHandler={askQuestionHandler}
          onAction={(message) => onAction({ type: "send_message", message })}
        />
      )}
    </div>
  );
}

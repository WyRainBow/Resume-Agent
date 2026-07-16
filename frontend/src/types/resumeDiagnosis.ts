export interface DiagnosisDimension {
  score: number;
  description: string;
  action_label: string;
  action_message: string;
}

export interface DiagnosisAction {
  label: string;
  message: string;
  primary?: boolean;
  action_id?: string;
  intent?: "view_suggestions" | "optimize_for_job" | "view_interview_risks";
  artifact_id?: string;
  assessment_id?: string;
  suggestion_id?: string;
  message_fallback?: string;
}

export interface DiagnosisStep {
  label: string;
  status: string;
  summary: string;
}

export type ResumeSuggestionSeverity = "critical" | "warning" | "suggestion";
export type ResumeSuggestionStatus = "proposed" | "needs_fact";
export type ResumeDiagnosisSource = "llm" | "heuristic_fallback";

export interface ResumeSuggestion {
  suggestion_id: string;
  assessment_id: string;
  section: string;
  severity: ResumeSuggestionSeverity;
  title: string;
  original: string;
  recommendation: string;
  proposed?: string;
  evidence: string;
  requires_facts: string[];
  status: ResumeSuggestionStatus;
  resume_ref?: {
    id?: string;
    revision: string;
  };
}

export interface ResumeArtifactEnvelope<TPayload> {
  schema_version: string;
  artifact_id: string;
  kind: "resume_diagnosis" | "resume_suggestions";
  resume_ref?: { id?: string; revision: string };
  source?: { skill: string; assessment_id?: string };
  payload: TPayload;
}

export interface ResumeDetailStructuredData {
  type: "resume_detail";
  status?: string;
  tool?: string;
  resume?: {
    id?: string;
    name?: string;
    updated_at?: string;
    language?: string;
  };
}

export interface ResumeDiagnosisStructuredData {
  type: "resume_diagnosis";
  schema_version?: string;
  assessment_id?: string;
  artifact_id?: string;
  kind?: "resume_diagnosis";
  source?: { skill: string; assessment_id?: string };
  resume_ref?: {
    id: string;
    revision: string;
  };
  status: string;
  tool: string;
  resume: {
    id: string;
    name: string;
    updated_at: string;
    language: string;
  };
  summary: {
    overall_score: number;
    screening_score: number;
    content_score: number;
    quality_score: number;
    interview_score: number;
    competitiveness_score: number;
    matching_score: number;
  };
  details: {
    overall_evaluation: string;
    strengths: string[];
    issues: {
      must_fix: string[];
      should_fix: string[];
      optional: string[];
    };
    dimensions: {
      content: DiagnosisDimension;
      interview: DiagnosisDimension;
      matching: DiagnosisDimension;
    };
    analysis_steps: DiagnosisStep[];
    public_trace?: string[];
    diagnosis_source?: ResumeDiagnosisSource;
    suggestions?: ResumeSuggestion[];
    suggestions_artifact?: ResumeArtifactEnvelope<{
      assessment_id: string;
      suggestions: ResumeSuggestion[];
    }>;
    actions: DiagnosisAction[];
    top_actions: string[];
    next_steps: string[];
  };
}

export type DiagnosisToolStructuredData =
  | ResumeDetailStructuredData
  | ResumeDiagnosisStructuredData;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isDimension(value: unknown): value is DiagnosisDimension {
  return (
    isRecord(value) &&
    isFiniteNumber(value.score) &&
    typeof value.description === "string" &&
    typeof value.action_label === "string" &&
    typeof value.action_message === "string"
  );
}

function isStep(value: unknown): value is DiagnosisStep {
  return (
    isRecord(value) &&
    typeof value.label === "string" &&
    typeof value.status === "string" &&
    typeof value.summary === "string"
  );
}

function isAction(value: unknown): value is DiagnosisAction {
  return (
    isRecord(value) &&
    typeof value.label === "string" &&
    typeof value.message === "string" &&
    (value.primary === undefined || typeof value.primary === "boolean") &&
    (value.action_id === undefined || typeof value.action_id === "string") &&
    (value.artifact_id === undefined || typeof value.artifact_id === "string") &&
    (value.assessment_id === undefined || typeof value.assessment_id === "string") &&
    (value.message_fallback === undefined || typeof value.message_fallback === "string")
  );
}

function isSuggestion(value: unknown): value is ResumeSuggestion {
  if (!isRecord(value)) return false;
  return (
    typeof value.suggestion_id === "string" &&
    typeof value.assessment_id === "string" &&
    typeof value.section === "string" &&
    ["critical", "warning", "suggestion"].includes(String(value.severity)) &&
    typeof value.title === "string" &&
    typeof value.original === "string" &&
    typeof value.recommendation === "string" &&
    (value.proposed === undefined || typeof value.proposed === "string") &&
    typeof value.evidence === "string" &&
    isStringArray(value.requires_facts) &&
    ["proposed", "needs_fact"].includes(String(value.status)) &&
    (value.resume_ref === undefined ||
      (isRecord(value.resume_ref) && typeof value.resume_ref.revision === "string"))
  );
}

function isSuggestionsArtifact(value: unknown): boolean {
  if (!isRecord(value) || value.kind !== "resume_suggestions") return false;
  if (
    typeof value.schema_version !== "string" ||
    typeof value.artifact_id !== "string" ||
    !isRecord(value.payload) ||
    typeof value.payload.assessment_id !== "string" ||
    !Array.isArray(value.payload.suggestions) ||
    !value.payload.suggestions.every(isSuggestion)
  ) {
    return false;
  }
  return true;
}

export function isResumeDiagnosisStructuredData(
  value: unknown,
): value is ResumeDiagnosisStructuredData {
  if (!isRecord(value) || value.type !== "resume_diagnosis") return false;
  const resume = value.resume;
  const summary = value.summary;
  const details = value.details;
  if (!isRecord(resume) || !isRecord(summary) || !isRecord(details)) return false;
  if (
    typeof value.status !== "string" ||
    typeof value.tool !== "string" ||
    typeof resume.id !== "string" ||
    typeof resume.name !== "string" ||
    typeof resume.updated_at !== "string" ||
    typeof resume.language !== "string"
  ) {
    return false;
  }
  if (
    ![
      summary.overall_score,
      summary.screening_score,
      summary.content_score,
      summary.quality_score,
      summary.interview_score,
      summary.competitiveness_score,
      summary.matching_score,
    ].every(isFiniteNumber)
  ) {
    return false;
  }
  const issues = details.issues;
  const dimensions = details.dimensions;
  if (!isRecord(issues) || !isRecord(dimensions)) return false;
  const suggestions = details.suggestions;
  const suggestionsArtifact = details.suggestions_artifact;
  if (
    suggestions !== undefined &&
    (!Array.isArray(suggestions) || !suggestions.every(isSuggestion))
  ) {
    return false;
  }
  if (
    suggestionsArtifact !== undefined &&
    !isSuggestionsArtifact(suggestionsArtifact)
  ) {
    return false;
  }
  if (
    Array.isArray(suggestions) &&
    isRecord(suggestionsArtifact) &&
    isRecord(suggestionsArtifact.payload) &&
    JSON.stringify(suggestions) !==
      JSON.stringify(suggestionsArtifact.payload.suggestions)
  ) {
    return false;
  }
  if (
    typeof value.assessment_id === "string" &&
    Array.isArray(suggestions) &&
    suggestions.some((item) => item.assessment_id !== value.assessment_id)
  ) {
    return false;
  }
  return (
    typeof details.overall_evaluation === "string" &&
    isStringArray(details.strengths) &&
    isStringArray(issues.must_fix) &&
    isStringArray(issues.should_fix) &&
    isStringArray(issues.optional) &&
    isDimension(dimensions.content) &&
    isDimension(dimensions.interview) &&
    isDimension(dimensions.matching) &&
    Array.isArray(details.analysis_steps) &&
    details.analysis_steps.every(isStep) &&
    (details.public_trace === undefined || isStringArray(details.public_trace)) &&
    (details.diagnosis_source === undefined ||
      ["llm", "heuristic_fallback"].includes(details.diagnosis_source as string)) &&
    Array.isArray(details.actions) &&
    details.actions.every(isAction) &&
    isStringArray(details.top_actions) &&
    isStringArray(details.next_steps)
  );
}

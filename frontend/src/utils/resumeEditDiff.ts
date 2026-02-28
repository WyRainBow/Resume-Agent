const BEFORE_LABEL = /(?:^|\n)\s*修改前\s*[:：]?/im;
const AFTER_LABEL = /(?:^|\n)\s*修改后\s*[:：]?/im;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripMarkdownMarkers(value: string): string {
  return value
    .replace(/```[a-zA-Z]*\n?/g, "")
    .replace(/```/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function findLabelPosition(
  content: string,
  label: RegExp,
  fromIndex = 0,
): { index: number; length: number } | null {
  const matcher = new RegExp(label.source, label.flags.replace("g", ""));
  const sliced = content.slice(fromIndex);
  const match = matcher.exec(sliced);
  if (!match) return null;
  return {
    index: fromIndex + match.index,
    length: match[0].length,
  };
}

function normalizeDiffSegment(raw: string): string {
  let value = String(raw || "").replace(/\r\n/g, "\n").trim();
  if (!value) return "";

  if (/^\s*`{1,3}/.test(value)) {
    value = value.replace(/^\s*`{1,3}[^\n]*\n?/, "");
    const closingIndex = value.search(/\n`{1,3}\s*(?:\n|$)/);
    if (closingIndex >= 0) {
      value = value.slice(0, closingIndex);
    }
  }

  value = value.replace(/^\s*text\s*\n/i, "");
  value = value.replace(/^\s*[:：]\s*/, "");
  value = value.replace(/\n?\s*`{1,3}\s*$/, "");
  return value.trim();
}

export function extractResumeEditDiff(content: string): {
  before: string;
  after: string;
} | null {
  if (!content) return null;

  const beforePos = findLabelPosition(content, BEFORE_LABEL);
  if (!beforePos) return null;
  const afterPos = findLabelPosition(
    content,
    AFTER_LABEL,
    beforePos.index + beforePos.length,
  );
  if (!afterPos) return null;

  const beforeRaw = content.slice(
    beforePos.index + beforePos.length,
    afterPos.index,
  );
  const afterRaw = content.slice(afterPos.index + afterPos.length);
  const before = normalizeDiffSegment(beforeRaw);
  const after = normalizeDiffSegment(afterRaw);

  if (!before && !after) return null;
  return { before, after };
}

export function stripResumeEditMarkdown(content: string): string {
  if (!content) return "";
  const beforePos = findLabelPosition(content, BEFORE_LABEL);
  if (!beforePos) return content.trim();
  return content
    .slice(0, beforePos.index)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function looksLikeHtml(value: string): boolean {
  return /<([a-z][^/>]*?)>/i.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toInlineHtml(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function markdownishTextToHtml(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    blocks.push(
      `<ul class="custom-list">${bulletBuffer
        .map((item) => `<li><p>${toInlineHtml(item)}</p></li>`)
        .join("")}</ul>`,
    );
    bulletBuffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushBullets();
      continue;
    }

    const bulletMatch = trimmed.match(/^([-*•]|\d+[.)])\s+(.+)$/);
    if (bulletMatch) {
      bulletBuffer.push(bulletMatch[2].trim());
      continue;
    }

    flushBullets();
    const titleLine = trimmed.match(/^([^:：]{1,40})[:：]\s*(.+)$/);
    if (titleLine) {
      blocks.push(
        `<p><strong>${toInlineHtml(titleLine[1].trim())}：</strong>${toInlineHtml(
          titleLine[2].trim(),
        )}</p>`,
      );
      continue;
    }
    blocks.push(`<p>${toInlineHtml(trimmed)}</p>`);
  }

  flushBullets();
  if (blocks.length === 0) return "";
  return `${blocks.join("")}<p></p>`;
}

function htmlToReadableText(value: string): string {
  if (!value) return "";
  const withLines = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/ul>|<\/ol>/gi, "\n")
    .replace(/<strong[^>]*>/gi, "")
    .replace(/<\/strong>/gi, "")
    .replace(/<b[^>]*>/gi, "")
    .replace(/<\/b>/gi, "");

  const stripped = withLines.replace(/<[^>]+>/g, " ");
  const decoded = decodeHtmlEntities(stripped)
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const dedupedLines: string[] = [];
  for (const line of decoded.split("\n")) {
    const current = line.trim();
    if (!current) continue;
    if (dedupedLines[dedupedLines.length - 1] === current) continue;
    dedupedLines.push(current);
  }
  return dedupedLines.join("\n");
}

function compactProgressiveLines(raw: string): string {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) return lines.join("\n");

  const compacted: string[] = [];
  for (const line of lines) {
    const last = compacted[compacted.length - 1] || "";
    if (!last) {
      compacted.push(line);
      continue;
    }
    if (line === last) continue;
    if (line.startsWith(last)) {
      compacted[compacted.length - 1] = line;
      continue;
    }
    if (last.startsWith(line)) {
      continue;
    }
    compacted.push(line);
  }
  return compacted.join("\n");
}

export function formatResumeDiffPreview(value?: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const normalized = looksLikeHtml(raw)
    ? htmlToReadableText(raw)
    : decodeHtmlEntities(stripMarkdownMarkers(raw))
        .replace(/[ \t]{2,}/g, " ")
        .trim();
  const compacted = compactProgressiveLines(normalized);
  const MAX_LEN = 900;
  if (compacted.length <= MAX_LEN) return compacted;
  return `${compacted.slice(0, MAX_LEN)}\n...（内容较长，已截断展示）`;
}

export function normalizeResumePatchValue(
  value: unknown,
  path?: string,
  field?: string,
): unknown {
  if (typeof value !== "string") return value;
  const raw = String(value || "").replace(/\r\n/g, "\n").trim();
  if (!raw) return "";

  const normalizedPath = String(path || "");
  const fallbackField = String(field || "");
  const leafFromPath = normalizedPath
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean)
    .pop();
  const leaf =
    typeof leafFromPath === "string" && !/^\d+$/.test(leafFromPath)
      ? leafFromPath
      : fallbackField;

  const richTextFields = new Set([
    "details",
    "description",
    "skillContent",
    "summary",
  ]);
  if (!richTextFields.has(leaf)) {
    return decodeHtmlEntities(stripMarkdownMarkers(raw));
  }

  const cleanedRichRaw = stripMarkdownMarkers(raw);
  if (looksLikeHtml(cleanedRichRaw)) {
    return cleanedRichRaw;
  }

  return markdownishTextToHtml(cleanedRichRaw);
}

const BEFORE_LABEL = /修改前[:：]/i;
const AFTER_LABEL = /修改后[:：]/i;

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

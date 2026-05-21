export interface ParsedResumeLine {
  type: "bullet" | "text" | "label";
  text: string;
  label?: string;
}

export interface ParsedResumeEntry {
  index?: number;
  title: string;
  subtitle?: string;
  period?: string;
  lines: ParsedResumeLine[];
  rawBody?: string;
}

export interface ParsedResumeSection {
  title: string;
  pathHint?: string;
  entries: ParsedResumeEntry[];
  preamble?: string;
}

const SECTION_HINT =
  /work experience|education|projects|open source|skills|awards|basic information|self evaluation|internship|experience|实习|工作|教育|项目|开源|技能|奖项|基本信息|自我评价/i;

const ENTRY_HEADER_RE =
  /^###\s*(?:\[(\d+)\]|([①②③④⑤⑥⑦⑧⑨⑩1️⃣2️⃣3️⃣4️⃣5️⃣])|(\d+[.)]))?\s*(.+)$/;

const PERIOD_RE = /^(?:\s*)?(?:Period|Date|时间|日期)[:：]\s*(.+)$/i;
const LABEL_RE = /^(?:\s*)?(Description|Details|Role|Repo|Link|GPA|Issuer|Email|Phone|Location|Summary|Position|Name|Target Position)[:：]\s*(.+)$/i;

const CIRCLED_NUM_MAP: Record<string, number> = {
  "①": 0,
  "②": 1,
  "③": 2,
  "④": 3,
  "⑤": 4,
  "⑥": 5,
  "⑦": 6,
  "⑧": 7,
  "⑨": 8,
  "⑩": 9,
  "1️⃣": 0,
  "2️⃣": 1,
  "3️⃣": 2,
  "4️⃣": 3,
  "5️⃣": 4,
};

function stripMarkdownBold(text: string): string {
  return text.replace(/\*\*/g, "").trim();
}

function stripDecorativePrefix(text: string): string {
  let cleaned = (text || "").trim();
  cleaned = cleaned.replace(/^#+\s*/g, "").trim();
  // 去掉标题前的装饰 emoji（如 📁、🔗）
  cleaned = cleaned.replace(/^[\p{Extended_Pictographic}\u2600-\u27BF]\s*/u, "").trim();
  cleaned = cleaned.replace(/^#+\s*/g, "").trim();
  return cleaned;
}

function cleanSectionTitle(raw: string): { title: string; pathHint?: string } {
  const pathMatch = raw.match(/^(.*?)\s*\(\s*path(?: prefix)?[:：]\s*([^)]+)\)/i);
  if (pathMatch) {
    return {
      title: stripDecorativePrefix(stripMarkdownBold(pathMatch[1])).replace(/\s{2,}/g, " ").trim(),
      pathHint: pathMatch[2].trim(),
    };
  }
  return {
    title: stripDecorativePrefix(stripMarkdownBold(raw)).replace(/\s{2,}/g, " ").trim(),
  };
}

function parseEntryHeader(line: string): ParsedResumeEntry | null {
  const match = line.match(ENTRY_HEADER_RE);
  if (!match) return null;

  const bracketIndex = match[1] !== undefined ? Number(match[1]) : undefined;
  const circledIndex =
    match[2] !== undefined ? CIRCLED_NUM_MAP[match[2]] : undefined;
  const plainIndex =
    match[3] !== undefined ? Number(match[3].replace(/[.)]/, "")) - 1 : undefined;
  const rawTitle = stripMarkdownBold(match[4] || "");

  let title = rawTitle;
  let subtitle: string | undefined;
  const splitters = [" | ", " · ", " - ", " – ", " — "];
  for (const splitter of splitters) {
    if (rawTitle.includes(splitter)) {
      const [left, right] = rawTitle.split(splitter);
      title = left.trim();
      subtitle = right.trim();
      break;
    }
  }

  return {
    index: bracketIndex ?? circledIndex ?? plainIndex,
    title,
    subtitle,
    lines: [],
  };
}

function parseBodyLine(rawLine: string): ParsedResumeLine | null {
  const line = rawLine.replace(/^\s{2,}/, "").trim();
  if (!line) return null;

  const periodMatch = line.match(PERIOD_RE);
  if (periodMatch) {
    return { type: "label", label: "时间", text: periodMatch[1].trim() };
  }

  const labelMatch = line.match(LABEL_RE);
  if (labelMatch) {
    return { type: "label", label: labelMatch[1], text: labelMatch[2].trim() };
  }

  const bulletMatch = line.match(/^[-•*]\s+(.+)$/);
  if (bulletMatch) {
    return { type: "bullet", text: stripMarkdownBold(bulletMatch[1]) };
  }

  const numberedMatch = line.match(/^\d+[.)]\s+(.+)$/);
  if (numberedMatch) {
    return { type: "bullet", text: stripMarkdownBold(numberedMatch[1]) };
  }

  return { type: "text", text: stripMarkdownBold(line) };
}

function isStandalonePeriod(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 40) return null;
  if (/^(?:Period|Date|时间|日期)[:：]/i.test(trimmed)) return null;
  if (/^\d{4}[./-]\d{1,2}/.test(trimmed)) return trimmed;
  if (/^\d{4}\s*[-–—~至到]\s*(?:\d{4}|至今|现在|Present)/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/** 去掉 Agent 常用的装饰性分隔线，避免渲染成大段空白 */
export function stripDecorativeDividers(content: string): string {
  return (content || "")
    .replace(/^\s*[-*_]{3,}\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 拆分引导语、结构化正文与结尾追问 */
export function splitResumeMessageFrame(content: string): {
  prefix: string;
  core: string;
  suffix: string;
} {
  const text = stripDecorativeDividers(content);
  const structMatch = text.match(/^###\s+/m) || text.match(/^##\s+/m);
  if (!structMatch || structMatch.index === undefined) {
    return { prefix: "", core: text, suffix: "" };
  }

  const prefix = text.slice(0, structMatch.index).trim();
  let core = text.slice(structMatch.index).trim();

  const suffixMatch = core.match(/\n\n+(请问[\s\S]+)$/);
  let suffix = "";
  if (suffixMatch && suffixMatch.index !== undefined) {
    suffix = suffixMatch[1].trim();
    core = core.slice(0, suffixMatch.index).trim();
  }

  return { prefix, core, suffix };
}

function parseEntryList(entryChunks: string[]): ParsedResumeEntry[] {
  const entries: ParsedResumeEntry[] = [];

  for (const entryChunk of entryChunks) {
    const [headerLine, ...entryLines] = entryChunk.split("\n");
    const entry = parseEntryHeader(`### ${headerLine}`);
    if (!entry) continue;

    for (const rawLine of entryLines) {
      const period = isStandalonePeriod(rawLine);
      if (period && !entry.period) {
        entry.period = period;
        continue;
      }

      const parsedLine = parseBodyLine(rawLine);
      if (!parsedLine) continue;

      if (
        parsedLine.type === "label" &&
        parsedLine.label &&
        /period|date|时间|日期/i.test(parsedLine.label)
      ) {
        entry.period = parsedLine.text;
        continue;
      }

      entry.lines.push(parsedLine);
    }

    entry.rawBody = entryLines.join("\n").trim();
    entries.push(entry);
  }

  return entries;
}

export function isResumeStructuredContent(content: string): boolean {
  const text = stripDecorativeDividers(content || "");
  if (!text) return false;
  if (/CV\/Resume Context/i.test(text)) return true;
  if (/path prefix:/i.test(text)) return true;
  if (/^###\s*\[\d+\]/m.test(text)) return true;

  const h2Lines = text.match(/^##\s+.+$/gm) || [];
  const resumeSections = h2Lines.filter((line) =>
    SECTION_HINT.test(line.replace(/^##\s+/, "")),
  );
  return resumeSections.length >= 1 && (h2Lines.length >= 2 || /^###\s+/m.test(text));
}

function isResumeSectionTitle(title: string): boolean {
  return SECTION_HINT.test(title);
}

function isSectionDisplayable(section: ParsedResumeSection): boolean {
  if (section.entries.length > 0) return true;
  return Boolean((section.preamble || "").trim());
}

export function parseResumeMarkdown(content: string): ParsedResumeSection[] {
  const normalized = stripDecorativeDividers(content)
    .replace(/^#\s+CV\/Resume Context\s*$/gim, "")
    .trim();

  if (/^###\s+/m.test(normalized) && !/^##\s+/m.test(normalized)) {
    const entryChunks = normalized.split(/^###\s+/m).slice(1);
    const entries = parseEntryList(entryChunks);
    if (entries.length > 0) {
      return [{ title: "", entries }];
    }
  }

  const chunks = normalized.split(/^##\s+/m).filter(Boolean);
  const sections: ParsedResumeSection[] = [];

  for (const chunk of chunks) {
    const [titleLine, ...restLines] = chunk.split("\n");
    const { title, pathHint } = cleanSectionTitle(titleLine || "未命名模块");
    const body = restLines.join("\n").trim();
    if (!body) {
      if (isResumeSectionTitle(title) || pathHint) {
        sections.push({ title, pathHint, entries: [], preamble: "" });
      }
      continue;
    }

    const entryChunks = body.split(/^###\s+/m);
    if (entryChunks.length <= 1) {
      if (!isResumeSectionTitle(title) && !pathHint) {
        continue;
      }
      sections.push({
        title,
        pathHint,
        entries: [],
        preamble: body.replace(/^\s+|\s+$/g, ""),
      });
      continue;
    }

    const entries = parseEntryList(entryChunks.slice(1));

    sections.push({ title, pathHint, entries });
  }

  return sections.filter(isSectionDisplayable);
}

import React from "react";

const URL_RE = /(https?:\/\/[^\s<>"')\]}]+)/g;

export function splitTextWithUrls(text: string): Array<{ type: "text" | "url"; value: string }> {
  const parts: Array<{ type: "text" | "url"; value: string }> = [];
  let lastIndex = 0;
  const re = new RegExp(URL_RE.source, "g");
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "url", value: match[1] });
    lastIndex = match.index + match[1].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return parts;
}

export function linkifyTextNodes(text: string, linkClassName?: string): React.ReactNode {
  if (!text) return text;
  const parts = splitTextWithUrls(text);
  if (parts.length <= 1 && parts[0]?.type === "text") {
    return text;
  }

  return parts.map((part, index) =>
    part.type === "url" ? (
      <a
        key={`url-${index}`}
        href={part.value}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClassName || "text-blue-600 underline decoration-blue-600/40 underline-offset-2 hover:text-blue-700 break-all"}
      >
        {part.value}
      </a>
    ) : (
      <React.Fragment key={`text-${index}`}>{part.value}</React.Fragment>
    ),
  );
}

/** 为 HTML 片段中的裸 URL 包裹可点击链接（跳过已有 <a> 标签内文本）。 */
export function linkifyHtmlContent(html: string): string {
  if (!html || !/(https?:\/\/[^\s<>"')\]}]+)/.test(html)) {
    return html;
  }

  return html.replace(/(<a\b[^>]*>[\s\S]*?<\/a>)|(<[^>]+>)|(https?:\/\/[^\s<>"')\]}]+)/gi, (match, anchor, tag, url) => {
    if (anchor || tag) return match;
    if (!url) return match;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}

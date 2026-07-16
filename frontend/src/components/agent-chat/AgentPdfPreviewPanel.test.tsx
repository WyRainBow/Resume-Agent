// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// PDFViewerSelector 依赖 pdfjs（jsdom 下加载重且无 worker），本测试只关心
// 面板的隐藏渲染语义，mock 掉
vi.mock("@/components/PDFEditor", () => ({
  PDFViewerSelector: () => null,
}));

import AgentPdfPreviewPanel from "./AgentPdfPreviewPanel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const BASE_PROPS = {
  resumeName: "张露巍",
  pdfBlob: null,
  loading: false,
  error: null,
  onRerender: vi.fn(),
  onClose: vi.fn(),
};

describe("AgentPdfPreviewPanel · 视觉隐藏但保持渲染", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("stays mounted with display:none when concealed (content preserved, visually hidden)", () => {
    act(() => {
      root.render(
        <AgentPdfPreviewPanel
          {...BASE_PROPS}
          concealed
          onToggleConceal={vi.fn()}
        />,
      );
    });

    const aside = container.querySelector("aside");
    expect(aside).not.toBeNull();
    // 内容仍在 DOM（标题/简历名保持挂载），只是视觉隐藏
    expect(container.textContent).toContain("简历 PDF 预览");
    expect(container.textContent).toContain("张露巍");
    // display:none（Tailwind hidden）在视觉与可访问性树上都隐藏，DOM 保留
    expect(aside!.className).toContain("hidden");
  });

  it("shows the conceal button only when a handler is provided and fires it on click", () => {
    const onToggleConceal = vi.fn();
    act(() => {
      root.render(
        <AgentPdfPreviewPanel {...BASE_PROPS} onToggleConceal={onToggleConceal} />,
      );
    });

    const aside = container.querySelector("aside")!;
    expect(aside.className).not.toContain("hidden");
    const button = container.querySelector<HTMLButtonElement>(
      'button[title="收起预览"]',
    );
    expect(button).not.toBeNull();
    act(() => button!.click());
    expect(onToggleConceal).toHaveBeenCalledTimes(1);

    // 不传回调则不渲染按钮（旧调用方零影响）
    act(() => {
      root.render(<AgentPdfPreviewPanel {...BASE_PROPS} />);
    });
    expect(
      container.querySelector('button[title="收起预览"]'),
    ).toBeNull();
  });
});

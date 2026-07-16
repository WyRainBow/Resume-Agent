// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ResumeDiffCard, ApplyAllPatchesBar } from "./ResumeDiffCard";
import type { PendingPatch } from "@/contexts/ResumeContext";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const patch = (id: string): PendingPatch => ({
  patch_id: id,
  message_id: "current",
  paths: ["basic.email"],
  before: { "basic.email": "3658043236@qq.com" },
  after: { "basic.email": "weiyu@example.com" },
  summary: "更换更专业的联系邮箱",
  operation: "set",
  status: "pending",
});

describe("ResumeDiffCard · 无 ResumeProvider 也不崩（可选 context 降级）", () => {
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

  it("renders the diff card without a provider instead of throwing", () => {
    // 关键：不包 ResumeProvider。修复前这里会抛
    // 「useResumeContext must be used within ResumeProvider」并崩掉子树。
    expect(() =>
      act(() => {
        root.render(<ResumeDiffCard patch={patch("p1")} />);
      }),
    ).not.toThrow();
    expect(container.textContent).toContain("更换更专业的联系邮箱");
  });

  it("ApplyAllPatchesBar degrades to null without a provider", () => {
    act(() => {
      root.render(
        <ApplyAllPatchesBar patches={[patch("p1"), patch("p2")]} />,
      );
    });
    // 无 context 无法应用 → 不渲染按钮，也不抛错
    expect(container.textContent).toBe("");
  });
});

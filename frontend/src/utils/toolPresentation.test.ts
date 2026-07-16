import { describe, expect, it } from "vitest";

import { classifyStructuredToolPresentation } from "./toolPresentation";

describe("classifyStructuredToolPresentation", () => {
  it("keeps resume list execution only in the shared process timeline", () => {
    expect(classifyStructuredToolPresentation("resume_list")).toBe("process_only");
    expect(classifyStructuredToolPresentation("resume_detail")).toBe("process_only");
  });

  it("loads resume detail as a side effect without rendering a duplicate card", () => {
    expect(classifyStructuredToolPresentation("resume_loaded")).toBe(
      "resume_loaded_side_effect",
    );
  });

  it("keeps business artifacts as their specialized cards", () => {
    expect(classifyStructuredToolPresentation("resume_diagnosis")).toBe("artifact");
    expect(classifyStructuredToolPresentation("future_artifact")).toBe("artifact");
  });
});

describe("patch/selector internals never reach the generic card fallback", () => {
  it("classifies resume_patch and resume_selector as process_only", () => {
    // resume_patch 有专属面板（pendingPatches / patchItems），resume_selector
    // 是效果信号（面板由 show_resume 工具名驱动）——两者都不该出现在
    // StructuredCards 里被 FallbackJsonCard 渲染成裸 JSON。
    expect(classifyStructuredToolPresentation("resume_patch")).toBe("process_only");
    expect(classifyStructuredToolPresentation("resume_selector")).toBe("process_only");
  });
});

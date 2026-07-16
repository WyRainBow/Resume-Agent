import { describe, expect, it } from "vitest";

import {
  buildApplyDecisionCopy,
  buildRejectDecisionCopy,
} from "./applyDecisionCopy";

describe("buildApplyDecisionCopy · 应用气泡文案复用 summary", () => {
  it("单处修改：直接用 summary 说清改了什么（不是干巴巴的 N 处）", () => {
    expect(
      buildApplyDecisionCopy(["修改了 教育经历「北京大学」的描述"], 0),
    ).toBe("我修改了 教育经历「北京大学」的描述");
  });

  it("多处修改：逐条列出各改了什么", () => {
    const copy = buildApplyDecisionCopy(
      ["修改了 教育经历「北京大学」的描述", "删除了 第 2 段荣誉奖项"],
      0,
    );
    expect(copy).toContain("我应用了这几处修改：");
    expect(copy).toContain("· 修改了 教育经历「北京大学」的描述");
    expect(copy).toContain("· 删除了 第 2 段荣誉奖项");
  });

  it("含拒绝：追加「另有 N 处先不改」", () => {
    expect(buildApplyDecisionCopy(["修改了 A"], 2)).toBe(
      "我修改了 A\n（另有 2 处先不改）",
    );
  });

  it("summary 缺失兜底为计数文案，不出空气泡", () => {
    expect(buildApplyDecisionCopy(["", "  "], 0)).toBe("我应用了 2 处修改");
  });

  it("数字用传入的本批 summary 数量，与全会话累计无关", () => {
    // 第二批只新应用 1 处：即使全会话已应用多处，这里只反映本批
    expect(buildApplyDecisionCopy(["修改了 联系邮箱"], 0)).toBe(
      "我修改了 联系邮箱",
    );
  });
});

describe("buildRejectDecisionCopy · 拒绝气泡文案", () => {
  it("单处 / 多处措辞", () => {
    expect(buildRejectDecisionCopy(1)).toBe("这处修改我先不改了");
    expect(buildRejectDecisionCopy(3)).toBe("这 3 处修改我先不改了");
  });
});

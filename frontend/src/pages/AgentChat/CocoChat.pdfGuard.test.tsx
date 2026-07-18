// @vitest-environment jsdom
/**
 * PDF 预览守卫「先修复再渲染」回归（2026-07-18,复发根治)。
 *
 * 复发场景:loadedResumes 某写入路径漏 canonical 转换 → resumeData 缺
 * menuSections 等字段 → 旧守卫直接报「当前简历数据格式不支持 PDF 预览」。
 * 修复后:renderResumePdfPreview 守卫前先过 toCanonicalResumeData 自愈。
 * 本测试用标准样本 简历测试/韦宇测试.json 直测生产函数(非复制品)。
 */
import { describe, expect, it } from "vitest";

// node 模块类型由 src/test-node-shims.d.ts 提供(项目未装 @types/node)
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  isWorkspaceResumeData,
  toCanonicalResumeData,
} from "./CocoChat";

const SAMPLE_PATH = resolve(__dirname, "../../../../简历测试/韦宇测试.json");
const loadSample = (): Record<string, any> =>
  JSON.parse(readFileSync(SAMPLE_PATH, "utf-8"));

describe("PDF 预览守卫 · 先修复再渲染(韦宇测试.json)", () => {
  it("完整工作台格式直接通过守卫,且原样返回(不二次转换)", () => {
    const full = loadSample();
    expect(isWorkspaceResumeData(full)).toBe(true);
    const canonical = toCanonicalResumeData(full, "r1", "韦宇");
    expect(canonical).toBe(full); // 引用相等 = 未走 normalize,无二次包 <p> 损耗
  });

  it("缺 menuSections(复发场景)→ 旧守卫拒绝,修复后能自愈通过", () => {
    const degraded = loadSample();
    delete degraded.menuSections;
    // 旧行为:这里直接报「不支持」
    expect(isWorkspaceResumeData(degraded)).toBe(false);
    // 新行为:先修复
    const repaired = toCanonicalResumeData(degraded, "r1", "韦宇");
    expect(isWorkspaceResumeData(repaired)).toBe(true);
  });

  it("修复不丢内容:经历/教育/项目条数与姓名保持", () => {
    const original = loadSample();
    const degraded = loadSample();
    delete degraded.menuSections;
    const repaired = toCanonicalResumeData(degraded, "r1", "韦宇") as Record<
      string,
      any
    >;
    expect(repaired.basic?.name).toBe(original.basic?.name);
    expect(repaired.experience?.length).toBe(original.experience.length);
    expect(repaired.education?.length).toBe(original.education.length);
    expect(repaired.projects?.length).toBe(original.projects.length);
  });

  it("多字段同时缺失(后端精简结构形态)也能修复通过", () => {
    const full = loadSample();
    const minimal: Record<string, any> = {
      basic: full.basic,
      experience: full.experience,
      // 缺 education / projects / menuSections —— 精简回包常见形态
    };
    expect(isWorkspaceResumeData(minimal)).toBe(false);
    const repaired = toCanonicalResumeData(minimal, "r1", "韦宇");
    expect(isWorkspaceResumeData(repaired)).toBe(true);
    expect((repaired as Record<string, any>).experience?.length).toBe(
      full.experience.length,
    );
  });
});

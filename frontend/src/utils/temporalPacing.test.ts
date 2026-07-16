import { describe, expect, it } from "vitest";

import {
  longestCommonPrefixLength,
  temporalChunkSize,
  temporalDelayMs,
} from "./temporalPacing";

describe("temporalPacing", () => {
  it("adds stronger breathing pauses at punctuation and line breaks", () => {
    expect(temporalDelayMs("a", false)).toBe(14);
    expect(temporalDelayMs("中", false)).toBe(22);
    expect(temporalDelayMs("，", false)).toBe(70);
    expect(temporalDelayMs("。", false)).toBe(130);
    expect(temporalDelayMs("\n", false)).toBe(180);
    expect(temporalDelayMs("。", true)).toBe(8);
  });

  it("consumes larger chunks as the pending text grows", () => {
    expect(temporalChunkSize({ backlog: 8, draining: false })).toBe(1);
    expect(temporalChunkSize({ backlog: 20, draining: false })).toBe(2);
    expect(temporalChunkSize({ backlog: 40, draining: false })).toBe(3);
    expect(temporalChunkSize({ backlog: 80, draining: false })).toBe(5);
    expect(temporalChunkSize({ backlog: 160, draining: false })).toBe(8);
    expect(temporalChunkSize({ backlog: 160, draining: true })).toBe(16);
  });

  it("keeps only the stable prefix when upstream replaces a thought", () => {
    expect(
      longestCommonPrefixLength(
        "好，我先看看当前简历。",
        "好，我来仔细看看这份简历。",
      ),
    ).toBe(3);
  });
});

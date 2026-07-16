export interface TemporalPacingContext {
  backlog: number;
  draining: boolean;
}

const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/;
const COMMA_RE = /[,，:：;；、]$/;
const SENTENCE_END_RE = /[.!?。！？]$/;

/** Find the stable prefix when an upstream node replaces, rather than appends, text. */
export function longestCommonPrefixLength(left: string, right: string): number {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[index] === right[index]) index += 1;
  return index;
}

/**
 * Consume larger batches when upstream text arrives in a burst.  Draining is
 * used when a tool for the same ReAct step is ready to be presented.
 */
export function temporalChunkSize({
  backlog,
  draining,
}: TemporalPacingContext): number {
  if (draining) {
    if (backlog > 120) return 16;
    if (backlog > 60) return 12;
    return 8;
  }
  if (backlog > 120) return 8;
  if (backlog > 60) return 5;
  if (backlog > 24) return 3;
  return backlog > 8 ? 2 : 1;
}

/** Return the presentation delay after the latest displayed chunk. */
export function temporalDelayMs(chunk: string, draining: boolean): number {
  if (draining) return 8;
  if (chunk.endsWith("\n")) return 180;
  if (SENTENCE_END_RE.test(chunk)) return 130;
  if (COMMA_RE.test(chunk)) return 70;
  const lastCharacter = chunk[chunk.length - 1] || "";
  return CJK_RE.test(lastCharacter) ? 22 : 14;
}

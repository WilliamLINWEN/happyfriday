// edge-case-handler.ts - Utility for handling edge cases in API and service logic

export function handleLargeDiff(diff: string, maxSize: number): { ok: boolean, diff?: string, error?: string } {
  if (diff.length > maxSize) {
    return { ok: false, error: 'PR diff is too large to process.' };
  }
  return { ok: true, diff };
}

export function handleRateLimit(retryAfter?: string | number): { ok: false, error: string } {
  const msg = retryAfter
    ? `Rate limit exceeded. Please try again in ${retryAfter} seconds.`
    : 'Rate limit exceeded. Please try again later.';
  return { ok: false, error: msg };
}

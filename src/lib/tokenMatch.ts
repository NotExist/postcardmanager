import type { Postcard } from './types';

export function displayOf(p: Postcard): string {
  return p.version ? `${p.name} · ${p.version}` : p.name;
}

export interface TokenMatchResult {
  /** 名稱唯一命中的 postcard id（依 token 順序、已去重） */
  matchedIds: string[];
  /** 同名多筆（不同版本），需使用者選擇其一 */
  ambiguous: { token: string; candidates: Postcard[] }[];
  /** 完全找不到，候選為「待新增」 */
  unmatched: string[];
}

/**
 * 把以空白分隔貼入的 token 逐一與現有明信片「名稱」做 exact 比對（trim 後）。
 * 注意：token 由空白切出，天生不可能含空白，因此含空白的名稱無法經貼入比對／新增。
 */
export function matchPostcardTokens(tokens: string[], postcards: Postcard[]): TokenMatchResult {
  const byName = new Map<string, Postcard[]>();
  for (const p of postcards) {
    const n = p.name.trim();
    if (!n) continue;
    const list = byName.get(n);
    if (list) list.push(p);
    else byName.set(n, [p]);
  }

  const seen = new Set<string>();
  const matchedIds: string[] = [];
  const ambiguous: TokenMatchResult['ambiguous'] = [];
  const unmatched: string[] = [];

  for (const raw of tokens) {
    const t = raw.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    const cands = byName.get(t);
    if (!cands) unmatched.push(t);
    else if (cands.length === 1) matchedIds.push(cands[0].id);
    else ambiguous.push({ token: t, candidates: cands });
  }

  return { matchedIds, ambiguous, unmatched };
}

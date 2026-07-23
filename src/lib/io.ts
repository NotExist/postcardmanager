import { db } from './db';
import type { ExportBundle } from './types';

export async function exportAll(): Promise<ExportBundle> {
  const [users, postcards, holdings] = await Promise.all([
    db.users.toArray(),
    db.postcards.toArray(),
    db.holdings.toArray(),
  ]);
  return {
    schemaVersion: 1,
    exportedAt: Date.now(),
    users,
    postcards,
    holdings,
  };
}

export function downloadJSON(bundle: ExportBundle, filename?: string): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const ts = new Date(bundle.exportedAt).toISOString().replace(/[:.]/g, '-');
  a.download = filename ?? `postcardmemo-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type ImportMode = 'replace' | 'merge';

export interface ImportResult {
  users: number;
  postcards: number;
  holdings: number;
}

export async function importBundle(bundle: ExportBundle, mode: ImportMode): Promise<ImportResult> {
  if (bundle.schemaVersion !== 1) {
    throw new Error(`Unsupported schemaVersion: ${bundle.schemaVersion}`);
  }
  return db.transaction('rw', db.users, db.postcards, db.holdings, async () => {
    if (mode === 'replace') {
      await Promise.all([db.users.clear(), db.postcards.clear(), db.holdings.clear()]);
    }
    await db.users.bulkPut(bundle.users);
    await db.postcards.bulkPut(bundle.postcards);
    await db.holdings.bulkPut(bundle.holdings);
    return {
      users: bundle.users.length,
      postcards: bundle.postcards.length,
      holdings: bundle.holdings.length,
    };
  });
}

export interface ParsedBundle {
  bundle: ExportBundle;
  /** 被補齊缺漏欄位（或修正型別）的紀錄數 */
  fixed: number;
}

/**
 * 逐筆正規化：id（holdings 另含 userId/postcardId）必須是非空字串，否則整檔拒收；
 * 其餘欄位缺漏或型別不對時補預設值。避免缺 createdAt 之類的紀錄寫進 DB 後
 * 被 index 查詢隱形（orderBy 不回傳缺索引欄位的紀錄）。
 */
function normalizeBundle(parsed: Record<string, any>): ParsedBundle {
  let fixed = 0;
  let dirty = false;
  const ts = Date.now();

  const str = (v: unknown): string => (typeof v === 'string' ? v : ((dirty = true), ''));
  const num = (v: unknown, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : ((dirty = true), fallback);
  const latlon = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : v === null ? null : ((dirty = true), null);
  const reqId = (v: unknown, where: string): string => {
    if (typeof v !== 'string' || !v) throw new Error(`${where} 缺有效 id，無法匯入`);
    return v;
  };
  const track = <T>(rec: T): T => {
    if (dirty) fixed++;
    dirty = false;
    return rec;
  };

  const users = parsed.users.map((u: any, i: number) =>
    track({
      id: reqId(u?.id, `users[${i}]`),
      displayName: str(u?.displayName),
      note: str(u?.note),
      createdAt: num(u?.createdAt, ts),
      updatedAt: num(u?.updatedAt, num(u?.createdAt, ts)),
    }),
  );
  const postcards = parsed.postcards.map((p: any, i: number) =>
    track({
      id: reqId(p?.id, `postcards[${i}]`),
      name: str(p?.name),
      lat: latlon(p?.lat),
      lon: latlon(p?.lon),
      version: str(p?.version),
      note: str(p?.note),
      createdAt: num(p?.createdAt, ts),
      updatedAt: num(p?.updatedAt, num(p?.createdAt, ts)),
    }),
  );
  const holdings = parsed.holdings.map((h: any, i: number) =>
    track({
      id: reqId(h?.id, `holdings[${i}]`),
      userId: reqId(h?.userId, `holdings[${i}].userId`),
      postcardId: reqId(h?.postcardId, `holdings[${i}].postcardId`),
      acquiredAt: num(h?.acquiredAt, ts),
      note: str(h?.note),
    }),
  );

  return {
    bundle: { schemaVersion: 1, exportedAt: num(parsed.exportedAt, ts), users, postcards, holdings },
    fixed,
  };
}

export async function parseBundleFile(file: File): Promise<ParsedBundle> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid JSON: not an object');
  if (parsed.schemaVersion !== 1) throw new Error(`Unsupported schemaVersion: ${parsed.schemaVersion}`);
  if (!Array.isArray(parsed.users) || !Array.isArray(parsed.postcards) || !Array.isArray(parsed.holdings)) {
    throw new Error('Invalid bundle structure');
  }
  return normalizeBundle(parsed);
}

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

export async function parseBundleFile(file: File): Promise<ExportBundle> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid JSON: not an object');
  if (parsed.schemaVersion !== 1) throw new Error(`Unsupported schemaVersion: ${parsed.schemaVersion}`);
  if (!Array.isArray(parsed.users) || !Array.isArray(parsed.postcards) || !Array.isArray(parsed.holdings)) {
    throw new Error('Invalid bundle structure');
  }
  return parsed as ExportBundle;
}

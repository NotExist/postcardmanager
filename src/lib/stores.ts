import { readable } from 'svelte/store';
import { liveQuery } from 'dexie';
import { db } from './db';
import type { User, Postcard, Holding } from './types';

function fromLiveQuery<T>(fn: () => Promise<T>, initial: T) {
  return readable<T>(initial, (set) => {
    const sub = liveQuery(fn).subscribe({
      next: (v) => set(v),
      error: (err) => console.error('liveQuery error', err),
    });
    return () => sub.unsubscribe();
  });
}

// updatedAt 未建 index，個人規模資料直接 JS 排序（新→舊），免 schema 遷移
export const users = fromLiveQuery<User[]>(
  () => db.users.toArray().then((a) => a.sort((x, y) => y.updatedAt - x.updatedAt)),
  [],
);
export const postcards = fromLiveQuery<Postcard[]>(() => db.postcards.orderBy('createdAt').toArray(), []);
export const holdings = fromLiveQuery<Holding[]>(() => db.holdings.orderBy('acquiredAt').toArray(), []);

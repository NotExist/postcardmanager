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

export const users = fromLiveQuery<User[]>(() => db.users.orderBy('createdAt').toArray(), []);
export const postcards = fromLiveQuery<Postcard[]>(() => db.postcards.orderBy('createdAt').toArray(), []);
export const holdings = fromLiveQuery<Holding[]>(() => db.holdings.orderBy('acquiredAt').toArray(), []);

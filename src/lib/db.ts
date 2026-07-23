import Dexie, { type Table } from 'dexie';
import type { User, Postcard, Holding } from './types';

export class PostcardMemoDB extends Dexie {
  users!: Table<User, string>;
  postcards!: Table<Postcard, string>;
  holdings!: Table<Holding, string>;

  constructor() {
    super('postcardmemo');
    this.version(1).stores({
      users: 'id, displayName, createdAt',
      postcards: 'id, name, [lat+lon], createdAt',
      holdings: 'id, userId, postcardId, [userId+postcardId], acquiredAt',
    });
  }
}

export const db = new PostcardMemoDB();

export function uid(): string {
  return crypto.randomUUID();
}

export function now(): number {
  return Date.now();
}

/**
 * race p 與逾時。IndexedDB 被其他視窗/分頁的未完成交易鎖住時，
 * 操作會「無限懸掛」而非拋錯——逾時是唯一可偵測的訊號。
 * 注意：逾時只是放棄等待，底層操作可能稍後仍會完成。
 */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

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

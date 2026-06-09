import { db } from './db';
import type { Postcard, User, Holding } from './types';

const LATLON_EPSILON = 0.0005;

export interface HoldingDupHit {
  kind: 'exact' | 'same-name' | 'same-location';
  holding: Holding;
  postcard: Postcard;
}

export async function findHoldingDuplicates(
  userId: string,
  postcardId: string,
): Promise<HoldingDupHit[]> {
  const target = await db.postcards.get(postcardId);
  if (!target) return [];

  const userHoldings = await db.holdings.where('userId').equals(userId).toArray();
  if (userHoldings.length === 0) return [];

  const heldPostcards = await db.postcards.bulkGet(userHoldings.map((h) => h.postcardId));
  const hits: HoldingDupHit[] = [];

  userHoldings.forEach((holding, idx) => {
    const pc = heldPostcards[idx];
    if (!pc) return;
    if (pc.id === target.id) {
      hits.push({ kind: 'exact', holding, postcard: pc });
      return;
    }
    if (pc.name.trim() && pc.name.trim() === target.name.trim()) {
      hits.push({ kind: 'same-name', holding, postcard: pc });
      return;
    }
    if (
      pc.lat !== null &&
      pc.lon !== null &&
      target.lat !== null &&
      target.lon !== null &&
      Math.abs(pc.lat - target.lat) < LATLON_EPSILON &&
      Math.abs(pc.lon - target.lon) < LATLON_EPSILON
    ) {
      hits.push({ kind: 'same-location', holding, postcard: pc });
    }
  });

  return hits;
}

export async function findPostcardDuplicates(candidate: Pick<Postcard, 'name' | 'lat' | 'lon'>): Promise<Postcard[]> {
  const hits = new Map<string, Postcard>();
  const trimmed = candidate.name.trim();
  if (trimmed) {
    const byName = await db.postcards.where('name').equals(trimmed).toArray();
    byName.forEach((p) => hits.set(p.id, p));
  }
  if (candidate.lat !== null && candidate.lon !== null) {
    const all = await db.postcards.toArray();
    all.forEach((p) => {
      if (
        p.lat !== null &&
        p.lon !== null &&
        Math.abs(p.lat - (candidate.lat as number)) < LATLON_EPSILON &&
        Math.abs(p.lon - (candidate.lon as number)) < LATLON_EPSILON
      ) {
        hits.set(p.id, p);
      }
    });
  }
  return [...hits.values()];
}

export async function findUserDuplicates(candidate: Pick<User, 'displayName'>): Promise<User[]> {
  const trimmed = candidate.displayName.trim();
  if (!trimmed) return [];
  return db.users.where('displayName').equals(trimmed).toArray();
}

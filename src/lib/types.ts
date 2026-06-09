export interface User {
  id: string;
  displayName: string;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface Postcard {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
  version: string;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface Holding {
  id: string;
  userId: string;
  postcardId: string;
  acquiredAt: number;
  note: string;
}

export interface ExportBundle {
  schemaVersion: 1;
  exportedAt: number;
  users: User[];
  postcards: Postcard[];
  holdings: Holding[];
}

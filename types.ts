// types.ts

/* ---------- Memory Vault ---------- */

export type MemoryKind = 'win' | 'gratitude' | 'appreciation' | 'idea';

export type ReminderKind = 'none' | 'date' | 'interval' | 'daily';

// Stored with a memory (only applicable fields are set)
export type MemoryReminder = {
  type: ReminderKind;
  // 'date'
  date?: number; // ms epoch (Date.now())
  // 'interval'
  seconds?: number; // every N seconds
  repeats?: boolean;
  // 'daily'
  hour?: number;
  minute?: number;
  // always optional
  notificationId?: string; // expo notification id
};

export interface Memory {
  id: string;
  ownerId: string;
  kind: MemoryKind;
  label: string;
  value: string;
  notes?: string;
  link?: string;
  favorite?: boolean;
  createdAt: number; // ms epoch
  reminder?: MemoryReminder;
}

// When creating from the UI, you don’t provide id/ownerId/createdAt
export type NewMemory = Omit<Memory, 'id' | 'ownerId' | 'createdAt'>;

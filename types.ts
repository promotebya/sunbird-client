// types.ts

export type MemoryKind =
  | 'favorite'
  | 'size'
  | 'allergy'
  | 'date'
  | 'gift'
  | 'wishlist'
  | 'note';

export type Memory = {
  id: string;
  ownerId: string;
  kind: MemoryKind;
  label: string;
  value?: string;
  notes?: string;
  link?: string;
  date?: Date | null;
  remindOn?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export type MemoryInput = Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>;
export type MemoryPatch = Partial<
  Omit<Memory, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
>;

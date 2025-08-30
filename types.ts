// types.ts (project root)

export type MemoryKind = 'note' | 'reminder' | 'surprise';

export interface Memory {
  id: string;
  ownerId: string;
  kind: MemoryKind;
  label: string;
  value?: string;   // free text (note) or details for reminder/surprise
  notes?: string;
  link?: string;
  createdAt: number; // Date.now()
}

export interface AddMemoryInput {
  ownerId: string;
  kind: MemoryKind;
  label: string;
  value?: string;
  notes?: string;
  link?: string;
}

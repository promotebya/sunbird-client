// types.ts

export type ID = string;

/** Add any kinds you want to support in the UI */
export type MemoryKind = 'note' | 'link' | 'idea' | 'gift' | 'photo';

export interface Memory {
  id: ID;
  ownerId: ID;
  kind: MemoryKind;
  label: string;        // visible title/name
  value: string;        // body/url/etc depending on kind
  notes?: string;
  link?: string;        // convenience field for 'link'
  gift?: string;        // convenience field for 'gift'
  idea?: string;        // convenience field for 'idea'
  createdAt: number;    // millis (read from serverTimestamp)
  updatedAt?: number;   // millis
}

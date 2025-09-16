// types/models.ts
import { Timestamp } from 'firebase/firestore';

export type Plan = 'free' | 'pro';
export type SubscriptionStatus = 'active' | 'grace' | 'canceled';

export interface UserDoc {
  uid: string;
  displayName?: string;
  photoURL?: string;
  email?: string;
  pairId?: string | null;
  expoPushToken?: string | null;
  subscription?: {
    plan: Plan;
    status: SubscriptionStatus;
    expiresAt?: Timestamp | null;
  };
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PairDoc {
  id: string; // doc id = pairId
  timezone?: string; // e.g. "Europe/Berlin"
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  weekly?: {
    weekKey: string; // "2025-W36"
    weekStart: Timestamp;
    target: number; // default 50 (free fixed; pro editable)
    status: 'active' | 'completed' | 'missed';
    progress?: number;
    weeklyStreak?: number;
    longestWeeklyStreak?: number;
    selectedRewardId?: string;
  };
}

export interface RewardDoc {
  title: string;
  emoji?: string;
  notes?: string;
  archived?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  ownerId: string;        // who added
  pairId: string;         // pair scope
}

export interface TaskDoc {
  ownerId: string;
  pairId?: string | null;
  title: string;
  text?: string;
  done?: boolean;
  dueAt?: Timestamp | null;
  completedAt?: Timestamp | null;
  pointsOnComplete?: number; // usually 1
  emoji?: string;
  kind?: string; // optional category
  note?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface NoteDoc {
  ownerId: string;
  pairId?: string | null;
  title?: string;
  text: string;
  emoji?: string;
  kind?: string;
  note?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface MemoryDoc {
  ownerId: string;
  pairId?: string | null;
  title?: string;
  text?: string;
  photoUrl?: string;
  milestone?: boolean;
  emoji?: string;
  kind?: string;
  note?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PointsDoc {
  ownerId: string;
  pairId?: string | null;
  delta: number;       // > 0
  reason?: string;
  category?: string;
  source?: string;     // 'task', 'manual', etc.
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PointsHistoryDoc {
  ownerId: string;
  pairId: string;
  value: number;       // > 0 (alias of delta for analytics)
  reason?: string;
  category?: string;
  source?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface WeeklyHistoryDoc {
  target: number;
  earned: number;
  completed: boolean;
  completedAt?: Timestamp;
  rewardId?: string;
}

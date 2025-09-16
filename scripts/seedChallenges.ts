// utils/seedchallenges.ts
// Production-safe source of challenges + optional dev seeding.
// - In release: reads Firestore; if empty/blocked/offline -> uses local fallback.
// - In dev (optional): set EXPO_PUBLIC_ENABLE_SEED=1 to upsert seeds into Firestore.

import type { DocumentData, Firestore, QueryDocumentSnapshot } from 'firebase/firestore';
import {
    collection,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    writeBatch,
} from 'firebase/firestore';

export type ChallengeDoc = {
  slug: string;
  title: string;
  description: string;
  category: 'date' | 'kindness' | 'conversation' | 'surprise' | 'self-care' | 'play';
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;              // reward points for completing
  minTotalPoints: number | null; // required total points to unlock
  isPremium: boolean;
  isTeaser: boolean;           // show to non-premium with a lock
  createdAt?: any;
  updatedAt?: any;
  active?: boolean;
};

const LOCAL_CHALLENGE_SEEDS: ChallengeDoc[] = [
  {
    slug: 'sunrise-walk',
    title: 'Sunrise Walk Together',
    description: 'Wake up early, grab a warm drink, and catch the sunrise while holding hands.',
    category: 'date',
    difficulty: 'easy',
    points: 2,
    minTotalPoints: null,
    isPremium: false,
    isTeaser: false,
  },
  {
    slug: 'gratitude-trade',
    title: 'Gratitude Trade (3×3)',
    description: 'Each partner shares 3 things they’re grateful for about the other—no repeats!',
    category: 'conversation',
    difficulty: 'easy',
    points: 2,
    minTotalPoints: null,
    isPremium: false,
    isTeaser: false,
  },
  {
    slug: 'secret-act-of-kindness',
    title: 'Secret Act of Kindness',
    description: 'Do something thoughtful for your partner without telling them. Let them find it.',
    category: 'kindness',
    difficulty: 'medium',
    points: 3,
    minTotalPoints: 10,
    isPremium: false,
    isTeaser: false,
  },
  {
    slug: 'screen-free-dinner',
    title: 'Screen-Free Dinner',
    description: 'Cook or order in, but put phones away. Light a candle and ask one deep question.',
    category: 'date',
    difficulty: 'easy',
    points: 2,
    minTotalPoints: null,
    isPremium: false,
    isTeaser: false,
  },
  {
    slug: 'playlist-swap',
    title: 'Playlist Swap',
    description: 'Create a 10-song playlist for each other—no explanations until you listen together.',
    category: 'play',
    difficulty: 'easy',
    points: 2,
    minTotalPoints: null,
    isPremium: false,
    isTeaser: false,
  },

  // Premium teasers (visible to all, locked if not premium)
  {
    slug: 'love-letter-puzzle',
    title: 'Love Letter Puzzle (Premium)',
    description: 'Write a short love letter, cut into 6–8 pieces, and hide them with clues at home.',
    category: 'surprise',
    difficulty: 'medium',
    points: 4,
    minTotalPoints: null,
    isPremium: true,
    isTeaser: true,
  },
  {
    slug: 'mystery-mini-date',
    title: 'Mystery Mini-Date (Premium)',
    description: 'Plan a 1-hour surprise micro-date. Only reveal the meeting point.',
    category: 'date',
    difficulty: 'medium',
    points: 4,
    minTotalPoints: null,
    isPremium: true,
    isTeaser: true,
  },
  {
    slug: 'treasure-hunt-memories',
    title: 'Treasure Hunt: Our Memories (Premium)',
    description: 'Create a 5-stop treasure hunt using shared memories. Each clue references a moment.',
    category: 'play',
    difficulty: 'hard',
    points: 5,
    minTotalPoints: 20,
    isPremium: true,
    isTeaser: true,
  },
];

function mapChallengeDoc(snap: QueryDocumentSnapshot<DocumentData>): ChallengeDoc | null {
  try {
    const d = snap.data();
    return {
      slug: d.slug ?? snap.id,
      title: d.title,
      description: d.description,
      category: d.category,
      difficulty: d.difficulty,
      points: Number(d.points ?? 0),
      minTotalPoints: typeof d.minTotalPoints === 'number' ? d.minTotalPoints : null,
      isPremium: !!d.isPremium,
      isTeaser: !!d.isTeaser,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      active: d.active ?? true,
    };
  } catch {
    return null;
  }
}

export async function ensureChallengesAvailable(
  db: Firestore
): Promise<{ list: ChallengeDoc[]; source: 'remote' | 'local-fallback' }> {
  try {
    // Prefer ordered list (nice UX). If the index is missing, fall back to unordered read.
    let snaps: QueryDocumentSnapshot<DocumentData>[] = [];
    try {
      const q1 = query(collection(db, 'challenges'), orderBy('createdAt', 'desc'));
      const s1 = await getDocs(q1);
      snaps = s1.docs;
    } catch {
      const s2 = await getDocs(collection(db, 'challenges'));
      snaps = s2.docs;
    }

    if (snaps.length) {
      const list = snaps.map(mapChallengeDoc).filter(Boolean) as ChallengeDoc[];
      if (list.length) return { list, source: 'remote' };
    }
    return { list: LOCAL_CHALLENGE_SEEDS, source: 'local-fallback' };
  } catch {
    return { list: LOCAL_CHALLENGE_SEEDS, source: 'local-fallback' };
  }
}

// Optional: dev-only seeding (never runs in release unless you force-enable + are in dev)
const DEV_SEED_ENABLED =
  typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_ENABLE_SEED === '1';

export async function seedChallengesIfEnabled(db: Firestore) {
  if (!DEV_SEED_ENABLED) return { ok: true, skipped: true as const };
  const batch = writeBatch(db);
  const colRef = collection(db, 'challenges');
  const now = serverTimestamp();
  for (const c of LOCAL_CHALLENGE_SEEDS) {
    batch.set(
      doc(colRef, c.slug),
      { ...c, active: true, createdAt: now, updatedAt: now },
      { merge: true }
    );
  }
  await batch.commit();
  return { ok: true, skipped: false as const, count: LOCAL_CHALLENGE_SEEDS.length };
}

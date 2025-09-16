// utils/seedchallenges.ts
// Weekly rotation + tier gating. Designed for both dev & production.

export type ChallengeTier = 'base' | '10' | '25' | '50';
export type ChallengeCategory = 'date' | 'kindness' | 'conversation' | 'surprise' | 'play';

export type SeedChallenge = {
  id: string;
  title: string;
  description: string;
  category: ChallengeCategory;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;                // recommended award for completion
  tier: ChallengeTier;           // gate tier (base/10/25/50)
  premiumOnly?: boolean;         // true => only for premium
};

// ---- pool (add as many as you like; rotation picks from here) ----
export const CHALLENGE_POOL: SeedChallenge[] = [
  // BASE – light bonding, instantly available to premium
  {
    id: 'base_sunrise_walk',
    title: 'Sunrise Walk Together',
    description: 'Wake up early, grab a warm drink, and catch the sunrise while holding hands.',
    category: 'date', difficulty: 'easy', points: 2, tier: 'base'
  },
  {
    id: 'base_gratitude_trade',
    title: 'Gratitude Trade (3×3)',
    description: 'Each partner shares 3 things they’re grateful for about the other—no repeats!',
    category: 'conversation', difficulty: 'easy', points: 2, tier: 'base'
  },
  {
    id: 'base_screen_free_dinner',
    title: 'Screen-Free Dinner',
    description: 'Cook or order in, but put phones away. Light a candle and ask one deep question.',
    category: 'date', difficulty: 'easy', points: 2, tier: 'base'
  },
  {
    id: 'base_music_memory',
    title: 'Our Song',
    description: 'Build a tiny playlist (5 songs) that remind you of each other. Listen together.',
    category: 'play', difficulty: 'easy', points: 2, tier: 'base'
  },

  // 10-point TIER – more effort, deeper bonding
  {
    id: '10_secret_kindness',
    title: 'Secret Act of Kindness',
    description: 'Do something thoughtful for your partner without telling them. Let them find it.',
    category: 'kindness', difficulty: 'medium', points: 3, tier: '10'
  },
  {
    id: '10_storytime_childhood',
    title: 'Storytime: Childhood',
    description: 'Share 3 childhood stories you’ve never told before—sweet, funny, or awkward!',
    category: 'conversation', difficulty: 'medium', points: 3, tier: '10'
  },
  {
    id: '10_mini_picnic',
    title: 'Mini Picnic',
    description: 'Pack 3 snacks and a blanket. Head to a park for a 30-minute micro-date.',
    category: 'date', difficulty: 'medium', points: 3, tier: '10'
  },

  // 25-point TIER – creative & bonding
  {
    id: '25_cook_new_recipe',
    title: 'Cook a New Recipe',
    description: 'Pick a cuisine you rarely eat, shop together, and cook something new.',
    category: 'play', difficulty: 'medium', points: 4, tier: '25'
  },
  {
    id: '25_memory_map',
    title: 'Memory Map',
    description: 'Draw a map of 5 places that mattered in your story. Tell a memory for each.',
    category: 'surprise', difficulty: 'medium', points: 4, tier: '25'
  },
  {
    id: '25_love_letter_swap',
    title: 'Love Letter Swap',
    description: 'Write each other a short letter and read them aloud.',
    category: 'kindness', difficulty: 'medium', points: 4, tier: '25'
  },

  // 50-point TIER – bigger effort
  {
    id: '50_treasure_memories',
    title: 'Treasure Hunt: Our Memories',
    description: 'Create a 5-stop treasure hunt using shared memories. Each clue references a moment.',
    category: 'play', difficulty: 'hard', points: 5, tier: '50'
  },
  {
    id: '50_mystery_mini_date',
    title: 'Mystery Mini-Date',
    description: 'Plan a 1-hour surprise micro-date. Only reveal the meeting point.',
    category: 'date', difficulty: 'medium', points: 4, tier: '50'
  },
  {
    id: '50_home_spa',
    title: 'Home Spa Night',
    description: 'Candles, soft music, tea, foot bath, and 10-minute massage each.',
    category: 'kindness', difficulty: 'hard', points: 5, tier: '50'
  },

  // Premium-only ideas (will never show on free)
  {
    id: 'p_puzzle_letter',
    title: 'Love Letter Puzzle (Premium)',
    description: 'Write a short love letter, cut into 6–8 pieces, and hide them with clues at home.',
    category: 'surprise', difficulty: 'medium', points: 4, tier: 'base', premiumOnly: true,
  },
];

// ---- rotation & selection logic ----

function weekKey(d = new Date()) {
  // ISO week number (YYYY-WW)
  const temp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (temp.getUTCDay() + 6) % 7;
  temp.setUTCDate(temp.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(temp.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((temp.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${temp.getUTCFullYear()}-${String(week).padStart(2, '0')}`;
}

// small seeded rng (mulberry32)
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle<T>(arr: T[], seed: string) {
  const s = seed.split('').reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 0);
  const rand = mulberry32(s || 1);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type Plan = 'free' | 'premium';

export type ChallengeSelectionConfig = {
  baseCount: number;     // visible immediately (premium)
  at10Count: number;     // unlocked at 10 points
  at25Count: number;     // unlocked at 25 points
  at50Count: number;     // unlocked at 50 points
};

export const DEFAULT_SELECTION: ChallengeSelectionConfig = {
  baseCount: 4,
  at10Count: 3,
  at25Count: 3,
  at50Count: 3,
};

export function getWeeklyChallengeSet(opts: {
  plan: Plan;
  weeklyPoints: number;
  uid: string;
  pool?: SeedChallenge[];
  config?: ChallengeSelectionConfig;
  now?: Date;
}) {
  const {
    plan,
    weeklyPoints,
    uid,
    pool = CHALLENGE_POOL,
    config = DEFAULT_SELECTION,
    now = new Date(),
  } = opts;

  const key = `${uid}-${weekKey(now)}`;
  const shuffled = seededShuffle(pool, key);

  if (plan === 'free') {
    // Only 1 visible challenge. Hide everything else.
    const firstNonPremium = shuffled.find((c) => !c.premiumOnly) ?? shuffled[0];
    return {
      visible: [firstNonPremium],
      locked: [] as SeedChallenge[],
      hiddenForPlan: shuffled.filter((c) => c.id !== firstNonPremium.id),
    };
  }

  // Premium: pick by tiers, progressively harder
  const byTier = (tier: ChallengeTier) =>
    shuffled.filter((c) => c.tier === tier && !c.premiumOnly);

  const take = <T,>(arr: T[], n: number) => arr.slice(0, Math.max(0, n));

  const visible: SeedChallenge[] = [];
  const locked: SeedChallenge[] = [];

  // base
  visible.push(...take(byTier('base'), config.baseCount));

  // 10
  const tier10 = take(byTier('10'), config.at10Count);
  if (weeklyPoints >= 10) visible.push(...tier10);
  else locked.push(...tier10);

  // 25
  const tier25 = take(byTier('25'), config.at25Count);
  if (weeklyPoints >= 25) visible.push(...tier25);
  else locked.push(...tier25);

  // 50
  const tier50 = take(byTier('50'), config.at50Count);
  if (weeklyPoints >= 50) visible.push(...tier50);
  else locked.push(...tier50);

  // Premium-only extras (optional): include as base extras
  const premiumExtras = shuffled.filter((c) => c.premiumOnly);
  visible.push(...take(premiumExtras, 2)); // show a couple each week

  return { visible, locked, hiddenForPlan: [] as SeedChallenge[] };
}

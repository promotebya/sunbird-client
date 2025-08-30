// utils/surprises.ts
export function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const ideas = [
  "Send a spontaneous voice note saying 3 things you love about them.",
  "Plan a 20-minute walk together today.",
  "Hide a sticky note with a cute doodle where they'll find it.",
  "Share a throwback photo + a short memory caption.",
  "Make their favorite drink and deliver it unexpectedly.",
  "Write a mini haiku about them and text it.",
  "Queue a shared playlist with 3 songs that remind you of them.",
  "Book a quick 30-min 'phone-date' tonight.",
  "Set a timer for 10 minutes of pure compliments.",
  "Give them a 'coupon' they can redeem this week.",
];

export function surpriseIdea(): string {
  return randomItem(ideas);
}

/** Optional: quick task suggestion with default points */
export function surpriseTask() {
  const tasks = [
    { title: "Make breakfast in bed", points: 20 },
    { title: "Do their least favorite chore", points: 15 },
    { title: "Plan a mini date tonight", points: 25 },
    { title: "Write a love note", points: 10 },
  ];
  return randomItem(tasks);
}

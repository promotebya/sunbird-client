// utils/generator.ts
export type Prefs = {
  budget: 'low' | 'medium' | 'high';
  timeBlock: 'short' | 'evening' | 'fullDay';
  vibes: string[];
  indoors: boolean;
  loves: string[];
};

const poolDates = [
  "Sunset walk + photo swap",
  "At-home tasting night (tea/coffee/chocolate)",
  "Board-game café date",
  "DIY pizza & playlist exchange",
  "Thrift-store gift challenge (€10)",
  "Mini road trip to a random pin",
  "Museum + ice cream stroll",
  "Picnic with three compliments each",
  "Cook a recipe from your childhoods",
  "Coffee crawl (2 cafés, 1 bakery)"
];

const poolGifts = [
  "Custom coupon book",
  "Framed photo with a handwritten note",
  "Personalized playlist card",
  "DIY spice mix with your story",
  "Little scavenger hunt at home",
  "A ‘reasons I adore you’ jar"
];

function weightDate(s: string, p: Prefs) {
  let w = 1;
  if (p.indoors && /home|at-home|pizza|movie|board/i.test(s)) w += 1;
  if (!p.indoors && /walk|trip|museum|picnic|stroll/i.test(s)) w += 1;
  if (p.budget === 'low' && /thrift|walk|picnic|home|playlist|pizza/i.test(s)) w += 1;
  if (p.timeBlock === 'short' && /walk|café|home|museum/i.test(s)) w += 1;
  p.loves.forEach((k) => {
    if (new RegExp(k.split(' ')[0], 'i').test(s)) w += 2;
  });
  return w;
}

export function generateDateIdeas(p: Prefs, count = 6) {
  return poolDates
    .slice()
    .sort((a, b) => weightDate(b, p) - weightDate(a, p))
    .slice(0, count);
}

export function generateGiftIdeas(_p: Prefs, count = 4) {
  return poolGifts.slice(0, count);
}

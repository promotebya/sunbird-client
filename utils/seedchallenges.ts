// utils/seedchallenges.ts
// Seeded weekly challenge rotation + plan/points gating that matches ChallengesScreen.

export type DiffKey = 'easy' | 'medium' | 'hard' | 'pro';
export type Category = 'date' | 'kindness' | 'conversation' | 'surprise' | 'play';
export type Tier = 'base' | '10' | '25' | '50';

export type SeedChallenge = {
  id: string;
  title: string;
  description: string;
  category: Category;     // primary category (for chips/filter)
  difficulty: DiffKey;    // easy | medium | hard | pro
  points: number;         // reward on completion (display in UI)
  // NOTE: 'tier' is added by the selector so the UI can show lock reasons.
  tier?: Tier;
  premiumOnly?: boolean;
};

// ---------------------------------------------------------------------------
// Rotation helpers (deterministic per user and per week) --------------------

function hash(s: string): number {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function isoWeekKey(d: Date = new Date()): string {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - day + 3);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(
    ((dt.getTime() - yearStart.getTime()) / 86400000 - 3 + ((yearStart.getUTCDay() + 6) % 7)) / 7
  );
  return `${dt.getUTCFullYear()}-${String(week).padStart(2, '0')}`;
}
function pickRotate<T>(arr: T[], count: number, seedNum: number): T[] {
  if (!arr.length || count <= 0) return [];
  const start = seedNum % arr.length;
  const out: T[] = [];
  for (let i = 0; i < Math.min(count, arr.length); i++) {
    out.push(arr[(start + i) % arr.length]);
  }
  return out;
}
function withTier(c: SeedChallenge, tier: Tier): SeedChallenge {
  return { ...c, tier };
}

// ---------------------------------------------------------------------------
// EASY — “Tender Moments” (50)  points: 5
// ---------------------------------------------------------------------------

export const EASY_TENDER: SeedChallenge[] = [
  { id: 'easy-01', title: 'Two-Song Slowdance (date)', description: 'Turn off the lights, put on two songs, slowdance in the kitchen—no phones, no talking.', category: 'date', difficulty: 'easy', points: 5 },
  { id: 'easy-02', title: 'Gratitude 3×3 (conversation)', description: 'Each shares 3 tiny things you appreciated about today—keep it specific and small.', category: 'conversation', difficulty: 'easy', points: 5 },
  { id: 'easy-03', title: 'Window View Date (date)', description: 'Sit by a window/balcony for 10 minutes, sip something warm, and quietly point out three little things you notice together.', category: 'date', difficulty: 'easy', points: 5 },
  { id: 'easy-04', title: 'Compliment Sticky (kindness)', description: 'Write one sincere compliment on a sticky note and place it where they’ll find it soon.', category: 'kindness', difficulty: 'easy', points: 5 },
  { id: 'easy-05', title: 'Plot Guess & Treat Night (date; 5 pts)', description: 'Mute one random trailer and each write a two-sentence plot guess. Then watch the movie (or the first 20 minutes) to check your guesses; whoever’s closer earns a treat of their choice.', category: 'date', difficulty: 'easy', points: 5 },
  { id: 'easy-06', title: 'Snack Tapas (date)', description: 'Build a five-item snack board from whatever’s at home (no cooking allowed). Name each bite.', category: 'date', difficulty: 'easy', points: 5 },
  { id: 'easy-07', title: 'Turn-Down Service (kindness)', description: 'Make their side of the bed hotel-cozy: fluffed pillow, folded blanket edge, tiny note.', category: 'kindness', difficulty: 'easy', points: 5 },
  { id: 'easy-08', title: 'One-Photo Story (conversation)', description: 'Find one photo of you two and tell a 60-second story around it—add one new detail.', category: 'conversation', difficulty: 'easy', points: 5 },
  { id: 'easy-09', title: '10-Minute Reset Relay (kindness)', description: 'Set a 10-minute timer. First 5 minutes: you tidy a spot your partner cares about; next 5: they do one for you. High-five + light a candle.', category: 'kindness', difficulty: 'easy', points: 5 },
  { id: 'easy-10', title: 'Two-Knot Promise Bands (kindness/creative)', description: 'Cut two simple cords (thread, yarn, or ribbon). Each partner ties two knots in the other’s band: one for a gratitude, one for a promise this week. Tie them on each other’s wrist and name the bands. Wear for seven days.', category: 'kindness', difficulty: 'easy', points: 5 },
  { id: 'easy-11', title: 'Compliment Echo (conversation)', description: 'Echo back the compliment you received today, but add a custom tag about them.', category: 'conversation', difficulty: 'easy', points: 5 },
  { id: 'easy-12', title: 'Phone-Free Walk (date)', description: '10-minute loop outside without phones. Pick one “secret detail” to point out.', category: 'date', difficulty: 'easy', points: 5 },
  { id: 'easy-13', title: 'Playlist Post-It (surprise)', description: 'Write a 3-song micro-playlist on a note (“for mornings” / “for courage”).', category: 'surprise', difficulty: 'easy', points: 5 },
  { id: 'easy-14', title: 'Morning-Boost Kit (kindness)', description: 'Lay out tomorrow’s essentials (keys, mask, lip balm, snack) in a neat “launch pad.”', category: 'kindness', difficulty: 'easy', points: 5 },
  { id: 'easy-15', title: 'Doorway Hug Rule — All Week (kindness)', description: 'A 7-second hug every time someone arrives or leaves during this entire challenge week.', category: 'kindness', difficulty: 'easy', points: 5 },
  { id: 'easy-16', title: 'Mini Treasure Hunt (surprise)', description: 'Hide a tiny treat with three simple clues on sticky notes leading to it.', category: 'surprise', difficulty: 'easy', points: 5 },
  { id: 'easy-17', title: '60-Second Love Note (Audio) (surprise)', description: 'Record a quick voice memo listing three things you adore and send it.', category: 'surprise', difficulty: 'easy', points: 5 },
  { id: 'easy-18', title: 'Floor Picnic Ten (date)', description: 'Spread a scarf on the floor; each brings one snack and one question card. Set a 10-minute timer for a tiny indoor picnic with one song playing.', category: 'date', difficulty: 'easy', points: 5 },
  { id: 'easy-19', title: 'Shadow Story Theater (play/surprise)', description: 'Aim a lamp at a blank wall and dim the room. Using only hand shadows (or a few simple cutouts), each performs a 60-second “how we met” scene.', category: 'play', difficulty: 'easy', points: 5 },
  { id: 'easy-20', title: 'Gratitude Ping-Pong (conversation)', description: 'You say one “thank you for…”, they respond with one. Go to five each.', category: 'conversation', difficulty: 'easy', points: 5 },
  { id: 'easy-21', title: 'Doodle Their Day (play)', description: 'Draw a silly 30-second doodle of their day. Swap and caption them.', category: 'play', difficulty: 'easy', points: 5 },
  { id: 'easy-22', title: 'Warm Hands, Warm Hearts (conversation)', description: 'Hold both hands for one minute; name one thing you need less of and more of this week.', category: 'conversation', difficulty: 'easy', points: 5 },
  { id: 'easy-23', title: 'Blind-Contour Portrait Swap (date)', description: 'Sit face-to-face with a pen and paper. Without looking at the page, draw your partner’s portrait in 60 seconds; do a second round with your non-dominant hand. Sign the funniest one and tape it up.', category: 'date', difficulty: 'easy', points: 5 },
  { id: 'easy-24', title: 'Ping in Threes (surprise)', description: 'Send three surprises today: 1 meme, 1 “remember when…” photo, and 1 tiny plan (emoji itinerary). Spread them through the day.', category: 'surprise', difficulty: 'easy', points: 5 },
  { id: 'easy-25', title: 'Song Swap Mini (date)', description: 'Each picks 1 song “you should hear today.” Listen fully, eyes closed.', category: 'date', difficulty: 'easy', points: 5 },
  { id: 'easy-26', title: 'Fruit Plate Art — Pack & Surprise (play)', description: 'Arrange fruit into a cute shape, box it for your partner’s next-day break, and add a sticky-note title.', category: 'play', difficulty: 'easy', points: 5 },
  { id: 'easy-27', title: 'One-Line Apology (conversation)', description: 'Each writes one sentence you’d like to hear when things are tense. Keep it.', category: 'conversation', difficulty: 'easy', points: 5 },
  { id: 'easy-28', title: 'Five-Sentence Story (play)', description: 'Write a 5-sentence meet-cute about “us in another universe.” Read aloud.', category: 'play', difficulty: 'easy', points: 5 },
  { id: 'easy-29', title: 'Compliment Mirror (conversation)', description: 'Stand together in a mirror and each say one thing you love you see.', category: 'conversation', difficulty: 'easy', points: 5 },
  { id: 'easy-30', title: 'Mug Swap (kindness)', description: 'Make them a warm drink in the cup they love. Trade first sip opinions.', category: 'kindness', difficulty: 'easy', points: 5 },
  { id: 'easy-31', title: 'Two-Question Check-In (conversation)', description: 'Ask: “How’s your energy?” and “What would help tonight?” Act on one answer.', category: 'conversation', difficulty: 'easy', points: 5 },
  { id: 'easy-32', title: 'Hum-That-Tune (play)', description: 'Hum (no lyrics!) 5 short songs; the other guesses. Winner gets the last snack.', category: 'play', difficulty: 'easy', points: 5 },
  { id: 'easy-33', title: 'Indoor Starfield (date)', description: 'Turn off the lights and make “stars” by shining a phone light through a colander onto the ceiling. Name three constellations after inside jokes and snap a pic.', category: 'date', difficulty: 'easy', points: 5 },
  { id: 'easy-34', title: 'Photo Favorites (surprise)', description: 'Pick 3 photos of your partner you love and say why. Save to a shared album.', category: 'surprise', difficulty: 'easy', points: 5 },
  { id: 'easy-35', title: 'Pictionary: Us Edition (play)', description: 'Draw three inside jokes or shared memories; the other guesses each one.', category: 'play', difficulty: 'easy', points: 5 },
  { id: 'easy-36', title: 'Step Outside (date)', description: 'Step out the door together for 3 minutes, look up, name one cloud/constellation.', category: 'date', difficulty: 'easy', points: 5 },
  { id: 'easy-37', title: 'Love in 5 Emojis (surprise)', description: 'Send 5 emojis that summarize today; the other replies with a title.', category: 'surprise', difficulty: 'easy', points: 5 },
  { id: 'easy-38', title: 'Couch Stretch Stack (kindness)', description: 'Trade a 5-minute neck/shoulder massage. Timer on. Switch at the beep.', category: 'kindness', difficulty: 'easy', points: 5 },
  { id: 'easy-39', title: 'Tiny Book Club (conversation)', description: 'Read a very short poem or paragraph out loud; each shares one thought.', category: 'conversation', difficulty: 'easy', points: 5 },
  { id: 'easy-40', title: 'Fridge Chef (play)', description: 'Assemble one new snack from 3 random items. Give it a fancy menu name.', category: 'play', difficulty: 'easy', points: 5 },
  { id: 'easy-41', title: 'Walk & Talk Question (conversation)', description: 'Take a 10-minute walk and answer: “What would make next week gentler?”', category: 'conversation', difficulty: 'easy', points: 5 },
  { id: 'easy-42', title: 'Memory Three-Pack (conversation)', description: 'Each shares 3 tiny moments you loved from the last month.', category: 'conversation', difficulty: 'easy', points: 5 },
  { id: 'easy-43', title: 'Binge Bite (date)', description: 'Choose a show watch cuddled under one blanket.', category: 'date', difficulty: 'easy', points: 5 },
  { id: 'easy-44', title: 'Couch Passport (date)', description: 'Pick a country, watch a 3–5 min travel clip, then improvise a tiny themed snack or drink together.', category: 'date', difficulty: 'easy', points: 5 },
  { id: 'easy-45', title: 'One New Song (play)', description: 'Shuffle a genre you never play, then save 1 song you both vibe with.', category: 'play', difficulty: 'easy', points: 5 },
  { id: 'easy-46', title: 'Rose • Bud • Thorn (conversation)', description: 'Each shares: today’s highlight, one thing you’re looking forward to, and one small thorn.', category: 'conversation', difficulty: 'easy', points: 5 },
  { id: 'easy-47', title: 'Pocket Sunshine (kindness)', description: 'Hide a tiny encouraging note where they’ll find it (wallet, bag, coat pocket).', category: 'kindness', difficulty: 'easy', points: 5 },
  { id: 'easy-48', title: 'Five-Minute Fort (play)', description: 'Throw a blanket over two chairs and crawl in for a quick cuddle/chat.', category: 'play', difficulty: 'easy', points: 5 },
  { id: 'easy-49', title: 'Warm the Mug (kindness)', description: 'Pre-warm their cup and make a simple drink without asking; deliver it with a smile.', category: 'kindness', difficulty: 'easy', points: 5 },
  { id: 'easy-50', title: 'One Photo Later (surprise)', description: 'Take a sweet selfie now and set a reminder to recreate it in 6 months.', category: 'surprise', difficulty: 'easy', points: 5 },
];

// ---------------------------------------------------------------------------
// MEDIUM — “Heart to Heart” (50)  points: 10
// ---------------------------------------------------------------------------

export const MEDIUM_HEART: SeedChallenge[] = [
  { id: 'med-01', title: 'Story Swap Walk (date)', description: 'Take a 20-minute walk and each tell one story you’ve never shared.', category: 'date', difficulty: 'medium', points: 10 },
  { id: 'med-02', title: 'Cookbook Lottery (date)', description: 'Open a cookbook (or site), pick a random recipe, and adapt it with only what you have.', category: 'date', difficulty: 'medium', points: 10 },
  { id: 'med-03', title: 'Two Chairs, One Topic (conversation)', description: 'Set a 10-minute timer; explore one meaty topic with no phones.', category: 'conversation', difficulty: 'medium', points: 10 },
  { id: 'med-04', title: '$10 Market Mission — Remix (date)', description: 'Each builds a small basket of ingredients totaling under $10. Combine both baskets into a surprise snack.', category: 'date', difficulty: 'medium', points: 10 },
  { id: 'med-05', title: 'Memory Map (play)', description: 'Sketch a simple map of places tied to “us,” then add one place you want to create next.', category: 'play', difficulty: 'medium', points: 10 },
  { id: 'med-06', title: 'Camera Swap Director (date)', description: 'Each directs three 5-second clips starring your partner; stitch into a mini trailer.', category: 'date', difficulty: 'medium', points: 10 },
  { id: 'med-07', title: 'Dream Tiny House (play)', description: 'Draw a mini floor plan for a 300-sq-ft “someday retreat.”', category: 'play', difficulty: 'medium', points: 10 },
  { id: 'med-08', title: 'Compliment Courtroom (conversation)', description: 'Hold a playful “trial” proving why your partner is awesome using 5 pieces of “evidence.”', category: 'conversation', difficulty: 'medium', points: 10 },
  { id: 'med-09', title: 'Love Languages Mini (conversation)', description: 'Guess each other’s top two, then plan one act for each.', category: 'conversation', difficulty: 'medium', points: 10 },
  { id: 'med-10', title: 'Foreign Film First 15 (date)', description: 'Watch only the first 15 minutes with subtitles; predict the ending together.', category: 'date', difficulty: 'medium', points: 10 },
  { id: 'med-11', title: '30-Second Music-Video (play)', description: 'Pick 30 seconds of a song. Sketch 3 shots, film on your phones, and premiere your mini music video.', category: 'play', difficulty: 'medium', points: 10 },
  { id: 'med-12', title: 'Mystery Ingredient Duel (date)', description: 'Each picks a secret pantry item; craft dueling bite-sized dishes in 15 minutes.', category: 'date', difficulty: 'medium', points: 10 },
  { id: 'med-13', title: 'The Swap-Task Day (kindness)', description: 'Trade chores for the day and over-deliver on one detail.', category: 'kindness', difficulty: 'medium', points: 10 },
  { id: 'med-14', title: 'Gratitude Polaroids (kindness)', description: 'Snap three photos of tiny things you’re grateful for; make a phone album.', category: 'kindness', difficulty: 'medium', points: 10 },
  { id: 'med-15', title: 'Voice-Memo Bedtime (surprise)', description: 'Record a 2-minute “once upon a time about us” and send it.', category: 'surprise', difficulty: 'medium', points: 10 },
  { id: 'med-16', title: 'Future Weekend Draft (conversation)', description: 'Draft three future weekend outlines; pick one to schedule.', category: 'conversation', difficulty: 'medium', points: 10 },
  { id: 'med-17', title: 'Plan B-in-a-Box (kindness)', description: 'Pack tiny “comfort kits” for each other; swap and stash in your bags.', category: 'kindness', difficulty: 'medium', points: 10 },
  { id: 'med-18', title: 'Secret Language Handshake (play)', description: 'Invent a 3-step handshake + one code word with a silly backstory.', category: 'play', difficulty: 'medium', points: 10 },
  { id: 'med-19', title: 'One-Minute Mini-Doc (date)', description: 'Direct a 60-second documentary about one of your partner’s cherished objects.', category: 'date', difficulty: 'medium', points: 10 },
  { id: 'med-20', title: 'Playlist Postcards (surprise)', description: 'Exchange 5-song playlists for a mood you want to share this week.', category: 'surprise', difficulty: 'medium', points: 10 },
  { id: 'med-21', title: 'Postcard to Future Us (surprise)', description: 'Write and stamp a postcard to open in 6 months; hide it with a reminder.', category: 'surprise', difficulty: 'medium', points: 10 },
  { id: 'med-22', title: 'Signal Book (conversation)', description: 'Create a 6-item codebook for “miss you,” “need hug,” “let’s leave,” “I’m proud,” “SOS,” + one inside joke.', category: 'conversation', difficulty: 'medium', points: 10 },
  { id: 'med-23', title: 'DIY Mocktail Lab (date)', description: 'Invent and name two mocktails; crown a winner.', category: 'date', difficulty: 'medium', points: 10 },
  { id: 'med-24', title: 'Room Makeover: Scene Setting (date)', description: 'Curate tonight’s vibe (light, scent, playlist); name the “scene” and enter in character.', category: 'date', difficulty: 'medium', points: 10 },
  { id: 'med-25', title: 'Trivia: About Us (play)', description: 'Make 10 questions about your history; loser owes a hug stack (3 hugs).', category: 'play', difficulty: 'medium', points: 10 },
  { id: 'med-26', title: 'Nostalgia Swap (conversation)', description: 'Share a childhood photo and tell the untold backstory.', category: 'conversation', difficulty: 'medium', points: 10 },
  { id: 'med-27', title: 'Local Tourist Hour (date)', description: 'Visit a nearby spot you’ve always skipped (bridge, mural, tiny museum).', category: 'date', difficulty: 'medium', points: 10 },
  { id: 'med-28', title: '$5 Gift Draft (surprise)', description: 'Speed-create the best sub-$5 gift; present with a flourish.', category: 'surprise', difficulty: 'medium', points: 10 },
  { id: 'med-29', title: 'Complaints → Wishes (conversation)', description: 'Rewrite three recurring gripes into positive requests.', category: 'conversation', difficulty: 'medium', points: 10 },
  { id: 'med-30', title: 'Fate Deck: Dare or Care (play)', description: 'Make a 12-card mini-deck (6 dares, 6 caring acts); draw three and do them.', category: 'play', difficulty: 'medium', points: 10 },
  { id: 'med-31', title: 'Closet Runway (play)', description: 'Style each other an outfit from existing clothes; do a 10-step catwalk.', category: 'play', difficulty: 'medium', points: 10 },
  { id: 'med-32', title: 'Pulse-Sync Minute (conversation)', description: 'Sit back-to-back, sync breathing for 60 seconds; share one feeling and one wish.', category: 'conversation', difficulty: 'medium', points: 10 },
  { id: 'med-33', title: 'Audio Clue Hunt (surprise)', description: 'Record 3 voice-note clues on your phone. Send them one by one to lead your partner to a tiny prize or message hidden at home.', category: 'surprise', difficulty: 'medium', points: 10 },
  { id: 'med-34', title: 'Switcheroo Task (kindness)', description: 'Swap a routine for tonight; do it exactly their way—ask for a two-tip “pro guide.”', category: 'kindness', difficulty: 'medium', points: 10 },
  { id: 'med-35', title: 'Micro-Volunteer Sprint (kindness)', description: 'Give 30 minutes to a cause (letters, pickup, pantry sort).', category: 'kindness', difficulty: 'medium', points: 10 },
  { id: 'med-36', title: 'Planetarium at Home (date)', description: '15-minute space video + stargaze with one wish each.', category: 'date', difficulty: 'medium', points: 10 },
  { id: 'med-37', title: 'Duo Vision Board (play)', description: 'Make a collage for one theme: “our next 90 days.”', category: 'play', difficulty: 'medium', points: 10 },
  { id: 'med-38', title: 'Good-News Exchange (conversation)', description: 'Each brings two uplifting news items; discuss why they mattered.', category: 'conversation', difficulty: 'medium', points: 10 },
  { id: 'med-39', title: 'Compliment Supercut (play)', description: 'Make five playful awards (e.g., “Best Morning Hype”). Record 5–10s “acceptance speeches,” then stitch clips into a 60-second supercut.', category: 'play', difficulty: 'medium', points: 10 },
  { id: 'med-40', title: 'Mime Morning (play)', description: 'For 10 minutes communicate only with gestures; debrief what was easy/hard.', category: 'play', difficulty: 'medium', points: 10 },
  { id: 'med-41', title: 'Guardian Angel Notes (kindness)', description: 'Write tiny “I’ve got you” promises; tuck into each other’s wallet.', category: 'kindness', difficulty: 'medium', points: 10 },
  { id: 'med-42', title: 'Compliment Sticky Trail (kindness)', description: 'Hide seven sticky compliments along their morning path.', category: 'kindness', difficulty: 'medium', points: 10 },
  { id: 'med-43', title: 'Phone Photo Booth (date)', description: 'Recreate four classic photo-booth poses; print later if you can.', category: 'date', difficulty: 'medium', points: 10 },
  { id: 'med-44', title: 'Soundtrack Scene Swap (date)', description: 'Mute a random scene and overdub your own dialogue or score it live.', category: 'date', difficulty: 'medium', points: 10 },
  { id: 'med-45', title: 'Culture-Snack Swap (date)', description: 'Pick two international snacks; taste-test and rate.', category: 'date', difficulty: 'medium', points: 10 },
  { id: 'med-46', title: 'Values Cards Lite (conversation)', description: 'Rank 10 values; share top 3 and one tiny way to live them this week.', category: 'conversation', difficulty: 'medium', points: 10 },
  { id: 'med-47', title: 'Heartbeat Telegram (conversation)', description: 'Tap your initials on their wrist in Morse; teach a simple “thinking of you” tap.', category: 'conversation', difficulty: 'medium', points: 10 },
  { id: 'med-48', title: 'Compliment Switchboard (play)', description: 'Write 5 “call lines” (e.g., Press 2 for a hype speech); take turns “dialing.”', category: 'play', difficulty: 'medium', points: 10 },
  { id: 'med-49', title: 'Dream-Trip Day Plan (date)', description: 'Choose a city and draft a 24-hour itinerary you’d actually do.', category: 'date', difficulty: 'medium', points: 10 },
  { id: 'med-50', title: 'Banner of the Brave (play)', description: 'Craft a tiny paper banner honoring shared “wins”; hang it in your space.', category: 'play', difficulty: 'medium', points: 10 },
];

// ---------------------------------------------------------------------------
// HARD — “Passionate Quests” (50)  points: 15
// ---------------------------------------------------------------------------

export const HARD_PASSIONATE: SeedChallenge[] = [
  { id: 'hard-01', title: 'Urban Photo Essay (date)', description: '60 minutes to shoot an 8-photo series titled “Us in the Wild.” Pick one favorite each and write a one-line caption.', category: 'date', difficulty: 'hard', points: 15 },
  { id: 'hard-02', title: 'GPS Heart Walk (play)', description: 'Use a maps app to trace a simple heart (or your initials) with your walking route. Screenshot the shape when done and give it a title.', category: 'play', difficulty: 'hard', points: 15 },
  { id: 'hard-03', title: 'Silent-Disco Walk (date)', description: 'Share earbuds, queue 4 songs, and choreograph tiny moves at 4 landmarks. Film 3-second clips and merge.', category: 'date', difficulty: 'hard', points: 15 },
  { id: 'hard-04', title: '24-Panel Comic of Us (play)', description: 'Draw a one-page comic (24 tiny panels) of your day; hang it like a gallery piece.', category: 'play', difficulty: 'hard', points: 15 },
  { id: 'hard-05', title: 'Blindfold Taste Tour (play)', description: 'Curate 8 bites; blindfold partner; guess ingredients.', category: 'play', difficulty: 'hard', points: 15 },
  { id: 'hard-06', title: 'Street Portrait Swap (date)', description: 'Style each other and shoot 12 street portraits; edit & print 3.', category: 'date', difficulty: 'hard', points: 15 },
  { id: 'hard-07', title: 'Ten-Question Twilight Walk (conversation)', description: 'Write 10 unusual questions (e.g., “What habit do you hope future-us keeps?”). Take a 45-minute walk and discuss them', category: 'conversation', difficulty: 'hard', points: 15 },
  { id: 'hard-08', title: 'Reverse-Day Role Swap (kindness)', description: 'Swap styles for an evening; stay in character; debrief at bedtime.', category: 'kindness', difficulty: 'hard', points: 15 },
  { id: 'hard-09', title: 'Home Restaurant Pop-Up (date)', description: '3-course tasting with a theme & handwritten menu + one table-side story.', category: 'date', difficulty: 'hard', points: 15 },
  { id: 'hard-10', title: 'Magazine Cover Shoot (date)', description: 'Style outfits and shoot a mock magazine cover; add cheeky cover lines.', category: 'date', difficulty: 'hard', points: 15 },
  { id: 'hard-11', title: 'Device Detox + Journal (conversation)', description: 'Two-hour phone-free window with a shared mini-journal.', category: 'conversation', difficulty: 'hard', points: 15 },
  { id: 'hard-12', title: 'Coin-Flip Quest (play)', description: 'For 30 minutes, flip a coin at each intersection (heads = right, tails = left). Collect one token per stop (photo, receipt) and recap.', category: 'play', difficulty: 'hard', points: 15 },
  { id: 'hard-13', title: 'Flash-Fiction Swap (play)', description: '300-word first-meeting retell from a bystander’s view; perform with a prop.', category: 'play', difficulty: 'hard', points: 15 },
  { id: 'hard-14', title: '12-Photo Love Odyssey (date)', description: 'Shoot a 12-frame story; grid + tiny captions; print one for the fridge.', category: 'date', difficulty: 'hard', points: 15 },
  { id: 'hard-15', title: 'Around-the-World Tapas (date)', description: 'Create 3 bite-size dishes inspired by 3 countries; menu card + backstory.', category: 'date', difficulty: 'hard', points: 15 },
  { id: 'hard-16', title: 'Memory Box Build (surprise)', description: 'Curate 7 objects with titles & one-line memories.', category: 'surprise', difficulty: 'hard', points: 15 },
  { id: 'hard-17', title: 'Kindness Relay (kindness)', description: 'Chain 5 helpful acts across a day; “relay baton” selfie.', category: 'kindness', difficulty: 'hard', points: 15 },
  { id: 'hard-18', title: 'Secret Language 2.0 (play)', description: 'Extend your handshake to 6 moves + 3 code phrases + one emoji.', category: 'play', difficulty: 'hard', points: 15 },
  { id: 'hard-19', title: 'Chef vs. Curator (date)', description: 'One picks art; the other cooks inspired dish; 60-sec curator talk.', category: 'date', difficulty: 'hard', points: 15 },
  { id: 'hard-20', title: 'Sunrise Chase (date)', description: 'Scout, thermos, tiny notes to read as light breaks.', category: 'date', difficulty: 'hard', points: 15 },
  { id: 'hard-21', title: '30 Questions Deep Dive (conversation)', description: '30 prompts; alternate 60-sec answers with one follow-up each.', category: 'conversation', difficulty: 'hard', points: 15 },
  { id: 'hard-22', title: 'Park Picnic Lab (play)', description: 'Build a $10 picnic from a corner store: 1 fruit, 1 crunchy, 1 drink, 1 surprise. Write a 3-line nature note before eating.', category: 'play', difficulty: 'hard', points: 15 },
  { id: 'hard-23', title: 'Transit Roulette (date)', description: 'Take first bus/train for 3 stops; explore 45 minutes: wander, new café, find a local quirk, chat with a local, snap a souvenir photo.', category: 'date', difficulty: 'hard', points: 15 },
  { id: 'hard-24', title: '$10 One-Hour Surprise Dash (surprise)', description: 'Each gets $10 and 60 minutes to craft one micro-experience.', category: 'surprise', difficulty: 'hard', points: 15 },
  { id: 'hard-25', title: 'Recipe From Memory (date)', description: 'Re-create a childhood snack from memory only; plate + three “chef notes.”', category: 'date', difficulty: 'hard', points: 15 },
  { id: 'hard-26', title: 'Blind Build Relay (play)', description: 'Sit back-to-back with blocks/LEGO or household items. Round 1: Builder describes while Partner builds without looking. Round 2: swap roles with a new design. Reveal & rate.', category: 'play', difficulty: 'hard', points: 15 },
  { id: 'hard-27', title: 'Compliment Time Capsule (surprise)', description: 'Record 10 compliment voice notes; schedule future replays.', category: 'surprise', difficulty: 'hard', points: 15 },
  { id: 'hard-28', title: 'Mystery-Town Picnic Hop (date/adventure)', description: 'Take the first regional stop you’ve never visited (≤45 min away). On arrival, each grabs one local bite from different shops, then find the first pretty outdoor spot to picnic. Swap three first-impression notes about the place and snap a postcard-style selfie before heading home.', category: 'date', difficulty: 'hard', points: 15 },
  { id: 'hard-29', title: 'Book Exchange Pact (conversation)', description: 'Each chooses a book for the other (aim for a slim novel or nonfiction under 250 pages). Both read your assigned books, then sit down to share what you appreciated or learned—trade favorite lines.', category: 'conversation', difficulty: 'hard', points: 15 },
  { id: 'hard-30', title: 'Backyard Constellation Theater (date)', description: 'Project stars, name a new constellation, write a 2-line myth.', category: 'date', difficulty: 'hard', points: 15 },
  { id: 'hard-31', title: 'Compliment Envelope Chain (kindness)', description: '5 sealed envelopes with compliments + mini-tasks; end with a hug + treat.', category: 'kindness', difficulty: 'hard', points: 15 },
  { id: 'hard-32', title: 'Street Food Crawl Map (date)', description: 'Plot 3 cheap eats; score taste, vibe, story.', category: 'date', difficulty: 'hard', points: 15 },
  { id: 'hard-33', title: 'Volunteer Date (kindness)', description: '60–90 minutes helping; debrief.', category: 'kindness', difficulty: 'hard', points: 15 },
  { id: 'hard-34', title: 'Mini Makeover Night (kindness)', description: 'Re-arrange one room for function + cozy; reveal with before/after.', category: 'kindness', difficulty: 'hard', points: 15 },
  { id: 'hard-35', title: 'Pop-Up Museum of Us (surprise)', description: 'Curate 8 objects with title cards + 3-minute audio tour.', category: 'surprise', difficulty: 'hard', points: 15 },
  { id: 'hard-36', title: 'Future Letters (surprise)', description: 'Write letters to open in 1 month and 1 year; calendar reminders.', category: 'surprise', difficulty: 'hard', points: 15 },
  { id: 'hard-37', title: 'Silent Hour + Notes (conversation)', description: 'Communicate only via notes for 60 minutes; keep the best ones.', category: 'conversation', difficulty: 'hard', points: 15 },
  { id: 'hard-38', title: 'Make-Believe City Tour (date/play)', description: 'Each of you curates a 20-minute walking loop near home and becomes an over-the-top tour guide. At 5 mini-stops, deliver a 60-second game mixing one true fact with one outrageous legend (e.g., “This bench? Site of the Great Pigeon Peace Talks”). Hand your partner a tiny scorecard to rate plausibility, charm, and pure nonsense. Swap roles, then trade a sub-$3 “gift shop souvenir” (or a found freebie) to close the tour.', category: 'date', difficulty: 'hard', points: 15 },
  { id: 'hard-39', title: 'Hourglass Quest (3 Stops) (date)', description: '45-minute timer: view & brag, split a $5 snack, record a 10-sec wish.', category: 'date', difficulty: 'hard', points: 15 },
  { id: 'hard-40', title: 'Progressive Apartment Date (date)', description: 'Create 3 “stations” in different rooms (snack, game, craft). Spend 15 minutes at each and stamp a mini “passport.”', category: 'date', difficulty: 'hard', points: 15 },
  { id: 'hard-41', title: 'Adventure Jar (play)', description: '30 slip ideas (free → splurge); draw 3, calendar one.', category: 'play', difficulty: 'hard', points: 15 },
  { id: 'hard-42', title: 'Two-Mic Podcast Mini (conversation)', description: '10-minute “How We Met vs. What We Remember,” with intro music.', category: 'conversation', difficulty: 'hard', points: 15 },
  { id: 'hard-43', title: 'Postcards from Future-Us (conversation)', description: 'Write and decorate three postcards “mailed” from future versions of yourselves (6 months, 2 years, 10 years). Read them aloud and hang them on a string as a mini gallery.', category: 'conversation', difficulty: 'hard', points: 15 },
  { id: 'hard-44', title: 'Signature Sauce Lab (date)', description: 'Develop a couple’s dipping sauce in three iterations; name & label.', category: 'date', difficulty: 'hard', points: 15 },
  { id: 'hard-45', title: 'Director & Muse (date)', description: 'One directs, one models; swap; edit 6 best shots.', category: 'date', difficulty: 'hard', points: 15 },
  { id: 'hard-46', title: 'Memory Remix Video (surprise)', description: 'Cut old clips into a 60–120 sec short with title card & credits.', category: 'surprise', difficulty: 'hard', points: 15 },
  { id: 'hard-47', title: 'Dance Medley Challenge (play)', description: 'Learn 2 trending dances; perform a medley; rate outtakes.', category: 'play', difficulty: 'hard', points: 15 },
  { id: 'hard-48', title: 'Kindness Bingo IRL (kindness)', description: '9-square kindness bingo in public (door, compliment, litter, etc.).', category: 'kindness', difficulty: 'hard', points: 15 },
  { id: 'hard-49', title: 'Tasting Menu for Two (date)', description: 'Each makes 2 tiny savory bites + 1 mini dessert; score “best bite.”', category: 'date', difficulty: 'hard', points: 15 },
  { id: 'hard-50', title: 'Mini Road-Trip Loop (date)', description: '90-minute loop with 3 prompts: a view stop, local snack, and a belting song.', category: 'date', difficulty: 'hard', points: 15 },
];

// ---------------------------------------------------------------------------
// PRO — “Forever & Always” (50)  points: 25
// ---------------------------------------------------------------------------

export const PRO_FOREVER: SeedChallenge[] = [
  { id: 'pro-01', title: 'Sunrise-to-Sunrise Story (date)', description: 'From dawn to dawn, capture 24 ten-second clips (one each hour); edit into a 4-minute film.', category: 'date', difficulty: 'pro', points: 25 },
  { id: 'pro-02', title: 'Weekend Unplug Retreat (conversation)', description: '24–48 hours phone-free: snacks, reading list, games, tea ritual, nightly check-ins.', category: 'conversation', difficulty: 'pro', points: 25 },
  { id: 'pro-03', title: 'Living Diorama Museum (play)', description: 'Build 3 shoebox dioramas (how we met, a turning point, what we’re building) with tiny props + audio tour; host a 10-minute “tour.”', category: 'play', difficulty: 'pro', points: 25 },
  { id: 'pro-04', title: 'City Sampler Passport (date)', description: 'In 2 days visit 6 micro-neighborhoods; 5-minute walk, $5 bite, “texture” photo; stamp a DIY passport.', category: 'date', difficulty: 'pro', points: 25 },
  { id: 'pro-05', title: 'New Traditions Festival (2 Days) (romance/conversation/play)', description: `Day 1: Brainstorm 10 brand-new “us” rituals. Choose three and design them fully (name, props, steps, soundtrack).
Day 2: Perform them at sunrise, afternoon, and night (three separate moments). Create a keepsake page for each (photo, one-line origin story, next date). Add all three to your shared calendar and toast the founding of your festival.`, category: 'conversation', difficulty: 'pro', points: 25 },
  { id: 'pro-06', title: '48-Hour Kindness Relay (kindness)', description: 'Over a weekend, complete 12 caring acts; track and toast the finale.', category: 'kindness', difficulty: 'pro', points: 25 },
  { id: 'pro-07', title: 'Our Crest & Motto (play)', description: 'Design a couple’s crest with 4 symbols; craft a small banner and hang it.', category: 'play', difficulty: 'pro', points: 25 },
  { id: 'pro-08', title: 'Firsts Redux (date)', description: 'Recreate three “firsts” and document before/after side-by-sides.', category: 'date', difficulty: 'pro', points: 25 },
  { id: 'pro-09', title: 'Home Camp-In + Stargaze (date)', description: 'Living-room camp, camp food, stargaze with an app, dawn breakfast picnic.', category: 'date', difficulty: 'pro', points: 25 },
  { id: 'pro-10', title: 'Mini Documentary Weekend (play)', description: 'Shoot/edit a 3–5 min doc: “How We Love Right Now” (Home, Outside, Future).', category: 'play', difficulty: 'pro', points: 25 },
  { id: 'pro-11', title: 'Two-Day Recipe Book (date)', description: 'Develop 6 mini recipes; print an 8–12 page booklet with photos and notes.', category: 'date', difficulty: 'pro', points: 25 },
  { id: 'pro-12', title: 'The 100 Compliments Mosaic (kindness)', description: 'Write 100 specific compliments; arrange into a heart mosaic.', category: 'kindness', difficulty: 'pro', points: 25 },
  { id: 'pro-13', title: 'Love Letters Through Time (surprise)', description: '4 letters each (open in 1 month, 6 months, 1 year, 5 years); calendar reminders.', category: 'surprise', difficulty: 'pro', points: 25 },
  { id: 'pro-14', title: 'Compass Points Pilgrimage (date)', description: 'In one day, take four 30-minute micro-walks N/E/S/W. At each far point: sit, share a 2-minute memory, and take one themed photo (color, texture, light, shadow). Assemble a cross-shaped collage map with captions.', category: 'date', difficulty: 'pro', points: 25 },
  { id: 'pro-15', title: 'Canoe Postcard Quest (date/adventure)', description: 'Rent a canoe/kayak and pack a tiny waterproof kit (zip bag + 3 index cards + pen). Paddle a 60–90 min loop; at three scenic spots, drift and write a “water postcard”: one memory, one gratitude, one future wish. Snap a horizon photo at each stop. Back on shore, seal the cards in an envelope labeled with today’s date (or mail one to yourselves).', category: 'date', difficulty: 'pro', points: 25 },
  { id: 'pro-16', title: 'Second-Home Vibes (play)', description: 'Transform a room for a weekend into a “second home” theme; act the scene.', category: 'play', difficulty: 'pro', points: 25 },
  { id: 'pro-17', title: 'Teach-Me-Tonight Duo Workshops (conversation/play)', description: 'Each of you designs a 15-minute mini-class to teach the other (any quirky skill: tying a bowline, latte art with cocoa, phone photo tricks, paper marbling, basic sign phrases). Prepare a one-page “cheat sheet,” a tiny demo, and a 60-second “graduation.” Run both classes back-to-back and award homemade “skill badges.”', category: 'conversation', difficulty: 'pro', points: 25 },
  { id: 'pro-18', title: 'Charity Pop-Up (kindness)', description: 'Bake/craft 20 small items; donate or surprise neighbors with notes.', category: 'kindness', difficulty: 'pro', points: 25 },
  { id: 'pro-19', title: 'City of Stories (date)', description: 'Revisit 5 meaningful places; record a 60-second story at each.', category: 'date', difficulty: 'pro', points: 25 },
  { id: 'pro-20', title: '48-Hour Photo Book (play)', description: 'In two days, shoot a 24-photo story of “us right now.” Lay it out in a simple zine or print-on-demand template with captions and a dedication page.', category: 'play', difficulty: 'pro', points: 25 },
  { id: 'pro-21', title: 'Message-in-a-Bottle Year (surprise)', description: '12 tiny scrolls (promise/memory/wish per month) in envelopes/jars; open monthly for a year.', category: 'surprise', difficulty: 'pro', points: 25 },
  { id: 'pro-22', title: 'Dawn Patrol & Dusk Debrief (date)', description: 'Sunrise walk + dusk walk; between them, 5 micro challenges.', category: 'date', difficulty: 'pro', points: 25 },
  { id: 'pro-23', title: 'Weekend Rituals Lab (conversation)', description: 'Prototype 5 weekly rituals; pick ones to keep.', category: 'conversation', difficulty: 'pro', points: 25 },
  { id: 'pro-24', title: 'Dawn-to-Dusk Datebook (date)', description: 'Plan six micro-dates across your city (sunrise view, mid-morning café, noon walk, afternoon gallery, sunset bench, night dessert).', category: 'date', difficulty: 'pro', points: 25 },
  { id: 'pro-25', title: 'Micro-Road Trip Loop (date)', description: '2–4 hour drive: scenic stop, local bite, tiny museum/mural, sunset song.', category: 'date', difficulty: 'pro', points: 25 },
  { id: 'pro-26', title: 'Family/Friends Gratitude Booklet (kindness)', description: 'Booklet of appreciation pages for 6 loved ones; deliver.', category: 'kindness', difficulty: 'pro', points: 25 },
  { id: 'pro-27', title: 'Two-Night Chef’s Table (date/creative)', description: `• Night 1: Partner A hosts a full menu (signature drink, appetizer, main, dessert, ambience + 2-minute origin story).
• Night 2: Partner B hosts theirs.
Print mini menus, rate each course on story · taste · vibe, and crown a “house signature.”`, category: 'date', difficulty: 'pro', points: 25 },
  { id: 'pro-28', title: 'Futures Sprint Plan (conversation)', description: 'Brainstorm 20 “future cards” (habits, trips, skills). Sort into: Now (5) to start immediately, Next Month (5) to activate within 30 days, and Year Path (10) to move toward over the next 12 months. Put dates/owners on each, add calendar reminders, and schedule two check-ins (1 month & 1 year) to note what worked and what didn’t.', category: 'conversation', difficulty: 'pro', points: 25 },
  { id: 'pro-29', title: 'Home Retreat Weekend (date)', description: 'Design a two-day at-home retreat with a printed agenda: movement, mini-class, creative hour, curated film, and a tasting. Make playful lanyards, stamp sessions complete, and write a closing reflection.', category: 'date', difficulty: 'pro', points: 25 },
  { id: 'pro-30', title: 'The Great Skill Swap (play)', description: 'Teach each other a skill; produce one small “final piece” per skill.', category: 'play', difficulty: 'pro', points: 25 },
  { id: 'pro-31', title: 'Gratitude Trail (kindness)', description: 'Walk to 8 kindness-linked places; leave tiny thank-you notes or photo tributes.', category: 'kindness', difficulty: 'pro', points: 25 },
  { id: 'pro-32', title: 'Home Spa + Wellness Plan (kindness)', description: 'Two sessions + a 4-week micro-wellness plan you co-sign.', category: 'kindness', difficulty: 'pro', points: 25 },
  { id: 'pro-33', title: 'Mural of Us (play)', description: 'Paint/tape a removable wall mural symbolizing your year; date and sign.', category: 'play', difficulty: 'pro', points: 25 },
  { id: 'pro-34', title: 'Couple’s Board-Game Jam (play)', description: '1–2 days to design a playable “us” game; rule sheet, board, 20+ cards; box as Edition 1.', category: 'play', difficulty: 'pro', points: 25 },
  { id: 'pro-35', title: '“Future Home” Moodboard (conversation)', description: '20 images, palette, textures, and a one-page manifesto.', category: 'conversation', difficulty: 'pro', points: 25 },
  { id: 'pro-36', title: 'The Heritage Table (date)', description: '3-course menu inspired by both backgrounds; printed menu with dish stories.', category: 'date', difficulty: 'pro', points: 25 },
  { id: 'pro-37', title: 'The Generosity Sprint (kindness)', description: '24 hours, 12 micro-generosities to strangers and neighbors.', category: 'kindness', difficulty: 'pro', points: 25 },
  { id: 'pro-38', title: 'One-Roll Weekend Exhibit (surprise/creative)', description: 'Get a disposable film camera (27 shots, no deletes). Across 24–48 hours, alternate turns taking photos guided by micro-prompts: a color you keep noticing, a reflection, a lucky number, where we felt small, a shared laugh, and “home.” Develop the roll, curate your best 9 into a grid with one-line captions and a title, then hang your exhibit at home.', category: 'surprise', difficulty: 'pro', points: 25 },
  { id: 'pro-39', title: 'Three-Act Home Theater (play)', description: 'Write a 5–10 minute, three-scene mini-play (“Meet,” “Tension,” “Reunion”). Build costumes from your closet, assign rooms as sets, craft a one-page playbill, rehearse, perform, and film. Close with a cheeky post-show “reviews” card for each other.', category: 'play', difficulty: 'pro', points: 25 },
  { id: 'pro-40', title: 'Memory Remix Vol. 2 (play)', description: 'Re-edit past clips into a 5-minute film with chapters and end credits.', category: 'play', difficulty: 'pro', points: 25 },
  { id: 'pro-41', title: 'Three Sunrises Project (date)', description: 'Catch sunrise 3 days in a row; choose a theme word and write a 3-line reflection.', category: 'date', difficulty: 'pro', points: 25 },
  { id: 'pro-42', title: 'The Big Plan Jam (conversation)', description: 'Draft a 12-month “project us”; put 6 hard dates on a shared calendar.', category: 'conversation', difficulty: 'pro', points: 25 },
  { id: 'pro-43', title: 'Night Garden Read-In (date)', description: 'Create an outdoor (or balcony) reading nook with lanterns. Each chooses a new book and reads for two long sessions over 1–2 nights. Trade annotated favorite lines', category: 'date', difficulty: 'pro', points: 25 },
  { id: 'pro-44', title: 'Parallel Solo Adventures (date)', description: 'Sealed envelopes with 4–6 prompts for each other; split 2–3 hours; reunite at a café to swap stories and souvenirs.', category: 'date', difficulty: 'pro', points: 25 },
  { id: 'pro-45', title: 'The Hospitality Challenge (kindness)', description: 'Host tea/board-games for another couple/neighbor; handwrite invites & thank-yous.', category: 'kindness', difficulty: 'pro', points: 25 },
  { id: 'pro-46', title: 'Love Manifesto Podcast (conversation)', description: '15-minute episode with 3 segments + goofy “sponsor” mid-roll.', category: 'conversation', difficulty: 'pro', points: 25 },
  { id: 'pro-47', title: 'Progressive Dinner Quest (date)', description: 'App, main, dessert at three affordable spots; score and crown a winner.', category: 'date', difficulty: 'pro', points: 25 },
  { id: 'pro-48', title: '72-Hour Mini Garden (kindness)', description: 'Create a windowsill/herb setup; labels/ritual; plan a dish to use it later.', category: 'kindness', difficulty: 'pro', points: 25 },
  { id: 'pro-49', title: 'The “Yes, And” Weekend (play)', description: 'Say “yes, and…” to harmless ideas all weekend; tally & award a trophy.', category: 'play', difficulty: 'pro', points: 25 },
  { id: 'pro-50', title: 'The Promise Wall (surprise)', description: 'Poster with 25 specific promises for the next year; date-night signing ceremony.', category: 'surprise', difficulty: 'pro', points: 25 },
];

// ---------------------------------------------------------------------------
// Master pool ---------------------------------------------------------------

export const CHALLENGE_POOL: SeedChallenge[] = [
  ...EASY_TENDER,
  ...MEDIUM_HEART,
  ...HARD_PASSIONATE,
  ...PRO_FOREVER,
];

// ---------------------------------------------------------------------------
// Weekly selection logic (free vs premium) ----------------------------------
//
// Free:
//   - 1 Easy open
//   - 1 Hard teased; becomes visible at weekly >= 25
//
// Premium:
//   - Immediately open: 3 Easy + 1 Medium + 1 Hard + 1 Pro
//   - Also pick 2 more Medium (unlock at 10), 2 Hard (25), 2 Pro (50)
// ---------------------------------------------------------------------------

export function getWeeklyChallengeSet(opts: {
  plan: 'free' | 'premium';
  weeklyPoints: number;
  uid: string;
  pool?: SeedChallenge[];
  now?: Date;
}): { visible: SeedChallenge[]; locked: SeedChallenge[] } {
  const { plan, weeklyPoints, uid, pool = CHALLENGE_POOL, now = new Date() } = opts;

  const wk = isoWeekKey(now);
  const seed = hash(uid + ':' + wk);

  const easy = pool.filter((c) => c.difficulty === 'easy');
  const med  = pool.filter((c) => c.difficulty === 'medium');
  const hard = pool.filter((c) => c.difficulty === 'hard');
  const pro  = pool.filter((c) => c.difficulty === 'pro');

  const visible: SeedChallenge[] = [];
  const locked: SeedChallenge[] = [];

  if (plan === 'free') {
    const e = pickRotate(easy, 1, seed ^ 0x1111);
    if (e[0]) visible.push(withTier(e[0], 'base'));

    const h = pickRotate(hard, 1, seed ^ 0x3333);
    if (h[0]) {
      if (weeklyPoints >= 25) visible.push(withTier(h[0], 'base'));
      else locked.push(withTier(h[0], '25'));
    }

    return { visible, locked };
  }

  // premium
  const ePick = pickRotate(easy, 3, seed ^ 0x1111);
  const mPick = pickRotate(med,  3, seed ^ 0x2222);
  const hPick = pickRotate(hard, 3, seed ^ 0x3333);
  const pPick = pickRotate(pro,  3, seed ^ 0x4444);

  // Easy: all 3 open
  visible.push(...ePick.map((c) => withTier(c, 'base')));

  // Medium: 1 open, 2 gated at 10
  if (mPick[0]) visible.push(withTier(mPick[0], 'base'));
  const mGate = mPick.slice(1).map((c) => withTier(c, '10'));
  if (weeklyPoints >= 10) visible.push(...mGate.map((c) => withTier({ ...c, tier: undefined! }, 'base')));
  else locked.push(...mGate);

  // Hard: 1 open, 2 gated at 25
  if (hPick[0]) visible.push(withTier(hPick[0], 'base'));
  const hGate = hPick.slice(1).map((c) => withTier(c, '25'));
  if (weeklyPoints >= 25) visible.push(...hGate.map((c) => withTier({ ...c, tier: undefined! }, 'base')));
  else locked.push(...hGate);

  // Pro: 1 open, 2 gated at 50
  if (pPick[0]) visible.push(withTier(pPick[0], 'base'));
  const pGate = pPick.slice(1).map((c) => withTier(c, '50'));
  if (weeklyPoints >= 50) visible.push(...pGate.map((c) => withTier({ ...c, tier: undefined! }, 'base')));
  else locked.push(...pGate);

  return { visible, locked };
}

// ---------------------------------------------------------------------------
// DEV-ONLY: Sanity checks for counts, uniqueness, and selection behavior ----
// ---------------------------------------------------------------------------

export function sanityCheckChallenges() {
  const pool = CHALLENGE_POOL;

  // 1) Counts by difficulty
  const byDiff = pool.reduce<Record<DiffKey, number>>(
    (m, c) => {
      m[c.difficulty] = (m[c.difficulty] ?? 0) + 1;
      return m;
    },
    { easy: 0, medium: 0, hard: 0, pro: 0 }
  );
  console.assert(byDiff.easy === 50, `Expected 50 easy, got ${byDiff.easy}`);
  console.assert(byDiff.medium === 50, `Expected 50 medium, got ${byDiff.medium}`);
  console.assert(byDiff.hard === 50, `Expected 50 hard, got ${byDiff.hard}`);
  console.assert(byDiff.pro === 50, `Expected 50 pro, got ${byDiff.pro}`);

  // 2) Unique IDs
  const ids = new Set(pool.map(p => p.id));
  console.assert(ids.size === pool.length, 'Duplicate challenge IDs found!');

  // 3) Schema guards
  const validCats = new Set(['date','kindness','conversation','surprise','play']);
  const validDiff = new Set(['easy','medium','hard','pro']);
  for (const c of pool) {
    console.assert(validCats.has(c.category), `Invalid category: ${c.id} -> ${c.category}`);
    console.assert(validDiff.has(c.difficulty), `Invalid difficulty: ${c.id} -> ${c.difficulty}`);
    console.assert(typeof c.points === 'number' && c.points > 0, `Invalid points: ${c.id}`);
  }

  // helper to assert selection invariants
  const checkSel = (label: string, plan: 'free' | 'premium', weeklyPoints: number) => {
    const { visible, locked } = getWeeklyChallengeSet({
      plan,
      weeklyPoints,
      uid: 'dev-check-user',
      now: new Date(2025, 0, 6), // fixed week for determinism in dev
    });

    const visIds = new Set(visible.map(c => c.id));
    const lockIds = new Set(locked.map(c => c.id));
    // no overlap
    for (const id of visIds) {
      console.assert(!lockIds.has(id), `[${label}] duplicate in visible & locked: ${id}`);
    }
    // no dupes inside each set
    console.assert(visIds.size === visible.length, `[${label}] duplicates in visible`);
    console.assert(lockIds.size === locked.length, `[${label}] duplicates in locked`);

    // tier sanity (only items from selector should have tier set)
    for (const c of [...visible, ...locked]) {
      console.assert(
        c.tier === 'base' || c.tier === '10' || c.tier === '25' || c.tier === '50' || c.tier === undefined,
        `[${label}] bad tier on ${c.id}: ${String(c.tier)}`
      );
    }

    // product-rule expectations
    if (plan === 'free') {
      const visEasy = visible.filter(c => c.difficulty === 'easy').length;
      console.assert(visEasy === 1, `[${label}] free should show 1 easy open, got ${visEasy}`);
      const teasedHard = visible.concat(locked).filter(c => c.difficulty === 'hard').length;
      console.assert(teasedHard >= 1, `[${label}] free should include a teased hard`);
      if (weeklyPoints < 25) {
        console.assert(visible.every(c => c.difficulty !== 'hard'),
          `[${label}] hard should be locked <25 pts`);
      }
    } else {
      // Premium immediate opens: 3E + 1M + 1H + (1P if any pro in pool)
      const eOpen = visible.filter(c => c.difficulty === 'easy').length;
      console.assert(eOpen >= 3, `[${label}] premium should open 3 easy, got ${eOpen}`);
      const mOpen = visible.filter(c => c.difficulty === 'medium').length;
      const hOpen = visible.filter(c => c.difficulty === 'hard').length;
      console.assert(mOpen >= 1, `[${label}] premium should open ≥1 medium`);
      console.assert(hOpen >= 1, `[${label}] premium should open ≥1 hard`);
      // We intentionally don't assert Pro because pool may be empty for now.
    }

    console.log(`[sanity] ${label}: visible=${visible.length}, locked=${locked.length}`);
  };

  // 4) Selector behavior snapshots
  checkSel('free@0', 'free', 0);
  checkSel('free@24', 'free', 24);
  checkSel('free@25', 'free', 25);

  checkSel('premium@0',  'premium', 0);
  checkSel('premium@9',  'premium', 9);
  checkSel('premium@10', 'premium', 10);
  checkSel('premium@25', 'premium', 25);
  checkSel('premium@50', 'premium', 50);

  console.log('[sanity] challenges OK ✅');
}

// Optionally auto-run in dev (uncomment if you want immediate console feedback):
// if (__DEV__) {
//   try { sanityCheckChallenges(); } catch (e) { console.warn('sanityCheckChallenges failed', e); }
// }
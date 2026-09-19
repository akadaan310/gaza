// The Qur'anic computational layer. Small and honest rather than large and
// fabricated: seven ayat of Surat al-Fatiha, each canonical text (public
// domain / mutawatir text — REAL_DATA), tagged with the triliteral roots of
// their content words (DERIVED_DATA — a linguistic reading, not verbatim
// text). Recurrence of a root across ayat is then a COMPUTED_RELATION: it
// is genuinely computed from the tags below, not authored per-pair.
export interface Ayah {
  surah: number;
  ayah: number;
  arabic: string;
  transliteration: string;
  translation: string;
  roots: string[]; // triliteral roots present, e.g. "ر-ح-م"
}

export const AL_FATIHA: Ayah[] = [
  {
    surah: 1, ayah: 1,
    arabic: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
    transliteration: "Bismillāhi r-raḥmāni r-raḥīm",
    translation: "In the name of God, the Most Compassionate, the Most Merciful.",
    roots: ["س-م-و", "ر-ح-م"],
  },
  {
    surah: 1, ayah: 2,
    arabic: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
    transliteration: "Al-ḥamdu lillāhi rabbi l-ʿālamīn",
    translation: "All praise is for God, Lord of all worlds.",
    roots: ["ح-م-د", "ر-ب-ب", "ع-ل-م"],
  },
  {
    surah: 1, ayah: 3,
    arabic: "الرَّحْمَٰنِ الرَّحِيمِ",
    transliteration: "Ar-raḥmāni r-raḥīm",
    translation: "The Most Compassionate, the Most Merciful.",
    roots: ["ر-ح-م"],
  },
  {
    surah: 1, ayah: 4,
    arabic: "مَالِكِ يَوْمِ الدِّينِ",
    transliteration: "Māliki yawmi d-dīn",
    translation: "Master of the Day of Judgment.",
    roots: ["م-ل-ك", "ي-و-م", "د-ي-ن"],
  },
  {
    surah: 1, ayah: 5,
    arabic: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ",
    transliteration: "Iyyāka naʿbudu wa-iyyāka nastaʿīn",
    translation: "You alone we worship, and You alone we ask for help.",
    roots: ["ع-ب-د", "ع-و-ن"],
  },
  {
    surah: 1, ayah: 6,
    arabic: "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ",
    transliteration: "Ihdinā ṣ-ṣirāṭa l-mustaqīm",
    translation: "Guide us to the straight path.",
    roots: ["ه-د-ي", "ص-ر-ط", "ق-و-م"],
  },
  {
    surah: 1, ayah: 7,
    arabic: "صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ",
    transliteration: "Ṣirāṭa lladhīna anʿamta ʿalayhim ghayri l-maghḍūbi ʿalayhim wa-lā ḍ-ḍāllīn",
    translation: "The path of those You have blessed, not of those who incur wrath, nor of those who go astray.",
    roots: ["ص-ر-ط", "ن-ع-م", "غ-ض-ب", "ض-ل-ل"],
  },
];

export interface RootRecurrence {
  root: string;
  ayat: Array<{ surah: number; ayah: number }>;
  count: number;
}

// A genuinely computed relation: which roots recur across more than one
// ayah, and where. This is what a "Guide" or "Portal" points to when it
// claims a Qur'anic relationship — never a hand-authored one-off.
export function computeRootRecurrence(ayat: Ayah[] = AL_FATIHA): RootRecurrence[] {
  const map = new Map<string, Array<{ surah: number; ayah: number }>>();
  for (const a of ayat) {
    for (const root of a.roots) {
      const list = map.get(root) ?? [];
      list.push({ surah: a.surah, ayah: a.ayah });
      map.set(root, list);
    }
  }
  return Array.from(map.entries())
    .map(([root, ayatRefs]) => ({ root, ayat: ayatRefs, count: ayatRefs.length }))
    .filter((r) => r.count > 1)
    .sort((a, b) => b.count - a.count);
}

// Deterministically links any world node id to one recurring root, giving
// every Gaza structure a stable, reproducible Qur'anic relation to reveal.
export function rootForNodeId(id: string): RootRecurrence {
  const recurring = computeRootRecurrence();
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = (h >>> 0) % recurring.length;
  return recurring[idx];
}

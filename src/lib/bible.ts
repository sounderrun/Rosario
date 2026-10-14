import fs from 'node:fs';
import path from 'node:path';

export interface Verse { v: string; t: string }
export interface Chapter { c: number; verses: Verse[] }
interface IndexBook { id: string; slug: string; name: string; chapters: number }

export const TRANSLATIONS = {
  webc: {
    id: 'webc',
    label: 'Modern English',
    short: 'Modern',
    name: 'World English Bible, Catholic Edition',
    about: 'A modern English translation of the full Catholic Bible.',
  },
  drc: {
    id: 'drc',
    label: 'Douay-Rheims',
    short: 'Douay-Rheims',
    name: 'Douay-Rheims Bible, Challoner revision',
    about: 'The classic Catholic English Bible, translated from the Latin Vulgate.',
  },
} as const;
export type TranslationId = keyof typeof TRANSLATIONS;
export const TRANSLATION_IDS = Object.keys(TRANSLATIONS) as TranslationId[];
export const DEFAULT_TRANSLATION: TranslationId = 'webc';

export interface Book {
  /** Position in the 73-book Catholic canon, shared by both translations. */
  index: number;
  /** Book id in this translation's data (WEBC uses ESG/DAG for Esther/Daniel). */
  id: string;
  /** Data file name without .json. */
  file: string;
  /** URL slug, identical across translations. */
  slug: string;
  name: string;
  chapters: number;
}

const DATA_DIR = path.join(process.cwd(), 'src', 'data', 'bible');

const readJson = (t: TranslationId, file: string) =>
  JSON.parse(fs.readFileSync(path.join(DATA_DIR, t, `${file}.json`), 'utf8'));

const displayName = (name: string) => name.replace(/ \(Greek\)$/, '');
const toSlug = (name: string) => {
  const s = displayName(name).toLowerCase().replace(/\s+/g, '-');
  return s === 'song-of-solomon' ? 'song-of-songs' : s;
};

const bookCache = new Map<TranslationId, Book[]>();

export function getBooks(t: TranslationId): Book[] {
  const cached = bookCache.get(t);
  if (cached) return cached;
  const webc: IndexBook[] = readJson('webc', 'index').books;
  const own: IndexBook[] = t === 'webc' ? webc : readJson(t, 'index').books;
  if (own.length !== 73 || webc.length !== 73) throw new Error(`${t}: expected 73 books`);
  const books = own.map((b, index) => ({
    index,
    id: b.id,
    file: b.slug,
    slug: toSlug(webc[index].name),
    name: displayName(b.name),
    chapters: b.chapters,
  }));
  bookCache.set(t, books);
  return books;
}

const chapterCache = new Map<string, Chapter[]>();

export function getChapters(t: TranslationId, book: Book): Chapter[] {
  const key = `${t}/${book.file}`;
  let chapters = chapterCache.get(key);
  if (!chapters) {
    chapters = readJson(t, book.file).chapters as Chapter[];
    chapterCache.set(key, chapters);
  }
  return chapters;
}

/** Psalms are titled one by one ("Psalm 23"); other books use "Book N". */
export const chapterLabel = (book: Book, c: number) =>
  book.id === 'PSA' ? `Psalm ${c}` : `${book.name} ${c}`;

export const bibleHref = (t: TranslationId) => `/bible/${t}/`;
export const bookHref = (t: TranslationId, book: Book) => `/bible/${t}/${book.slug}/`;
export const chapterHref = (t: TranslationId, book: Book, c: number) =>
  `/bible/${t}/${book.slug}/${c}/`;

/** Canonical sections of the Catholic canon, as consecutive runs of books. */
const SECTIONS: { testament: 'Old Testament' | 'New Testament'; name: string; count: number }[] = [
  { testament: 'Old Testament', name: 'Pentateuch', count: 5 },
  { testament: 'Old Testament', name: 'Historical books', count: 16 },
  { testament: 'Old Testament', name: 'Wisdom books', count: 7 },
  { testament: 'Old Testament', name: 'Prophets', count: 18 },
  { testament: 'New Testament', name: 'Gospels and Acts', count: 5 },
  { testament: 'New Testament', name: 'Letters and Revelation', count: 22 },
];

export function getTestaments(t: TranslationId) {
  const books = getBooks(t);
  let start = 0;
  const sections = SECTIONS.map((s) => {
    const part = { ...s, books: books.slice(start, start + s.count) };
    start += s.count;
    return part;
  });
  return (['Old Testament', 'New Testament'] as const).map((name) => ({
    name,
    sections: sections.filter((s) => s.testament === name),
  }));
}

/* Chapter mapping for the translation switch. WEBC numbers the Psalms like the
   Hebrew text, the Douay-Rheims like the Vulgate. Psalms that are split or
   merged map to the first matching psalm. */
function hebrewToVulgate(n: number) {
  if (n <= 8 || n >= 148) return n;
  if (n <= 10) return 9;
  if (n <= 113) return n - 1;
  if (n <= 115) return 113;
  if (n === 116) return 114;
  if (n <= 146) return n - 1;
  return 146;
}

function vulgateToHebrew(n: number) {
  if (n <= 8 || n >= 148) return n;
  if (n === 9) return 9;
  if (n <= 112) return n + 1;
  if (n === 113) return 114;
  if (n <= 115) return 116;
  if (n <= 145) return n + 1;
  return 147;
}

/* The Douay-Rheims gathers the Greek additions to Esther in chapters 11 to 16;
   WEBC prints them inside chapters 1 to 10 where they belong in the story. */
const DRC_ESTHER_TO_WEBC: Record<number, number> = { 11: 1, 12: 1, 13: 3, 14: 4, 15: 5, 16: 8 };

export function mapChapter(from: TranslationId, to: TranslationId, book: Book, c: number) {
  if (from === to) return c;
  const target = getBooks(to)[book.index];
  let mapped = c;
  if (book.id === 'PSA') mapped = to === 'drc' ? hebrewToVulgate(c) : vulgateToHebrew(c);
  else if (from === 'drc' && book.id === 'EST') mapped = DRC_ESTHER_TO_WEBC[c] ?? c;
  return mapped <= target.chapters ? mapped : 1;
}

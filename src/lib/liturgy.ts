import days from '../data/liturgy.json';
import { bookHref, chapterHref, getBooks, getChapters, type Book } from './bible';

/* Daily Mass calendar (US) from cpbjr/catholic-readings-api, imported by
   scripts/import-liturgy.mjs. Only the references come from there; the text is
   read from our own WEBC data at build time. */

export interface Day {
  date: string;
  season: string;
  name: string;
  rank: string;
  readings: Partial<Record<ReadingKey, string>>;
  usccb: string;
}

type ReadingKey = 'firstReading' | 'psalm' | 'secondReading' | 'gospel';

const LABELS: Record<ReadingKey, string> = {
  firstReading: 'First reading',
  psalm: 'Responsorial psalm',
  secondReading: 'Second reading',
  gospel: 'Gospel',
};

export interface Verse { c: number; v: string; t: string }

export interface Reading {
  label: string;
  ref: string;
  /** Link into the WEBC reader. */
  href: string;
  /** WEBC text; empty when the lectionary numbering may differ from the WEBC. */
  verses: Verse[];
}

export const getDays = () => days as Day[];

export const dayHref = (date: string) => `/liturgy/${date}/`;

export const RANKS: Record<string, string> = {
  SOLEMNITY: 'Solemnity',
  FEAST: 'Feast',
  MEMORIAL: 'Memorial',
  OPT_MEMORIAL: 'Optional memorial',
  COMMEMORATION: 'Commemoration',
  SUNDAY: 'Sunday',
  HOLY_WEEK: 'Holy Week',
  TRIDUUM: 'Paschal Triduum',
  FERIA: 'Weekday',
};

/* Typos and naming differences in the source data. */
const ALIASES: Record<string, string> = {
  psalm: 'psalms',
  phiippians: 'philippians',
  sirarch: 'sirach',
  'song of songs': 'song of solomon',
};

const NT = new Set([
  'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH',
  '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV',
]);

/* New Testament places where the lectionary (NAB) and WEBC verse numbers differ. */
const NT_DIFFERS = (id: string, c: number, v: number) =>
  (id === '2CO' && c === 13 && v >= 12) || (id === '3JN' && v >= 14) || (id === 'REV' && c === 12 && v >= 18);

let byName: Map<string, Book> | undefined;

function findBook(name: string) {
  byName ??= new Map(getBooks('webc').map((b) => [b.name.toLowerCase(), b]));
  const key = name.toLowerCase();
  return byName.get(ALIASES[key] ?? key);
}

interface Range { c: number; from: number; to: number }

/** "Luke 3:15-16, 21-22" -> "Luke", "3:15-16, 21-22". The long form of "A or B" is kept. */
function splitRef(ref: string) {
  const m = /^((?:[123] )?[A-Za-z][A-Za-z ]*?)\s+(\d.*)$/.exec(ref.trim());
  if (!m) return undefined;
  const verses = m[2]
    .split(/\s+or\s+/)[0]
    .replace(/[–—]/g, '-')
    .replace(/\s*([:-])\s*/g, '$1')
    .replace(/\s*(?:\band\b|&)\s*/g, ',')
    .replace(/(\d)\s+([a-z]+)\b/g, '$1$2')
    .replace(/\.$/, '');
  return { book: m[1], verses };
}

/** "3:15-16, 21-22" or "11:19a; 12:1-6a, 10ab" -> verse ranges. Partial-verse letters are
    dropped, so the whole verse is shown. Single-chapter books may omit the chapter. */
export function parseVerses(verses: string, defaultChapter = 0): Range[] | undefined {
  const ranges: Range[] = [];
  let c = defaultChapter;
  for (const part of verses.split(';')) {
    for (const item of part.split(',').map((s) => s.trim()).filter(Boolean)) {
      const r = /^(?:(\d+):)?(\d+)[a-z]*(?:-(?:(\d+):)?(\d+)[a-z]*)?$/i.exec(item);
      if (!r) return undefined;
      if (r[1]) c = Number(r[1]);
      if (!c) return undefined;
      const from = Number(r[2]);
      if (r[3] && Number(r[3]) !== c) {
        // Crosses into the next chapter: split at the chapter break.
        ranges.push({ c, from, to: Infinity });
        c = Number(r[3]);
        ranges.push({ c, from: 1, to: Number(r[4]) });
      } else {
        ranges.push({ c, from, to: Number(r[4] ?? r[2]) });
      }
    }
  }
  return ranges.length ? ranges : undefined;
}

export function getReadings(day: Day): Reading[] {
  return (Object.keys(LABELS) as ReadingKey[])
    .filter((key) => day.readings[key])
    .map((key) => {
      const ref = day.readings[key]!;
      const split = splitRef(ref);
      const book = split && findBook(split.book);
      if (!split || !book) return { label: LABELS[key], ref, href: '/bible/webc/', verses: [] };
      const chapters = getChapters('webc', book);
      const ranges = parseVerses(split.verses, chapters.length === 1 ? 1 : 0);
      // Unparsable verses still link to the chapter named first, if the WEBC has it.
      const firstC = ranges?.[0].c ?? Number(/^(\d+):/.exec(split.verses)?.[1]);
      const href = chapters.some((ch) => ch.c === firstC) ? chapterHref('webc', book, firstC) : bookHref('webc', book);
      if (!ranges || !NT.has(book.id)) return { label: LABELS[key], ref, href, verses: [] };

      const verses: Verse[] = [];
      for (const { c, from, to } of ranges) {
        const chapter = chapters.find((ch) => ch.c === c);
        const found = chapter?.verses.filter((v) => Number(v.v) >= from && Number(v.v) <= to) ?? [];
        const complete = found.length > 0 && (to === Infinity || found.length === to - from + 1);
        if (!complete || found.some((v) => NT_DIFFERS(book.id, c, Number(v.v)))) {
          return { label: LABELS[key], ref, href, verses: [] };
        }
        verses.push(...found.filter((v) => v.t.trim()).map((v) => ({ c, v: v.v, t: v.t })));
      }
      return { label: LABELS[key], ref, href: `${href}#v${ranges[0].from}`, verses };
    });
}

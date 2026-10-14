import { chapterHref, getBooks, getChapters } from './bible';

/* Verse of the day: short, self-contained WEBC verses. The text is read from
   the Bible data at build time, so only the references live here. */
const REFS = [
  'GEN 1:1', 'JHN 1:1', 'PSA 23:1', 'MAT 5:8', 'LUK 1:28', 'PSA 46:1', 'JHN 3:16', 'WIS 3:1',
  'MAT 6:33', 'PSA 51:10', 'LUK 1:38', 'PRO 3:5', 'JHN 15:13', 'ISA 7:14', 'ROM 8:28', 'PSA 34:8',
  'MRK 9:24', 'SIR 2:1', 'JHN 20:29', 'PSA 119:105', '1JN 4:8', 'LAM 3:22', 'MAT 26:26', 'PSA 27:1',
  'HEB 11:1', 'ISA 6:8', 'JHN 2:5', 'PSA 118:24', 'PHP 4:13', 'SIR 6:14', 'LUK 2:19', 'PSA 139:14',
  '2CO 5:17', 'MIC 6:8', 'JHN 1:14', 'PSA 121:1-2', '1CO 13:13', '1SA 3:10', 'MAT 16:18', 'PRO 16:3',
  'COL 3:14', 'TOB 12:8', 'JHN 19:27', 'PSA 46:10', '1TH 5:16-18', 'MAT 5:9', 'REV 12:1', 'JHN 8:12',
  'HEB 13:8', 'LUK 2:14', 'JAS 2:26', 'ACT 2:42', '1JN 4:19', 'REV 21:5',
];

export interface DailyVerse {
  /** Reference, e.g. "John 3:16". */
  r: string;
  /** Link to the verse in the reader. */
  h: string;
  /** Verse text. */
  t: string;
  /** Size class, from the text length. */
  s: 'short' | 'medium' | 'long';
}

let cache: DailyVerse[] | undefined;

export function getDailyVerses(): DailyVerse[] {
  if (cache) return cache;
  const books = getBooks('webc');
  cache = REFS.map((ref) => {
    const m = /^(\w+) (\d+):(\d+)(?:-(\d+))?$/.exec(ref);
    const book = m && books.find((b) => b.id === m[1]);
    if (!m || !book) throw new Error(`Verse of the day: bad reference ${ref}`);
    const c = Number(m[2]);
    const from = Number(m[3]);
    const to = Number(m[4] ?? m[3]);
    const chapter = getChapters('webc', book).find((ch) => ch.c === c);
    const verses = chapter?.verses.filter((v) => Number(v.v) >= from && Number(v.v) <= to) ?? [];
    const text = verses.map((v) => v.t).join(' ').trim();
    if (verses.length !== to - from + 1 || !text) throw new Error(`Verse of the day: ${ref} not found`);
    const label = book.id === 'PSA' ? 'Psalm' : book.name;
    return {
      r: `${label} ${c}:${from}${to > from ? `-${to}` : ''}`,
      h: `${chapterHref('webc', book, c)}#v${from}`,
      t: text,
      s: text.length <= 70 ? 'short' : text.length <= 130 ? 'medium' : 'long',
    };
  });
  return cache;
}

/** Same rule as the client script: whole days since 1970 in the given date. */
export const dayIndex = (d: Date) =>
  Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 864e5);

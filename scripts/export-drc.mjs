// Export the Douay-Rheims (Challoner) Bible from the catholic-apologist bible_scholar.db
// (opened read-only) to src/data/bible/drc/, one JSON file per book, Catholic canon order.
// Vulgate versification: Psalm titles are verse 1, Psalms follow Vulgate numbering.
// Run: node scripts/export-drc.mjs [path/to/bible_scholar.db]
import { mkdirSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const DB = process.argv[2] ??
  'C:/Users/Admin/Documents/Playground/YouTube/.agents/skills/catholic-apologist/bible-scholar/data/bible_scholar.db';
const OUT = new URL('../src/data/bible/drc/', import.meta.url);

// [code in the database, display name]
const CANON = [
  ['GEN', 'Genesis'], ['EXO', 'Exodus'], ['LEV', 'Leviticus'], ['NUM', 'Numbers'], ['DEU', 'Deuteronomy'],
  ['JOS', 'Joshua'], ['JDG', 'Judges'], ['RUT', 'Ruth'], ['1SA', '1 Samuel'], ['2SA', '2 Samuel'],
  ['1KI', '1 Kings'], ['2KI', '2 Kings'], ['1CH', '1 Chronicles'], ['2CH', '2 Chronicles'], ['EZR', 'Ezra'],
  ['NEH', 'Nehemiah'], ['TOB', 'Tobit'], ['JDT', 'Judith'], ['EST', 'Esther'], ['1MA', '1 Maccabees'],
  ['2MA', '2 Maccabees'], ['JOB', 'Job'], ['PSA', 'Psalms'], ['PRO', 'Proverbs'], ['ECC', 'Ecclesiastes'],
  ['SNG', 'Song of Songs'], ['WIS', 'Wisdom'], ['SIR', 'Sirach'], ['ISA', 'Isaiah'], ['JER', 'Jeremiah'],
  ['LAM', 'Lamentations'], ['BAR', 'Baruch'], ['EZK', 'Ezekiel'], ['DAN', 'Daniel'], ['HOS', 'Hosea'],
  ['JOL', 'Joel'], ['AMO', 'Amos'], ['OBA', 'Obadiah'], ['JON', 'Jonah'], ['MIC', 'Micah'], ['NAM', 'Nahum'],
  ['HAB', 'Habakkuk'], ['ZEP', 'Zephaniah'], ['HAG', 'Haggai'], ['ZEC', 'Zechariah'], ['MAL', 'Malachi'],
  ['MAT', 'Matthew'], ['MRK', 'Mark'], ['LUK', 'Luke'], ['JHN', 'John'], ['ACT', 'Acts'], ['ROM', 'Romans'],
  ['1CO', '1 Corinthians'], ['2CO', '2 Corinthians'], ['GAL', 'Galatians'], ['EPH', 'Ephesians'],
  ['PHP', 'Philippians'], ['COL', 'Colossians'], ['1TH', '1 Thessalonians'], ['2TH', '2 Thessalonians'],
  ['1TI', '1 Timothy'], ['2TI', '2 Timothy'], ['TIT', 'Titus'], ['PHM', 'Philemon'], ['HEB', 'Hebrews'],
  ['JAS', 'James'], ['1PE', '1 Peter'], ['2PE', '2 Peter'], ['1JN', '1 John'], ['2JN', '2 John'],
  ['3JN', '3 John'], ['JUD', 'Jude'], ['REV', 'Revelation'],
];

const db = new DatabaseSync(DB, { readOnly: true });
const source = db.prepare(`SELECT s.* FROM edition e JOIN source s USING(source_id) WHERE e.code = 'DRC'`).get();
if (!source) throw new Error('DRC edition not found');
const rows = db.prepare(`
  SELECT b.usfm, u.chapter, u.verse, u.part, u.witness, u.text_raw
  FROM unit u JOIN edition e USING(edition_id) JOIN book b USING(book_id)
  WHERE e.code = 'DRC' ORDER BY u.book_id, u.seq`).all();
db.close();

const books = new Map();
for (const r of rows) {
  if (r.part || r.witness || r.verse < 1) throw new Error(`unexpected unit ${r.usfm} ${r.chapter}:${r.verse}${r.part}`);
  if (!books.has(r.usfm)) books.set(r.usfm, []);
  const chapters = books.get(r.usfm);
  let ch = chapters.at(-1);
  if (!ch || ch.c !== r.chapter) {
    if (ch && r.chapter < ch.c) throw new Error(`${r.usfm}: chapter ${r.chapter} after ${ch.c}`);
    ch = { c: r.chapter, verses: [] };
    chapters.push(ch);
  }
  const prev = ch.verses.at(-1);
  if (prev && r.verse <= Number(prev.v)) throw new Error(`${r.usfm} ${r.chapter}: verse ${r.verse} after ${prev.v}`);
  ch.verses.push({ v: String(r.verse), t: r.text_raw });
}
const codes = CANON.map(([id]) => id);
const missing = codes.filter((id) => !books.has(id));
const extra = [...books.keys()].filter((id) => !codes.includes(id));
if (missing.length || extra.length) throw new Error(`canon mismatch: missing ${missing} extra ${extra}`);

mkdirSync(OUT, { recursive: true });
const index = [];
for (const [id, name] of CANON) {
  const chapters = books.get(id);
  writeFileSync(new URL(`${id.toLowerCase()}.json`, OUT), JSON.stringify({ id, name, chapters }));
  index.push({ id, slug: id.toLowerCase(), name, chapters: chapters.length });
}
writeFileSync(new URL('index.json', OUT), JSON.stringify({
  edition: 'Douay-Rheims Bible, Challoner revision',
  license: 'Public Domain',
  source: source.upstream_url,
  sha256: source.file_sha256,
  versification: 'Vulgate',
  books: index,
}, null, 2) + '\n');
console.log(`${index.length} books, ${index.reduce((s, b) => s + b.chapters, 0)} chapters, ${rows.length} verses`);

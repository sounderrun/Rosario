// Download the World English Bible Catholic Edition (eBible.org, public domain) as USFM
// and write one JSON file per book to src/data/bible/webc/, in Catholic canon order.
// Keeps verse text, chapter titles (Psalms, Sir 51) and book introductions (Prologue of
// Sirach); drops footnotes, cross-references, section headings and Strong's tags. Run: node scripts/import-webc.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const SRC = 'https://ebible.org/Scriptures/eng-web-c_usfm.zip';
const OUT = new URL('../src/data/bible/webc/', import.meta.url);

const CANON = [
  'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH',
  'EZR', 'NEH', 'TOB', 'JDT', 'ESG', '1MA', '2MA', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'WIS', 'SIR',
  'ISA', 'JER', 'LAM', 'BAR', 'EZK', 'DAG', 'HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB',
  'ZEP', 'HAG', 'ZEC', 'MAL',
  'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH',
  '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV',
];

function unzip(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('not a zip file');
  const files = new Map();
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = buf.readUInt16LE(eocd + 10); i > 0; i--) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad zip central directory');
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    if (method !== 0 && method !== 8) throw new Error(`${name}: unsupported compression ${method}`);
    files.set(name, method === 8 ? inflateRawSync(raw) : raw);
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return files;
}

// Paragraph-level markers whose text continues the current verse.
const FLOW = /^(p|m|mi|nb|pc|b|q\d|pi\d|li\d)$/;
// Markers whose text is a heading or book metadata, never verse text.
const HEAD = /^(id|ide|h|toc\d|mt\d|ms\d|s\d|is\d|ip|cl|sp|d)$/;

function parseBook(usfm, file) {
  const text = usfm
    .replace(/\\f .*?\\f\*/gs, '')
    .replace(/\\x .*?\\x\*/gs, '')
    .replace(/\|[^\\|]*(?=\\\+?w\*)/g, '')
    .replace(/\\\+?(wj|w|bk|qs)\*? ?/g, (m) => (m.endsWith('* ') ? ' ' : ''));
  const stray = text.match(/\\[^a-z].{0,30}/);
  if (stray) throw new Error(`${file}: unhandled markup "${stray[0]}"`);
  const meta = {};
  const chapters = [];
  const intro = [];
  let chapter = null;
  let verse = null;
  const re = /\\([a-z]+\d*) ?([^\\]*)/g;
  for (const [, mk, body] of text.matchAll(re)) {
    if (mk === 'c') {
      const n = Number(body.trim());
      if (!Number.isInteger(n)) throw new Error(`${file}: bad chapter "${body}"`);
      chapter = { c: n, verses: [] };
      chapters.push(chapter);
      verse = null;
    } else if (mk === 'v') {
      const m = body.match(/^(\d+(?:-\d+)?)\s+([\s\S]*)$/);
      if (!m || !chapter) throw new Error(`${file}: bad verse "${body.slice(0, 40)}"`);
      verse = { v: m[1], t: m[2] };
      chapter.verses.push(verse);
    } else if (FLOW.test(mk)) {
      // Unnumbered text before verse 1 (Sir 51 superscription) is a chapter title.
      if (verse) verse.t += ' ' + body;
      else if (body.trim() && chapter) chapter.title = ((chapter.title ?? '') + ' ' + body).trim();
      else if (body.trim()) throw new Error(`${file}: text before first chapter "${body.slice(0, 40)}"`);
    } else if (HEAD.test(mk)) {
      // A \d before verse 1 is the Psalm title; later ones (Ps 119 ALEPH, BETH...) are headings.
      if (mk === 'd') {
        if (!chapter) throw new Error(`${file}: \\d before first chapter`);
        if (!chapter.verses.length) chapter.title = body.trim();
      } else if (/^(is\d|ip)$/.test(mk)) {
        // Book introduction: WEB editorial notes and the Prologue of Sirach.
        if (chapter) throw new Error(`${file}: introduction text inside chapter ${chapter.c}`);
        intro.push({ heading: mk !== 'ip', text: body.replace(/\s+/g, ' ').trim() });
      } else if (!(mk in meta)) meta[mk] = body.trim();
    } else {
      throw new Error(`${file}: unhandled marker \\${mk}`);
    }
  }
  for (const ch of chapters) {
    for (const v of ch.verses) {
      v.t = v.t.replace(/\s+/g, ' ').trim();
      // WEB keeps the number of a verse the best manuscripts omit; its text is only a footnote.
      if (!v.t) v.omitted = true;
    }
  }
  const book = { id: meta.id.split(' ')[0], name: meta.toc2, abbr: meta.toc3, chapters };
  if (intro.length) book.intro = intro;
  return book;
}

const res = await fetch(SRC);
if (!res.ok) throw new Error(`${SRC}: HTTP ${res.status}`);
const zip = Buffer.from(await res.arrayBuffer());
const sha256 = createHash('sha256').update(zip).digest('hex');

const books = new Map();
for (const [name, data] of unzip(zip)) {
  if (!name.endsWith('.usfm')) continue;
  const book = parseBook(data.toString('utf8').replace(/^﻿/, ''), name);
  if (books.has(book.id)) throw new Error(`duplicate book ${book.id}`);
  books.set(book.id, book);
}
const missing = CANON.filter((id) => !books.has(id));
const extra = [...books.keys()].filter((id) => !CANON.includes(id));
if (missing.length || extra.length) throw new Error(`canon mismatch: missing ${missing} extra ${extra}`);

mkdirSync(OUT, { recursive: true });
const index = [];
let verses = 0;
for (const id of CANON) {
  const book = books.get(id);
  writeFileSync(new URL(`${id.toLowerCase()}.json`, OUT), JSON.stringify(book));
  const n = book.chapters.reduce((s, c) => s + c.verses.length, 0);
  verses += n;
  index.push({ id, slug: id.toLowerCase(), name: book.name, abbr: book.abbr, chapters: book.chapters.length });
}
writeFileSync(new URL('index.json', OUT), JSON.stringify({
  edition: 'World English Bible Catholic Edition',
  license: 'Public Domain',
  source: SRC,
  sha256,
  books: index,
}, null, 2) + '\n');
console.log(`${index.length} books, ${index.reduce((s, b) => s + b.chapters, 0)} chapters, ${verses} verses; sha256 ${sha256}`);

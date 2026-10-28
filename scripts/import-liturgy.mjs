// Downloads the daily liturgical calendar and Mass reading references from
// cpbjr/catholic-readings-api (MIT, US calendar) into src/data/liturgy.json.
// Run by hand when a new year is published: node scripts/import-liturgy.mjs 2026 2027
import fs from 'node:fs';

const BASE = 'https://raw.githubusercontent.com/cpbjr/catholic-readings-api/main';
const years = process.argv.slice(2).map(Number);
if (!years.length || years.some((y) => !Number.isInteger(y))) {
  console.error('Usage: node scripts/import-liturgy.mjs <year> [year...]');
  process.exit(1);
}

async function get(path) {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

const dates = years.flatMap((y) => {
  const out = [];
  for (let d = new Date(Date.UTC(y, 0, 1)); d.getUTCFullYear() === y; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
});

const days = [];
for (let i = 0; i < dates.length; i += 16) {
  const batch = await Promise.all(
    dates.slice(i, i + 16).map(async (date) => {
      const [y, md] = [date.slice(0, 4), date.slice(5)];
      const [cal, rd] = await Promise.all([
        get(`liturgical-calendar/${y}/${md}.json`),
        get(`readings/${y}/${md}.json`),
      ]);
      return {
        date,
        season: cal.season,
        name: cal.celebration.name,
        rank: cal.celebration.type,
        readings: rd.readings,
        usccb: rd.usccbLink,
      };
    }),
  );
  days.push(...batch);
}

fs.writeFileSync(new URL('../src/data/liturgy.json', import.meta.url), `${JSON.stringify(days, null, 1)}\n`);
console.log(`Wrote ${days.length} days (${dates[0]} to ${dates.at(-1)}).`);

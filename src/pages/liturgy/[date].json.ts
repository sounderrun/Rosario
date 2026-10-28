import type { APIRoute } from 'astro';
import { RANKS, getDays, type Day } from '../../lib/liturgy';

/* Small per-day summary, fetched by the homepage card for the visitor's own date. */
export function getStaticPaths() {
  return getDays().map((day) => ({ params: { date: day.date }, props: { day } }));
}

export const GET: APIRoute = ({ props }) => {
  const { day } = props as { day: Day };
  return Response.json({
    name: day.name,
    meta: [day.season, RANKS[day.rank]].filter((x, i, a) => x && a.indexOf(x) === i).join(' · '),
    refs: Object.values(day.readings),
  });
};

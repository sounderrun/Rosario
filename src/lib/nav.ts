export const NAV = [
  { key: 'bible', label: 'Bible', href: '/bible/webc/', match: '/bible' },
  { key: 'library', label: 'Library', href: '/library/', match: '/library' },
  { key: 'chat', label: 'Chat', href: '/chat/', match: '/chat' },
  { key: 'trivia', label: 'Trivia', href: '/trivia/', match: '/trivia' },
] as const;

export type NavKey = (typeof NAV)[number]['key'];

/** aria-current value for a nav link: "page" on the section's own page, "true" inside it. */
export function currentFor(pathname: string, item: (typeof NAV)[number]) {
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  if (path === item.href) return 'page';
  return path.startsWith(`${item.match}/`) ? 'true' : undefined;
}

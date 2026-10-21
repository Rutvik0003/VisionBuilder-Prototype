// Each stakeholder interface (each customer account, Seller & Transit, each hub, each rider) keeps its OWN history,
// so switching interfaces in the sidebar never mixes them: the in-app back arrow steps back inside the interface
// you are in, and switching back to an interface reopens its last screen.
import type { AccountId } from '../types';

const KEY = 'meesho-interface-history';
const MAX = 50;
type Stacks = Record<string, string[]>;

const read = (): Stacks => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Stacks; } catch { return {}; } };
const write = (s: Stacks) => { try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable: fine */ } };

/** Which interface a path belongs to (customer screens are per signed-in account). */
export function sectionOf(path: string, account: AccountId): string | null {
  if (path.startsWith('/customer')) return `customer:${account}`;
  if (path.startsWith('/transit')) return 'transit';
  const hub = path.match(/^\/hub\/([^/?]+)/); if (hub) return `hub:${hub[1]}`;
  const rider = path.match(/^\/rider\/([^/?]+)/); if (rider) return `rider:${rider[1]}`;
  return null;
}

/** Record a visited screen in its interface's history (a "replace" navigation swaps the current screen). */
export function recordVisit(section: string, path: string, replace: boolean) {
  const all = read();
  const stack = all[section] ?? [];
  if (stack[stack.length - 1] === path) return; // same screen (e.g. coming back to this interface)
  if (replace && stack.length) stack[stack.length - 1] = path;
  else stack.push(path);
  all[section] = stack.slice(-MAX);
  write(all);
}

/** The screen to reopen when switching to this interface (its latest screen). */
export const lastVisit = (section: string): string | undefined => read()[section]?.at(-1);

/** One step back inside this interface; undefined when there's nothing earlier in it. */
export function stepBack(section: string): string | undefined {
  const all = read();
  const stack = all[section] ?? [];
  if (stack.length < 2) return undefined;
  stack.pop();
  all[section] = stack;
  write(all);
  return stack[stack.length - 1];
}

/** Reset demo: every interface starts fresh. */
export const clearInterfaceHistory = () => write({});

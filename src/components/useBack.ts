import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { sectionOf, stepBack } from '../lib/interfaceHistory';

/**
 * Back goes to the previous screen of THIS interface (customer, seller, a hub, a rider), never to another
 * interface you visited in between via the sidebar. With nothing earlier in this interface it goes to its home.
 */
export function useBack(fallback: string) {
  const nav = useNavigate();
  return () => {
    const section = sectionOf(window.location.pathname, useStore.getState().account);
    const prev = section ? stepBack(section) : undefined;
    nav(prev ?? fallback);
  };
}

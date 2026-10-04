import { useLocation, useNavigate } from 'react-router-dom';

/** Back goes to the previous screen in this app; with no history it goes to the app's home. */
export function useBack(fallback: string) {
  const nav = useNavigate();
  const location = useLocation();
  return () => {
    // react-router stores its own history index; 0 means this is the first entry of the session
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0 && location.key !== 'default') nav(-1);
    else nav(fallback);
  };
}

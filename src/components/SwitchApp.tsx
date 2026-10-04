import { Link } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';

/** "Switch app" icon (top-right of every app header) → back to the Launcher. */
export function SwitchApp({ dark = false }: { dark?: boolean }) {
  return (
    <Link to="/" title="Switch app" aria-label="Switch app"
      className={`rounded-full p-2 ${dark ? 'text-white/80 hover:bg-white/10' : 'text-ink-muted hover:bg-gray-100'}`}>
      <LayoutGrid size={19} />
    </Link>
  );
}

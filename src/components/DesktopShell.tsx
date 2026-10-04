import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { SwitchApp } from './SwitchApp';
import { useBack } from './useBack';

/** Header + page body for the desktop apps (Transit, Hub, Ops, Log, pickers). */
export function DesktopShell({ title, sub, back, right, children, wide = true }: {
  title: ReactNode; sub?: ReactNode; back?: string; right?: ReactNode; children: ReactNode; wide?: boolean;
}) {
  const goBack = useBack(back ?? '/');
  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-[500] border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className={`mx-auto flex h-14 items-center gap-2 px-3 sm:px-5 ${wide ? 'max-w-7xl' : 'max-w-4xl'}`}>
          {back !== undefined && (
            <button onClick={goBack} className="rounded-full p-2 hover:bg-gray-100" aria-label="Back"><ArrowLeft size={20} /></button>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-semibold">{title}</div>
            {sub && <div className="truncate text-xs text-ink-muted">{sub}</div>}
          </div>
          {right}
          <SwitchApp />
        </div>
      </header>
      <main className={`mx-auto px-3 py-5 sm:px-5 ${wide ? 'max-w-7xl' : 'max-w-4xl'}`}>{children}</main>
    </div>
  );
}

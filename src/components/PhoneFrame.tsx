import type { ReactNode } from 'react';
import dayjs from 'dayjs';
import { useUi } from '../store/ui';
import { useNow } from '../lib/time';

/** 390×844 phone frame on wide screens; full-bleed below the app bar on phone-width browsers. */
export function PhoneFrame({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  const clock = useNow();
  const toast = useUi((s) => s.toast);
  return (
    <div className="flex w-full justify-center sm:py-6">
      <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-page sm:h-[min(844px,calc(100dvh-48px))] sm:w-[390px] sm:rounded-[40px] sm:border-[10px] sm:border-ink sm:shadow-2xl">
        <div className={`flex h-7 shrink-0 items-center justify-between px-6 text-[11px] font-semibold ${dark ? 'bg-ink text-white' : 'bg-white text-ink'}`}>
          <span>{dayjs(clock).format('h:mm')}</span>
          <span className="flex items-center gap-1 tracking-tight">
            <span className="flex items-end gap-px">{[3, 5, 7, 9].map((h) => <span key={h} className="w-[3px] rounded-sm bg-current" style={{ height: h }} />)}</span>
            4G
            <span className="ml-1 inline-block h-2.5 w-5 rounded-[3px] border border-current p-px"><span className="block h-full w-3/4 rounded-[1px] bg-current" /></span>
          </span>
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
        {toast && (
          <div key={toast.id} className="pointer-events-none absolute inset-x-0 bottom-20 z-50 flex justify-center px-6">
            <div className="animate-[fadeUp_.2s_ease-out] rounded-lg bg-ink/90 px-4 py-2.5 text-center text-sm text-white shadow-lg">{toast.text}</div>
          </div>
        )}
      </div>
    </div>
  );
}

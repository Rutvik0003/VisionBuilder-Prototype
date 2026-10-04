import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Timer, Zap } from 'lucide-react';
import { useStore } from '../../store';
import type { SlotLabel } from '../../types';
import { useT } from '../../lib/strings';
import { dayAvailability, type Window } from '../../services/slots';
import { FeatureTag } from '../../components/FeatureTag';

const windowText = (w: SlotLabel) => w.replace(/(\d+)-(\d+)/, '$1–$2');

/**
 * C1-F1 date + window picker over live slot inventory. Full windows are greyed; tapping one only
 * reports it (`onFull`). "Any time (fastest)" never consumes capacity.
 */
export function SlotPicker({ hubId, dates, value, onPickDate, onPickWindow, onFull, ignoreHoldId, resetOnFull = true }: {
  hubId: string;
  dates: string[];
  value: { date: string; window: SlotLabel };
  onPickDate: (date: string) => void;
  onPickWindow: (window: SlotLabel) => void;
  onFull?: (date: string, window: Window) => void;
  ignoreHoldId?: string;
  resetOnFull?: boolean; // switching to a date where the chosen window is full falls back to Any time
}) {
  const t = useT();
  // subscribe to exactly what availability depends on
  const slots = useStore((st) => st.slots);
  const holds = useStore((st) => st.holds);
  const hubs = useStore((st) => st.hubs);
  const state = { slots, holds, hubs };
  const day = dayAvailability(state, hubId, value.date, ignoreHoldId);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-[13px] font-semibold">{t('slotPickDay')}</div>
        <div className="grid grid-cols-4 gap-2">
          {dates.map((d) => {
            const all = dayAvailability(state, hubId, d, ignoreHoldId);
            const allFull = all.every((a) => !a.open);
            const selected = value.date === d;
            return (
              <button key={d} onClick={() => {
                onPickDate(d);
                if (resetOnFull && value.window !== 'Any time' && !all.find((a) => a.window === value.window)?.open) onPickWindow('Any time');
              }}
                className={`rounded-lg border px-1 py-2 text-center transition ${selected ? 'border-brand bg-brand-light text-brand' : 'border-gray-200 bg-white'}`}>
                <div className="text-[11px] text-ink-muted">{dayjs(d).format('ddd')}</div>
                <div className="text-base font-bold leading-tight">{dayjs(d).format('D')}</div>
                <div className="text-[10px]">{allFull ? <span className="text-danger">Slots full</span> : dayjs(d).format('MMM')}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold">{t('slotPickTime')} <FeatureTag id="C1-F1" /></div>
        <div className="space-y-2">
          <WindowChip selected={value.window === 'Any time'} onClick={() => onPickWindow('Any time')}
            title={<span className="flex items-center gap-1"><Zap size={13} className="text-success" /> {t('slotAnyTime')}</span>}
            sub={t('slotAnyTimeSub')} />
          <div className="grid grid-cols-3 gap-2">
            {day.map((a) => (
              <WindowChip key={a.window} selected={value.window === a.window} full={!a.open}
                onClick={() => (a.open ? onPickWindow(a.window) : onFull?.(value.date, a.window))}
                title={windowText(a.window).split(' ')[0]} sub={windowText(a.window).split(' ')[1]}
                note={!a.open ? t('slotFull') : a.left <= 3 ? t('slotLeft', { n: a.left }) : undefined} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WindowChip({ selected, full, onClick, title, sub, note }: {
  selected: boolean; full?: boolean; onClick: () => void; title: React.ReactNode; sub: string; note?: string;
}) {
  return (
    <button onClick={onClick} aria-disabled={full}
      className={`w-full rounded-lg border px-2 py-2 text-left transition
        ${full ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400' : selected ? 'border-brand bg-brand-light text-brand ring-1 ring-brand' : 'border-gray-200 bg-white'}`}>
      <div className="text-[13px] font-semibold">{title}</div>
      <div className="flex items-center justify-between text-[11px]">
        <span className={full ? '' : 'text-ink-muted'}>{sub}</span>
        {note && <span className={`font-semibold ${full ? 'text-gray-500' : 'text-amber-600'}`}>{note}</span>}
      </div>
    </button>
  );
}

/** "Held for you · 9:41" countdown. Calls onExpire once when it hits zero. */
export function HoldTimer({ expiresAt, onExpire }: { expiresAt: number; onExpire: () => void }) {
  const t = useT();
  const [left, setLeft] = useState(() => expiresAt - Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      const ms = expiresAt - Date.now();
      setLeft(ms);
      if (ms <= 0) { clearInterval(id); onExpire(); }
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const secs = Math.max(0, Math.ceil(left / 1000));
  return (
    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] text-success">
      <Timer size={15} />
      <span className="flex-1">{t('slotHeld')}</span>
      <span className="font-mono font-bold">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</span>
    </div>
  );
}

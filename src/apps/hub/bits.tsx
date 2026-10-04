import type { ReactNode } from 'react';
import dayjs from 'dayjs';
import type { HomeCheck, Order, RescueReason } from '../../types';
import { REASON_LABEL } from '../../services/rescue';

export const HOME_CHIP: Record<HomeCheck, { text: string; tone: string }> = {
  not_sent: { text: 'Not asked', tone: 'bg-gray-100 text-ink-muted' },
  awaiting: { text: 'Awaiting reply', tone: 'bg-amber-50 text-amber-700' },
  yes: { text: 'Confirmed', tone: 'bg-emerald-50 text-success' },
  change_requested: { text: 'Rescheduled', tone: 'bg-sky-50 text-sky-700' },
  no_reply: { text: 'No reply', tone: 'bg-red-50 text-danger' },
};

export function HomeChip({ o }: { o: Order }) {
  const c = HOME_CHIP[o.homeCheck];
  return <span className={`chip !text-[10px] ${c.tone}`}>{c.text}</span>;
}

/** What the hub should do about this parcel's biggest risk (the rescue engine turned into an instruction). */
export const NEXT_ACTION: Record<RescueReason, string> = {
  availability: 'Confirm before dispatch',
  timing: 'Offer another slot',
  address: 'Ask for exact pin',
  trust: 'Offer open-box',
  price: 'Reassure on price',
};

export function nextAction(o: Order): string {
  if (o.rescue.band === 'low') return 'On track';
  if (o.rescue.topReason === 'availability' && o.homeCheck === 'yes') return 'Confirmed';
  return NEXT_ACTION[o.rescue.topReason];
}

/** Risk as an instruction, with a coloured dot for urgency; the numbers live in the drawer / Risk view. */
export function RiskDot({ o }: { o: Order }) {
  const color = o.rescue.band === 'high' ? 'bg-danger' : o.rescue.band === 'medium' ? 'bg-warning' : 'bg-success';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted"
      title={`p(RTO) ${o.rescue.pRto.toFixed(2)} · ${o.rescue.band} · top reason ${REASON_LABEL[o.rescue.topReason]}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} /> {nextAction(o)}
    </span>
  );
}

export const slotShort = (o: Order) =>
  `${dayjs(o.slot.date).format('ddd D')} · ${o.slot.window === 'Any time' ? 'Any time' : o.slot.window}`;

export function Section({ n, title, sub, right, children }: { n?: number; title: string; sub?: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {n !== undefined && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{n}</span>}
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{title}</div>
          {sub && <div className="text-xs text-ink-muted">{sub}</div>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-gray-300 py-6 text-center text-sm text-ink-muted">{text}</div>;
}

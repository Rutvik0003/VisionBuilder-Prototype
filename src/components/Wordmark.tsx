import { useT } from '../lib/strings';

export function Wordmark({ size = 'text-2xl' }: { size?: string }) {
  const t = useT();
  return (
    <div className="flex items-center gap-2">
      <span className={`${size} font-bold lowercase tracking-tight text-brand`}>meesho</span>
      <span className="rounded bg-brand-light px-1.5 py-0.5 text-[10px] font-medium text-brand">{t('conceptTag')}</span>
    </div>
  );
}

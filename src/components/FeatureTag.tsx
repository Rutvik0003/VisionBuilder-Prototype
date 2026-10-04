import { useStore } from '../store';

/** Tiny feature-ID tag (e.g. C1-F2), shown only when "Show feature tags" is on in the Launcher. */
export function FeatureTag({ id, className = '' }: { id: string; className?: string }) {
  const on = useStore((s) => s.showTags);
  if (!on) return null;
  return (
    <span className={`inline-block rounded bg-ink px-1 py-px align-middle font-mono text-[9px] font-semibold leading-tight text-white ${className}`}>
      {id}
    </span>
  );
}

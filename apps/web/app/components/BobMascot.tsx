type BobMascotProps = {
  className?: string;
  title?: string;
};

export default function BobMascot({ className, title = "BetMate Bob" }: BobMascotProps) {
  return (
    <span className={className} aria-label={title} role="img">
      <svg viewBox="0 0 64 64" focusable="false" aria-hidden="true">
        <rect x="8" y="10" width="48" height="48" rx="8" fill="var(--brand-eucalypt)" />
        <path d="M16 26c4-9 12-14 24-14 6 0 11 2 16 5v13H16v-4Z" fill="var(--brand-gold)" />
        <path d="M22 31h20c6 0 10 4 10 10v3c0 7-6 12-14 12H26c-8 0-14-5-14-12v-1c0-7 4-12 10-12Z" fill="var(--brand-paper)" />
        <circle cx="26" cy="42" r="3" fill="var(--brand-ink)" />
        <circle cx="40" cy="42" r="3" fill="var(--brand-ink)" />
        <path d="M28 50c3 2 7 2 10 0" fill="none" stroke="var(--brand-coral)" strokeWidth="3" strokeLinecap="round" />
        <path d="M16 29h32" stroke="var(--brand-ink)" strokeOpacity="0.3" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

import { MurmurMark } from "./MurmurMark";

export function MurmurBrand({
  compact = false,
  tagline,
}: {
  compact?: boolean;
  tagline?: string;
}) {
  return (
    <div className={`murmur-brand${compact ? " is-compact" : ""}`}>
      <MurmurMark size={compact ? 34 : 42} />
      <div className="murmur-brand-copy">
        <span className="murmur-wordmark">Murmur</span>
        {tagline ? <span className="murmur-tagline">{tagline}</span> : null}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Film } from 'lucide-react';

interface MoviePosterProps {
  src?: string;
  title: string;
  code?: string;
  className?: string;
  compact?: boolean;
}

export function MoviePoster({
  src,
  title,
  code,
  className = '',
  compact = false,
}: MoviePosterProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-sky-950 text-slate-200 select-none ${className}`}
        role="img"
        aria-label={`${title} posteri`}
      >
        <Film className={compact ? 'w-4 h-4 text-sky-400' : 'w-8 h-8 text-sky-400 mb-2'} />
        {!compact && (
          <div className="px-3 text-center">
            {code && (
              <div className="font-mono tabular-nums text-xs text-sky-300 mb-0.5">
                {code}
              </div>
            )}
            <div className="text-xs font-medium text-slate-100 line-clamp-2">
              {title}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${title} kino posteri`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}

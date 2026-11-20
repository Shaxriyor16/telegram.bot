import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Send, Trash2 } from 'lucide-react';
import type { BotSettings, Movie } from '../types';
import { MoviePoster } from './MoviePoster';

interface MovieCatalogProps {
  movies: Movie[];
  settings: BotSettings;
  loading: boolean;
  onAddClick: () => void;
  onEditClick: (movie: Movie) => void;
  onDeleteClick: (movie: Movie) => Promise<void>;
  onSendCodeClick: (movie: Movie) => void;
}

function formatCode(code: string, prefix: string): string {
  const p = prefix.trim();
  if (!p) return code;
  return code.toUpperCase().startsWith(p.toUpperCase()) ? code : `${p}${code}`;
}

function videoStatusText(movie: Movie): { label: string; ready: boolean } {
  if (movie.telegramFileId) {
    return { label: 'Telegram video tayyor', ready: true };
  }
  if (movie.videoUrl) {
    return { label: 'Video fayl ulangan', ready: true };
  }
  return { label: 'Poster + havola', ready: false };
}

export function MovieCatalog({
  movies,
  settings,
  loading,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onSendCodeClick,
}: MovieCatalogProps) {
  const [query, setQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('Barchasi');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const genres = useMemo(() => {
    const unique = Array.from(new Set(movies.map((m) => m.genre)));
    return ['Barchasi', ...unique];
  }, [movies]);

  const filteredMovies = useMemo(() => {
    const q = query.trim().toLowerCase();
    return movies.filter((m) => {
      const matchesGenre = selectedGenre === 'Barchasi' || m.genre === selectedGenre;
      if (!matchesGenre) return false;
      if (!q) return true;
      return (
        m.code.toLowerCase().includes(q) ||
        formatCode(m.code, settings.codePrefix).toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        m.genre.toLowerCase().includes(q)
      );
    });
  }, [movies, query, selectedGenre, settings.codePrefix]);

  const handleDelete = async (movie: Movie) => {
    setDeletingId(movie.id);
    try {
      await onDeleteClick(movie);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kino kodi yoki nomi bo'yicha qidirish..."
            className="w-full pl-9 pr-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-600"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          {genres.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => setSelectedGenre(genre)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedGenre === genre
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-100">
            {[1, 2, 3].map((row) => (
              <div key={row} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="w-12 h-5 bg-slate-200 rounded" />
                <div className="w-9 h-12 bg-slate-200 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="w-48 h-4 bg-slate-200 rounded" />
                  <div className="w-64 h-3 bg-slate-100 rounded" />
                </div>
                <div className="w-24 h-7 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ) : filteredMovies.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <h3 className="text-sm font-semibold text-slate-900">
              {movies.length === 0 ? "Kinolar bazasi bo'sh" : 'Qidiruv natijasi topilmadi'}
            </h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              {movies.length === 0
                ? "Fayldan yoki URL orqali birinchi kinoni qo'shing — daqiqasi va sifati avtomatik aniqlanadi."
                : "Boshqa kino kodi yoki nomini kiriting."}
            </p>
            <button
              type="button"
              onClick={onAddClick}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yangi kino qo'shish</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 pl-5 pr-3 whitespace-nowrap">Kino kodi</th>
                  <th className="py-3 px-3">Kino ma'lumotlari</th>
                  <th className="py-3 px-3 whitespace-nowrap">Telegram media</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Ko'rishlar</th>
                  <th className="py-3 pl-3 pr-5 text-right whitespace-nowrap">Boshqarish</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredMovies.map((movie) => {
                  const formatted = formatCode(movie.code, settings.codePrefix);
                  const media = videoStatusText(movie);
                  return (
                    <tr
                      key={movie.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 pl-5 pr-3 align-middle whitespace-nowrap">
                        <span className="font-mono tabular-nums text-sm font-semibold text-sky-700">
                          #{formatted}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 align-middle">
                        <div className="flex items-center gap-3 min-w-[240px]">
                          <MoviePoster
                            src={movie.posterUrl}
                            title={movie.title}
                            compact
                            className="w-9 h-12 rounded-md shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 truncate">
                              {movie.title}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 truncate">
                              {movie.year} · {movie.genre} · {movie.duration} · {movie.quality}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 align-middle text-xs whitespace-nowrap">
                        <span className={media.ready ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                          {media.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 align-middle text-right font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                        {movie.requestsCount.toLocaleString('uz-UZ')}
                      </td>
                      <td className="py-3.5 pl-3 pr-5 align-middle text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSendCodeClick(movie)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-medium transition-colors whitespace-nowrap"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Kod yuborish</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditClick(movie)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors whitespace-nowrap"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Tahrirlash</span>
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === movie.id}
                            onClick={() => void handleDelete(movie)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-700 disabled:opacity-40 text-xs font-medium transition-colors whitespace-nowrap"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>O'chirish</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

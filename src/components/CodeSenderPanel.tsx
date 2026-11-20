import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Send, Sparkles } from 'lucide-react';
import type { BotSettings, Movie, SentCodeLog, TelegramLiveStatus } from '../types';
import { MoviePoster } from './MoviePoster';

interface CodeSenderPanelProps {
  movies: Movie[];
  settings: BotSettings;
  sentLogs: SentCodeLog[];
  telegramLive: TelegramLiveStatus;
  initialMovieId?: string | null;
  onSendCode: (payload: {
    movieId: string;
    template: 'channel_post' | 'short_code' | 'direct_reply';
    target: string;
    includeDetails: boolean;
    includeBotLink: boolean;
    includeChannel: boolean;
    customNote: string;
    sendToTelegramApi: boolean;
  }) => Promise<{ ok: boolean; message: string }>;
  onJumpToSimulator: () => void;
}

function formatCode(code: string, prefix: string): string {
  const p = prefix.trim();
  if (!p) return code;
  return code.toUpperCase().startsWith(p.toUpperCase()) ? code : `${p}${code}`;
}

export function CodeSenderPanel({
  movies,
  settings,
  sentLogs,
  telegramLive,
  initialMovieId,
  onSendCode,
  onJumpToSimulator,
}: CodeSenderPanelProps) {
  const [movieId, setMovieId] = useState<string>(initialMovieId || movies[0]?.id || '');
  const [template, setTemplate] = useState<'channel_post' | 'short_code' | 'direct_reply'>('channel_post');
  const [target, setTarget] = useState<string>(settings.channelUsername || '@kinokod_rasmiy');
  const [includeDetails, setIncludeDetails] = useState(true);
  const [includeBotLink, setIncludeBotLink] = useState(true);
  const [includeChannel, setIncludeChannel] = useState(true);
  const [customNote, setCustomNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialMovieId && movies.some((m) => m.id === initialMovieId)) {
      setMovieId(initialMovieId);
    } else if (!movies.some((m) => m.id === movieId) && movies.length > 0) {
      setMovieId(movies[0].id);
    }
  }, [initialMovieId, movies, movieId]);

  const selectedMovie = useMemo(
    () => movies.find((m) => m.id === movieId) || null,
    [movies, movieId]
  );

  const previewText = useMemo(() => {
    if (!selectedMovie) return '';
    const code = formatCode(selectedMovie.code, settings.codePrefix);
    const note = customNote.trim();

    if (template === 'short_code') {
      const lines = [
        `🔢 Kino kodi: ${code}`,
        `🎬 ${selectedMovie.title} (${selectedMovie.year})`,
      ];
      if (note) lines.push(note);
      if (includeBotLink) lines.push(`Kodni ${settings.botUsername} botiga yuboring.`);
      return lines.join('\n');
    }

    if (template === 'direct_reply') {
      const lines = [
        `Siz so'ragan kino kodi tayyor:`,
        ``,
        `🎬 Nomi: ${selectedMovie.title}`,
        `🔢 Kino kodi: ${code}`,
      ];
      if (includeDetails) {
        lines.push(`📂 Janr: ${selectedMovie.genre} · ${selectedMovie.year} · ${selectedMovie.quality}`);
      }
      if (note) lines.push(`💬 ${note}`);
      if (includeBotLink) {
        lines.push(`\nKinoni ochish uchun ${code} kodini botga yuboring (${settings.botUsername}).`);
      }
      return lines.join('\n');
    }

    const lines = [
      `🎬 ${selectedMovie.title} (${selectedMovie.year})`,
      selectedMovie.description,
    ];
    if (includeDetails) {
      lines.push(
        `\n📂 Janr: ${selectedMovie.genre}`,
        `⏱ Davomiyligi: ${selectedMovie.duration} · ⭐ IMDb ${selectedMovie.rating}`,
        `🔊 Til: ${selectedMovie.language} · ${selectedMovie.quality}`
      );
    }
    lines.push(`\n🔢 Kino kodi: ${code}`);
    if (note) lines.push(`📌 ${note}`);
    if (includeBotLink) lines.push(`🤖 Bot: ${settings.botUsername}`);
    if (includeChannel && settings.channelUsername) {
      lines.push(`📢 Kanal: ${settings.channelUsername}`);
    }
    return lines.join('\n');
  }, [
    selectedMovie,
    template,
    includeDetails,
    includeBotLink,
    includeChannel,
    customNote,
    settings,
  ]);

  const handleDispatch = async (sendToTelegramApi: boolean) => {
    if (!selectedMovie || submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await onSendCode({
        movieId: selectedMovie.id,
        template,
        target,
        includeDetails,
        includeBotLink,
        includeChannel,
        customNote,
        sendToTelegramApi,
      });
      setFeedback({
        type: result.ok ? 'success' : 'error',
        text: result.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyPreview = async () => {
    if (!previewText) return;
    try {
      await navigator.clipboard.writeText(previewText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Ignore clipboard failures
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('uz-UZ', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Code Message Composer */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Kino kodini yuborish konstruktori
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Kino kodini Telegram kanal posti, qisqa xabar yoki foydalanuvchiga javob shaklida tayyorlab bot orqali yuboring.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="sender-movie" className="block text-xs font-medium text-slate-700">
                Kino va kodi
              </label>
              <select
                id="sender-movie"
                value={movieId}
                onChange={(e) => setMovieId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-600"
              >
                {movies.map((m) => (
                  <option key={m.id} value={m.id}>
                    {formatCode(m.code, settings.codePrefix)} — {m.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="sender-target" className="block text-xs font-medium text-slate-700">
                Qabul qiluvchi (Kanal yoki Chat ID)
              </label>
              <input
                id="sender-target"
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="@kanal_nomi yoki 123456789"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-600"
              />
            </div>
          </div>

          {/* Template Selector */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-700">Xabar shabloni</div>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
              {[
                { id: 'channel_post' as const, label: 'Kanal posti' },
                { id: 'short_code' as const, label: 'Qisqa kod' },
                { id: 'direct_reply' as const, label: 'Shaxsiy javob' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTemplate(item.id)}
                  className={`py-2 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    template === item.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 pt-1">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeDetails}
                onChange={(e) => setIncludeDetails(e.target.checked)}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>Janr va sifat ma'lumotlari</span>
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeBotLink}
                onChange={(e) => setIncludeBotLink(e.target.checked)}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>Bot manzili ({settings.botUsername})</span>
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeChannel}
                onChange={(e) => setIncludeChannel(e.target.checked)}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>Kanal havolasi</span>
            </label>
          </div>

          {/* Custom Note */}
          <div className="space-y-1.5">
            <label htmlFor="sender-note" className="block text-xs font-medium text-slate-700">
              Qo'shimcha izoh (ixtiyoriy)
            </label>
            <input
              id="sender-note"
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Masalan: Premyera! Do'stlaringiz bilan ulashing."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-600"
            />
          </div>

          {/* Feedback banner */}
          {feedback && (
            <div
              className={`px-3.5 py-2.5 rounded-lg text-xs border flex items-center justify-between gap-3 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              <span>{feedback.text}</span>
              {feedback.type === 'success' && (
                <button
                  type="button"
                  onClick={onJumpToSimulator}
                  className="inline-flex items-center gap-1 font-medium text-emerald-900 hover:underline whitespace-nowrap shrink-0"
                >
                  <span>Chatda ko'rish</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              disabled={submitting || !selectedMovie}
              onClick={() => void handleDispatch(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Bot chatiga yuborish</span>
            </button>

            <button
              type="button"
              disabled={submitting || !selectedMovie || !telegramLive.configured}
              onClick={() => void handleDispatch(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-45 text-slate-800 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
              title={
                telegramLive.configured
                  ? 'Real Telegram API orqali yuborish'
                  : 'Real Telegramga yuborish uchun TELEGRAM_BOT_TOKEN sozlanishi kerak'
              }
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Telegram API orqali yuborish</span>
            </button>

            <button
              type="button"
              onClick={() => void handleCopyPreview()}
              disabled={!previewText}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Nusxalandi</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Matnni nusxalash</span>
                </>
              )}
            </button>
          </div>

          {!telegramLive.configured && (
            <p className="text-[11.5px] text-slate-500">
              Real Telegram kanali yoki chatiga bevosita yuborish uchun server muhitida{' '}
              <code className="font-mono text-slate-700">TELEGRAM_BOT_TOKEN</code> sozlanishi kifoya. Ungacha barcha yuborishlar Jonli Bot chatida darhol ko'rinadi.
            </p>
          )}
        </div>

        {/* Right: Telegram Post Live Preview */}
        <div className="lg:col-span-5 bg-[#0E1621] border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 pb-3 border-b border-slate-800">
              <span>Telegram xabar ko'rinishi</span>
              <span className="font-mono">{target || settings.botUsername}</span>
            </div>

            {selectedMovie ? (
              <div className="mt-4 bg-[#182533] border border-slate-800 rounded-xl overflow-hidden">
                {template === 'channel_post' && (
                  <div className="relative h-52 w-full bg-slate-900">
                    <MoviePoster
                      src={selectedMovie.posterUrl}
                      title={selectedMovie.title}
                      code={formatCode(selectedMovie.code, settings.codePrefix)}
                      className="w-full h-full"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#182533] via-black/25 to-transparent" />
                  </div>
                )}
                <div className="p-4">
                  <div className="text-[13px] text-slate-100 leading-relaxed whitespace-pre-line break-words">
                    {previewText}
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{settings.botName}</span>
                    <span className="font-mono tabular-nums">
                      Kod: {formatCode(selectedMovie.code, settings.codePrefix)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-8 text-center text-xs text-slate-400">
                Oldindan ko'rish uchun kinoni tanlang.
              </div>
            )}
          </div>

          {selectedMovie && (
            <div className="mt-3">
              <div className="w-full py-2 px-3 rounded-lg bg-[#1F2F40] text-center text-xs font-medium text-sky-300">
                🎬 Kinoni ochish ({formatCode(selectedMovie.code, settings.codePrefix)})
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sent Code History Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Yuborilgan kino kodlari tarixi
          </h3>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {sentLogs.length} ta yozuv
          </span>
        </div>
        {sentLogs.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">
            Hali birorta ham kino kodi yuborilmagan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 pl-5 pr-3 whitespace-nowrap">Vaqt</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Kino kodi</th>
                  <th className="py-2.5 px-3">Kino nomi</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Manzil</th>
                  <th className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap">Usul</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {sentLogs.slice(0, 12).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-3 pl-5 pr-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {formatTime(log.sentAt)}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums font-semibold text-sky-700 whitespace-nowrap">
                      {log.movieCode}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900">
                      {log.movieTitle}
                    </td>
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                      {log.target}
                    </td>
                    <td className="py-3 pl-3 pr-5 text-right text-slate-500 whitespace-nowrap">
                      {log.deliveryMode === 'telegram_api' ? 'Telegram API' : 'Jonli sinov chati'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

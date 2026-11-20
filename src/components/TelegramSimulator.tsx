import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Hash,
  RotateCcw,
  Send,
  Share2,
  Shuffle,
  Terminal,
} from 'lucide-react';
import type { BotSettings, ChatMessage, Movie } from '../types';
import { MoviePoster } from './MoviePoster';

interface TelegramSimulatorProps {
  movies: Movie[];
  settings: BotSettings;
  messages: ChatMessage[];
  sending: boolean;
  onSendMessage: (text: string) => Promise<void>;
  onTriggerAction: (action: string, label?: string) => Promise<void>;
  onQuickSendCode: (movieId: string) => Promise<void>;
  onResetChat: () => void;
  onOpenCodeSender: (movieId: string) => void;
}

function formatCode(code: string, prefix: string): string {
  const p = prefix.trim();
  if (!p) return code;
  return code.toUpperCase().startsWith(p.toUpperCase()) ? code : `${p}${code}`;
}

export function TelegramSimulator({
  movies,
  settings,
  messages,
  sending,
  onSendMessage,
  onTriggerAction,
  onQuickSendCode,
  onResetChat,
  onOpenCodeSender,
}: TelegramSimulatorProps) {
  const [inputValue, setInputValue] = useState('');
  const [selectedQuickMovieId, setSelectedQuickMovieId] = useState<string>(
    movies[0]?.id || ''
  );
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!movies.some((m) => m.id === selectedQuickMovieId) && movies.length > 0) {
      setSelectedQuickMovieId(movies[0].id);
    }
  }, [movies, selectedQuickMovieId]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || sending) return;
    setInputValue('');
    await onSendMessage(trimmed);
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 1600);
    } catch {
      // Clipboard fallback ignored silently
    }
  };

  const totalRequests = movies.reduce((acc, m) => acc + m.requestsCount, 0);
  const totalCodesSent = movies.reduce((acc, m) => acc + m.codeSentCount, 0);
  const selectedQuickMovie = movies.find((m) => m.id === selectedQuickMovieId);

  return (
    <div className="space-y-6">
      {/* Compact top metrics strip — unboxed tabular figures */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Bazada kinolar</div>
          <div className="mt-1 font-mono tabular-nums text-2xl font-semibold text-slate-900">
            {movies.length}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            Kodlar: {movies.length > 0 ? movies.slice(0, 3).map((m) => formatCode(m.code, settings.codePrefix)).join(', ') : '—'}
          </div>
        </div>
        <div className="bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Kino so'rovlari</div>
          <div className="mt-1 font-mono tabular-nums text-2xl font-semibold text-slate-900">
            {totalRequests.toLocaleString('uz-UZ')}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            Kod orqali ochilgan kinolar
          </div>
        </div>
        <div className="bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Yuborilgan kodlar</div>
          <div className="mt-1 font-mono tabular-nums text-2xl font-semibold text-sky-700">
            {totalCodesSent.toLocaleString('uz-UZ')}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            Bot va kanalga tarqatilgan
          </div>
        </div>
      </div>

      {/* Main 2-column workspace: Live Telegram Bot Chat + Code Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Authentic Telegram Bot Chat Simulator */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-[#0E1621] min-h-[600px] max-h-[720px]">
          {/* Telegram chat header */}
          <div className="flex items-center justify-between gap-4 px-4 py-3 bg-[#17212B] border-b border-[#0B1119]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-sky-600 text-white flex items-center justify-center font-semibold text-sm shrink-0">
                {settings.botName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-100 truncate">
                  {settings.botName}
                </div>
                <div className="text-xs text-slate-400 truncate">
                  {settings.botUsername} · bot
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onResetChat}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-[#202B36] hover:bg-[#283644] rounded-lg transition-colors whitespace-nowrap shrink-0"
              title="Chatni tozalash"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Tozalash</span>
            </button>
          </div>

          {/* Chat messages stream */}
          <div className="flex-1 overflow-y-auto thin-scroll px-4 py-4 space-y-3">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] sm:max-w-[78%] rounded-xl overflow-hidden ${
                      isUser
                        ? 'bg-[#2B5278] text-slate-50 px-3.5 py-2.5'
                        : 'bg-[#182533] text-slate-100 border border-slate-800/80'
                    }`}
                  >
                    {/* Movie poster header if bot replied with a movie card */}
                    {!isUser && msg.movieCard && (
                      <div className="relative h-56 w-full bg-slate-900 overflow-hidden">
                        <MoviePoster
                          src={msg.movieCard.posterUrl}
                          title={msg.movieCard.title}
                          code={formatCode(msg.movieCard.code, settings.codePrefix)}
                          className="w-full h-full"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#182533] via-black/35 to-transparent" />
                        <div className="absolute bottom-3 left-3.5 right-3.5">
                          <div className="text-xs text-slate-200/90">
                            {msg.movieCard.year} · {msg.movieCard.genre} · {msg.movieCard.duration} · {msg.movieCard.quality}
                          </div>
                          <div className="text-base font-semibold text-white mt-0.5">
                            {msg.movieCard.title}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className={isUser ? '' : 'px-3.5 py-3'}>
                      {!isUser && msg.isCodeBroadcast && (
                        <div className="text-[11px] font-medium text-sky-400 mb-1.5">
                          Kino kodi yuborildi
                        </div>
                      )}

                      <div className="text-[13.5px] leading-relaxed whitespace-pre-line break-words">
                        {msg.text}
                      </div>

                      {/* Highlighted copyable movie code bar */}
                      {!isUser && msg.highlightedCode && (
                        <div className="mt-2.5 flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#0E1621] border border-slate-700/60">
                          <div className="min-w-0">
                            <span className="text-[11px] text-slate-400 mr-2">
                              Kino kodi:
                            </span>
                            <span className="font-mono tabular-nums text-sm font-semibold text-sky-300">
                              {msg.highlightedCode}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleCopyCode(msg.highlightedCode!)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
                          >
                            {copiedCode === msg.highlightedCode ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400">Nusxalandi</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Nusxalash</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      <div
                        className={`mt-1.5 text-[10.5px] font-mono tabular-nums text-right ${
                          isUser ? 'text-sky-200/75' : 'text-slate-400'
                        }`}
                      >
                        {msg.timestamp}
                      </div>
                    </div>
                  </div>

                  {/* Telegram Inline Keyboard Buttons */}
                  {!isUser && msg.inlineButtons && msg.inlineButtons.length > 0 && (
                    <div className="mt-1.5 w-full max-w-[88%] sm:max-w-[78%] space-y-1.5">
                      {msg.inlineButtons.map((row, rIdx) => (
                        <div key={rIdx} className="flex gap-1.5">
                          {row.map((btn, bIdx) => (
                            <button
                              key={bIdx}
                              type="button"
                              disabled={sending}
                              onClick={() => void onTriggerAction(btn.action, btn.text)}
                              className="flex-1 px-3 py-2 rounded-lg bg-[#1F2F40] hover:bg-[#273C52] active:bg-[#2E4660] text-slate-100 text-xs font-medium transition-colors text-center truncate"
                            >
                              {btn.text}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={scrollEndRef} />
          </div>

          {/* Quick Telegram Slash Commands bar */}
          <div className="px-3 py-2 bg-[#131C26] border-t border-[#0B1119] flex items-center gap-1.5 overflow-x-auto">
            {[
              { cmd: '/start', label: '/start' },
              { cmd: '/kodlar', label: '/kodlar' },
              { cmd: '/random', label: '/random' },
              { cmd: '/yordam', label: '/yordam' },
            ].map((item) => (
              <button
                key={item.cmd}
                type="button"
                disabled={sending}
                onClick={() => void onSendMessage(item.cmd)}
                className="px-2.5 py-1 rounded-md bg-[#1D2A38] hover:bg-[#26384B] text-sky-300 font-mono text-xs transition-colors whitespace-nowrap shrink-0"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Telegram Message Input */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 px-3 py-2.5 bg-[#17212B] border-t border-[#0B1119]"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Kino kodini (masalan: 101) yoki kino nomini yozing..."
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none px-2 py-1.5"
            />
            <button
              type="submit"
              disabled={sending || !inputValue.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Yuborish</span>
            </button>
          </form>
        </div>

        {/* Right: Quick Code Tester & Movie Code Sender Controls */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-5">
          {/* Panel 1: Direct Movie Code Sender ("Kino kodini yuborish") */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Kino kodini yuborish
              </h2>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                Kinoni tanlang va uning kodini darhol bot chatiga tayyor xabar ko'rinishida yuboring.
              </p>
            </div>

            {movies.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-200 rounded-lg">
                Hozircha kinolar mavjud emas.
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label
                    htmlFor="quick-movie-select"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Kinoni tanlang
                  </label>
                  <select
                    id="quick-movie-select"
                    value={selectedQuickMovieId}
                    onChange={(e) => setSelectedQuickMovieId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-600"
                  >
                    {movies.map((m) => (
                      <option key={m.id} value={m.id}>
                        {formatCode(m.code, settings.codePrefix)} — {m.title} ({m.year})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedQuickMovie && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                    <MoviePoster
                      src={selectedQuickMovie.posterUrl}
                      title={selectedQuickMovie.title}
                      compact
                      className="w-11 h-14 rounded-md shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {selectedQuickMovie.title}
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        {selectedQuickMovie.year} · {selectedQuickMovie.genre} · {selectedQuickMovie.quality}
                      </div>
                      <div className="mt-1 font-mono tabular-nums text-xs font-semibold text-sky-700">
                        Kod: {formatCode(selectedQuickMovie.code, settings.codePrefix)}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={sending || !selectedQuickMovieId}
                    onClick={() => void onQuickSendCode(selectedQuickMovieId)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-medium transition-colors whitespace-nowrap"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Kodni botga yuborish</span>
                  </button>
                  {selectedQuickMovieId && (
                    <button
                      type="button"
                      onClick={() => onOpenCodeSender(selectedQuickMovieId)}
                      className="px-3.5 py-2.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                    >
                      Post tuzish
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Panel 2: One-Click Movie Code Tester */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex-1 flex flex-col gap-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Tezkor sinov kodlari
              </h3>
              <button
                type="button"
                disabled={sending}
                onClick={() => void onSendMessage('/random')}
                className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-800 whitespace-nowrap shrink-0"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Tasodifiy</span>
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Quyidagi kodlardan birini bosib, foydalanuvchi kod yuborganda bot qanday javob berishini tekshiring.
            </p>

            <div className="divide-y divide-slate-100 border-t border-b border-slate-100">
              {movies.slice(0, 6).map((movie) => {
                const formatted = formatCode(movie.code, settings.codePrefix);
                return (
                  <div
                    key={movie.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono tabular-nums text-xs font-semibold text-sky-700">
                          {formatted}
                        </span>
                        <span className="text-xs font-medium text-slate-800 truncate">
                          {movie.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {movie.year} · {movie.genre} · {movie.requestsCount} so'rov
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => void onSendMessage(formatted)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-slate-700 hover:text-sky-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                    >
                      <Hash className="w-3 h-3" />
                      <span>Sinash</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-1 text-xs text-slate-500 flex items-start gap-2">
              <Terminal className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
              <span>
                Maslahat: Chatga kino nomini (masalan, <span className="font-mono text-slate-700">Orbita</span>) yozsangiz, bot sizga uning kodini topib yuboradi.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

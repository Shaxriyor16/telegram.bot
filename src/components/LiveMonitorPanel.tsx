import { useMemo, useState } from 'react';
import {
  Ban,
  Film,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Video,
} from 'lucide-react';
import type {
  ActivityLog,
  AnalyticsSummary,
  BotSettings,
  IncomingTelegramVideo,
  Movie,
  TelegramBotUser,
  TelegramLiveStatus,
} from '../types';

interface LiveMonitorPanelProps {
  movies: Movie[];
  analytics: AnalyticsSummary;
  telegramLive: TelegramLiveStatus;
  sseConnected: boolean;
  settings: BotSettings;
  activityLogs: ActivityLog[];
  botUsers: TelegramBotUser[];
  incomingVideos: IncomingTelegramVideo[];
  onReconnectTelegram: () => Promise<void>;
  onSendStatsToAdmin: () => Promise<{ ok: boolean; message: string }>;
  onBlockUser: (telegramId: number, reason?: string) => Promise<void>;
  onUnblockUser: (telegramId: number) => Promise<void>;
  onDeleteMovie: (movie: Movie) => Promise<void>;
  onCreateMovieFromVideo: (video: IncomingTelegramVideo) => void;
  onAddMovieClick: () => void;
}

function formatClock(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('uz-UZ', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatShortTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('uz-UZ', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  if (!seconds) return '';
  return `${Math.max(1, Math.round(seconds / 60))} daq`;
}

function sourceLabel(source: ActivityLog['source']): string {
  if (source === 'telegram') return 'Telegram';
  if (source === 'website') return 'Sayt';
  return 'Admin';
}

export function LiveMonitorPanel({
  movies,
  analytics,
  telegramLive,
  sseConnected,
  settings,
  activityLogs,
  botUsers,
  incomingVideos,
  onReconnectTelegram,
  onSendStatsToAdmin,
  onBlockUser,
  onUnblockUser,
  onDeleteMovie,
  onCreateMovieFromVideo,
  onAddMovieClick,
}: LiveMonitorPanelProps) {
  const [sourceFilter, setSourceFilter] = useState<'all' | 'telegram' | 'website' | 'admin'>('all');
  const [reconnecting, setReconnecting] = useState(false);
  const [sendingStats, setSendingStats] = useState(false);
  const [statsNotice, setStatsNotice] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [deletingMovieId, setDeletingMovieId] = useState<string | null>(null);

  const rankedMovies = useMemo(
    () => [...movies].sort((a, b) => b.requestsCount - a.requestsCount),
    [movies]
  );

  const filteredLogs = useMemo(() => {
    if (sourceFilter === 'all') return activityLogs;
    return activityLogs.filter((l) => l.source === sourceFilter);
  }, [activityLogs, sourceFilter]);

  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      await onReconnectTelegram();
    } finally {
      setReconnecting(false);
    }
  };

  const handleSendStats = async () => {
    setSendingStats(true);
    setStatsNotice(null);
    try {
      const res = await onSendStatsToAdmin();
      setStatsNotice(res.message);
      setTimeout(() => setStatsNotice(null), 4000);
    } finally {
      setSendingStats(false);
    }
  };

  const handleToggleBlock = async (user: TelegramBotUser) => {
    setBusyUserId(user.telegramId);
    try {
      if (user.isBlocked) {
        await onUnblockUser(user.telegramId);
      } else {
        await onBlockUser(user.telegramId, "Nojo'ya harakat");
      }
    } finally {
      setBusyUserId(null);
    }
  };

  const handleRemoveMovie = async (movie: Movie) => {
    setDeletingMovieId(movie.id);
    try {
      await onDeleteMovie(movie);
    } finally {
      setDeletingMovieId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 4-Column Real-Time KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-white px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Saytga kirganlar</span>
            <span className="text-xs font-mono tabular-nums text-emerald-700">
              {analytics.onlineSiteVisitors} onlayn
            </span>
          </div>
          <div className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-slate-900">
            {analytics.totalUniqueVisitors.toLocaleString('uz-UZ')}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Bugun: {analytics.todayUniqueVisitors} · Ko'rishlar: {analytics.totalPageViews}
          </div>
        </div>

        <div className="bg-white px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Botga kirganlar</span>
            {analytics.blockedTelegramUsers > 0 && (
              <span className="text-xs font-mono tabular-nums text-red-600">
                {analytics.blockedTelegramUsers} bloklangan
              </span>
            )}
          </div>
          <div className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-slate-900">
            {analytics.totalTelegramUsers.toLocaleString('uz-UZ')}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Telegramdagi noyob foydalanuvchilar
          </div>
        </div>

        <div className="bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Bazada kinolar</div>
          <div className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-slate-900">
            {analytics.totalMovies.toLocaleString('uz-UZ')}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Videoli kinolar: {analytics.moviesWithVideo} ta
          </div>
        </div>

        <div className="bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Jami ko'rilgan kinolar</div>
          <div className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-sky-700">
            {analytics.totalCodeRequests.toLocaleString('uz-UZ')}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Kod yuborilgan: {analytics.totalCodesSent} marta
          </div>
        </div>
      </div>

      {/* Live Telegram Bot Connection & Admin Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-sm font-semibold text-slate-900">
                Telegram Bot ulanishi
              </h2>
              <span className="text-xs text-slate-300" aria-hidden="true">·</span>
              {telegramLive.pollingActive ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
                  <span>
                    Faol: {telegramLive.connectedUsername || settings.botUsername}
                  </span>
                </span>
              ) : telegramLive.configured ? (
                <span className="text-xs font-medium text-amber-700">
                  Ulanishda xatolik: {telegramLive.lastError || "Tekshirib ko'ring"}
                </span>
              ) : (
                <span className="text-xs font-medium text-slate-600">
                  Token kiritilmagan
                </span>
              )}
              {telegramLive.adminTelegramId && (
                <>
                  <span className="text-xs text-slate-300" aria-hidden="true">·</span>
                  <span className="text-xs font-mono tabular-nums text-slate-600">
                    Admin ID: {telegramLive.adminTelegramId}
                  </span>
                </>
              )}
              <span className="text-xs text-slate-300" aria-hidden="true">·</span>
              <span className="text-xs text-slate-500">
                Jonli oqim: {sseConnected ? 'Ulangan' : 'Qayta ulanmoqda'}
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Telegramda botingizga <code className="font-mono text-slate-900">/admin</code>,{' '}
              <code className="font-mono text-slate-900">/stat</code>,{' '}
              <code className="font-mono text-slate-900">/users</code>,{' '}
              <code className="font-mono text-slate-900">/ochir 101</code> yoki{' '}
              <code className="font-mono text-slate-900">/ban ID</code> yozib hamma statistikani va kinolarni bevosita Telegramdan ham boshqara olasiz.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={sendingStats || !telegramLive.pollingActive}
              onClick={() => void handleSendStats()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-45 text-slate-800 text-xs font-medium transition-colors whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Telegramga statistika yuborish</span>
            </button>
            <button
              type="button"
              disabled={reconnecting}
              onClick={() => void handleReconnect()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-medium transition-colors whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reconnecting ? 'animate-spin' : ''}`} />
              <span>Yangilash</span>
            </button>
            <button
              type="button"
              onClick={onAddMovieClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Kino qo'shish</span>
            </button>
          </div>
        </div>

        {statsNotice && (
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-emerald-700 font-medium">
            {statsNotice}
          </div>
        )}
      </div>

      {/* Section 1: Botga kirgan foydalanuvchilar — @username, ko'rgan kinolari, Bloklash */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Botga kirgan foydalanuvchilar (Kim kirgani va qanaqa kino ko'rgani)
            </h3>
            <p className="text-xs text-slate-500">
              Nojo'ya harakat qilgan foydalanuvchini bir tugma bilan chiqarib tashlash (bloklash) mumkin
            </p>
          </div>
          <span className="font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
            {botUsers.length} kishi
          </span>
        </div>

        {botUsers.length === 0 ? (
          <div className="py-10 px-5 text-center text-xs text-slate-500">
            Hozircha Telegram botga kirgan mijozlar yo'q. Mijoz{' '}
            <span className="font-mono text-slate-700">
              {telegramLive.connectedUsername || settings.botUsername}
            </span>{' '}
            botiga kirib kino kodi yozishi bilan uning ismi, @usernamei va ko'rgan kinosi shu jadvalda paydo bo'ladi.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 pl-5 pr-3 whitespace-nowrap">Foydalanuvchi</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Username / ID</th>
                  <th className="py-2.5 px-3">Ko'rgan kinolari</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">So'rovlar</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Holat</th>
                  <th className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap">Boshqarish</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {botUsers.map((user) => {
                  const isAdminRow =
                    telegramLive.adminTelegramId !== null &&
                    user.telegramId === telegramLive.adminTelegramId;
                  return (
                    <tr
                      key={user.telegramId}
                      className={user.isBlocked ? 'bg-red-50/40' : 'hover:bg-slate-50/70'}
                    >
                      <td className="py-3 pl-5 pr-3 align-middle whitespace-nowrap">
                        <div className="font-medium text-slate-900">
                          {user.firstName}
                          {user.lastName ? ` ${user.lastName}` : ''}
                        </div>
                        <div className="font-mono tabular-nums text-[11px] text-slate-400">
                          Oxirgi faollik: {formatShortTime(user.lastActiveAt)}
                        </div>
                      </td>
                      <td className="py-3 px-3 align-middle font-mono text-slate-700 whitespace-nowrap">
                        <div>{user.username || 'username yo‘q'}</div>
                        <div className="text-[11px] text-slate-400 tabular-nums">
                          ID: {user.telegramId}
                        </div>
                      </td>
                      <td className="py-3 px-3 align-middle max-w-xs">
                        {user.watchedMovies.length > 0 ? (
                          <div className="text-slate-700 leading-relaxed">
                            {user.watchedMovies
                              .slice(0, 4)
                              .map((w) => `#${w.code} ${w.title}`)
                              .join(' · ')}
                            {user.watchedMovies.length > 4 && (
                              <span className="text-slate-400">
                                {' '}
                                (+{user.watchedMovies.length - 4})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">
                            Oxirgi yozgani: {user.lastQuery || '—'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 align-middle text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                        {user.requestsCount}
                      </td>
                      <td className="py-3 px-3 align-middle whitespace-nowrap">
                        {user.isBlocked ? (
                          <span className="font-medium text-red-700">Bloklangan</span>
                        ) : user.warningsCount > 0 ? (
                          <span className="font-medium text-amber-700">
                            Ogohlantirish ({user.warningsCount})
                          </span>
                        ) : (
                          <span className="text-emerald-700">Faol</span>
                        )}
                      </td>
                      <td className="py-3 pl-3 pr-5 align-middle text-right whitespace-nowrap">
                        {isAdminRow ? (
                          <span className="text-slate-400 font-medium">Admin</span>
                        ) : (
                          <button
                            type="button"
                            disabled={busyUserId === user.telegramId}
                            onClick={() => void handleToggleBlock(user)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-40 ${
                              user.isBlocked
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                                : 'bg-red-50 hover:bg-red-100 text-red-700'
                            }`}
                          >
                            {user.isBlocked ? (
                              <>
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Blokdan chiqarish</span>
                              </>
                            ) : (
                              <>
                                <Ban className="w-3.5 h-3.5" />
                                <span>Chiqarib tashlash</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Kinolar statistikasi jadvali (Per-Movie Ranking + Quick Delete) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Kinolar statistikasi
            </h3>
            <p className="text-xs text-slate-500">
              Har bir kino necha marta ko'rilgani, kodi va tezkor o'chirish
            </p>
          </div>
          <span className="font-mono tabular-nums text-xs text-slate-500">
            {rankedMovies.length} ta kino
          </span>
        </div>

        {rankedMovies.length === 0 ? (
          <div className="py-10 px-5 text-center text-xs text-slate-500">
            Bazada kinolar yo'q. "Kino qo'shish" tugmasi orqali birinchi kinoni joylang.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 pl-5 pr-3 whitespace-nowrap">Kod</th>
                  <th className="py-2.5 px-3">Kino nomi</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Davomiylik · Sifat</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Ko'rishlar</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Oxirgi ko'rilgan</th>
                  <th className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {rankedMovies.map((movie) => (
                  <tr key={movie.id} className="hover:bg-slate-50/70">
                    <td className="py-3 pl-5 pr-3 font-mono tabular-nums font-semibold text-sky-700 whitespace-nowrap">
                      #{movie.code}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900">
                      {movie.title}
                      <span className="text-slate-400 font-normal"> · {movie.year}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                      {movie.duration} · {movie.quality}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {movie.requestsCount.toLocaleString('uz-UZ')}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {formatClock(movie.lastWatchedAt)}
                    </td>
                    <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        disabled={deletingMovieId === movie.id}
                        onClick={() => void handleRemoveMovie(movie)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-red-600 hover:bg-red-50 disabled:opacity-40 text-xs font-medium transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>O'chirish</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 3: Jonli hodisalar lentasi + Telegramdan kelgan videolar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Jonli harakatlar tarixi
            </h3>
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
              {[
                { id: 'all' as const, label: 'Barchasi' },
                { id: 'telegram' as const, label: 'Telegram' },
                { id: 'website' as const, label: 'Sayt' },
                { id: 'admin' as const, label: 'Admin' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSourceFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    sourceFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="py-10 px-5 text-center text-xs text-slate-500">
              Hali jonli hodisalar yo'q. Telegram botda kod yozilishi yoki kino qo'shilishi bilanoq shu yerda ko'rinadi.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto thin-scroll">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="px-5 py-3 flex items-start justify-between gap-4 hover:bg-slate-50/70"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`font-medium ${
                          log.eventType === 'abuse_flagged' || log.eventType === 'user_blocked'
                            ? 'text-red-700'
                            : log.source === 'telegram'
                            ? 'text-sky-700'
                            : log.source === 'admin'
                            ? 'text-emerald-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {sourceLabel(log.source)}
                      </span>
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <span className="font-medium text-slate-900 truncate">{log.actor}</span>
                      {log.actorMeta && (
                        <>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="font-mono text-slate-500 truncate">{log.actorMeta}</span>
                        </>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-700">{log.detail}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono tabular-nums text-[11px] text-slate-500">
                      {formatShortTime(log.timestamp)}
                    </div>
                    {log.movieCode && (
                      <div className="mt-0.5 font-mono tabular-nums text-xs font-semibold text-sky-700">
                        #{log.movieCode}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Telegramdan kelgan videolar
              </h3>
              <p className="text-[11px] text-slate-500">
                Botingizga video yuboring — daqiqasi avto aniqlanadi
              </p>
            </div>
            <span className="font-mono tabular-nums text-xs text-slate-500">
              {incomingVideos.length} ta
            </span>
          </div>

          {incomingVideos.length === 0 ? (
            <div className="py-10 px-5 text-center space-y-1.5">
              <Video className="w-5 h-5 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-500">
                Telegramda botingizga video yuborsangiz, uning davomiyligi, sifati va File ID si avtomatik shu yerga tushadi.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto thin-scroll">
              {incomingVideos.map((vid) => (
                <div
                  key={vid.id}
                  className="px-5 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-900 truncate flex items-center gap-1.5">
                      <Film className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span className="truncate">{vid.fileName}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5 truncate">
                      {formatDuration(vid.durationSeconds)} · {formatBytes(vid.fileSize)} ·{' '}
                      {vid.fromUsername || vid.fromName}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCreateMovieFromVideo(vid)}
                    className="px-2.5 py-1.5 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                  >
                    Kod biriktirish
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

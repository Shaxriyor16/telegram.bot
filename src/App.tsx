import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Film,
  Menu,
  MessageSquare,
  Plus,
  Send,
  Settings,
  X,
} from 'lucide-react';
import type {
  ActivityLog,
  AnalyticsSummary,
  AppStateResponse,
  BotSettings,
  ChatMessage,
  IncomingTelegramVideo,
  Movie,
  SentCodeLog,
  TelegramBotUser,
  TelegramInlineButton,
  TelegramLiveStatus,
} from './types';
import { LiveMonitorPanel } from './components/LiveMonitorPanel';
import { TelegramSimulator } from './components/TelegramSimulator';
import { MovieCatalog } from './components/MovieCatalog';
import { CodeSenderPanel } from './components/CodeSenderPanel';
import { BotSettingsPanel } from './components/BotSettingsPanel';
import { MovieModal } from './components/MovieModal';

type TabId = 'stats' | 'catalog' | 'simulator' | 'sender' | 'settings';

const NAV_ITEMS: Array<{ id: TabId; label: string; icon: typeof BarChart3 }> = [
  { id: 'stats', label: 'Kinolar statistikasi', icon: BarChart3 },
  { id: 'catalog', label: "Kinolar / O'chirish", icon: Film },
  { id: 'simulator', label: 'Jonli Bot', icon: MessageSquare },
  { id: 'sender', label: 'Kod yuborish', icon: Send },
  { id: 'settings', label: 'Sozlamalar', icon: Settings },
];

const DEFAULT_SETTINGS: BotSettings = {
  botName: 'KinoKod Bot',
  botUsername: '@KinoKod_UzBot',
  channelUsername: '',
  codePrefix: '',
  welcomeMessage:
    "Assalomu alaykum! Kino botga xush kelibsiz.\n\nKino ko'rish uchun uning kodini yuboring (masalan: 101) yoki kino nomini yozing — bot sizga kerakli kino kodini darhol yuboradi.",
  requireSubscription: false,
  autoSendCodeOnSearch: true,
  notifyAdminInTelegram: true,
};

const EMPTY_ANALYTICS: AnalyticsSummary = {
  onlineSiteVisitors: 0,
  totalUniqueVisitors: 0,
  todayUniqueVisitors: 0,
  totalPageViews: 0,
  totalTelegramUsers: 0,
  blockedTelegramUsers: 0,
  totalMovies: 0,
  moviesWithVideo: 0,
  totalCodeRequests: 0,
  totalCodesSent: 0,
};

function getOrCreateVisitorId(): string {
  const key = 'kinokod_visitor_id';
  try {
    let existing = window.localStorage.getItem(key);
    if (!existing) {
      existing = `vis-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      window.localStorage.setItem(key, existing);
    }
    return existing;
  } catch {
    return `vis-${Date.now().toString(36)}`;
  }
}

function currentTimeStr(): string {
  return new Date().toLocaleTimeString('uz-UZ', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildWelcomeMessage(settings: BotSettings): ChatMessage {
  return {
    id: `welcome-${Date.now()}`,
    sender: 'bot',
    text: `${settings.welcomeMessage}${
      settings.requireSubscription && settings.channelUsername
        ? `\n\n📢 Rasmiy kanal: ${settings.channelUsername}`
        : ''
    }`,
    timestamp: currentTimeStr(),
    inlineButtons: [
      [
        { text: '🔢 Barcha kino kodlari', action: 'list_codes' },
        { text: '🎲 Tasodifiy kino', action: 'random_movie' },
      ],
      [{ text: '❓ Qanday ishlaydi?', action: 'help' }],
    ],
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('stats');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [movies, setMovies] = useState<Movie[]>([]);
  const [settings, setSettings] = useState<BotSettings>(DEFAULT_SETTINGS);
  const [sentLogs, setSentLogs] = useState<SentCodeLog[]>([]);
  const [botUsers, setBotUsers] = useState<TelegramBotUser[]>([]);
  const [incomingVideos, setIncomingVideos] = useState<IncomingTelegramVideo[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary>(EMPTY_ANALYTICS);
  const [telegramLive, setTelegramLive] = useState<TelegramLiveStatus>({
    configured: false,
    pollingActive: false,
    connectedUsername: null,
    botId: null,
    adminTelegramId: null,
    lastError: null,
    lastCheckedAt: null,
  });

  const [sseConnected, setSseConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    buildWelcomeMessage(DEFAULT_SETTINGS),
  ]);
  const [sendingChat, setSendingChat] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null);
  const [prefillVideo, setPrefillVideo] = useState<IncomingTelegramVideo | null>(null);
  const [senderMovieId, setSenderMovieId] = useState<string | null>(null);

  const visitLoggedRef = useRef(false);

  const applyFullState = useCallback((data: AppStateResponse) => {
    setMovies(data.movies);
    setSettings(data.settings);
    setSentLogs(data.sentLogs);
    setBotUsers(data.botUsers);
    setIncomingVideos(data.incomingVideos);
    setActivityLogs(data.activityLogs);
    setAnalytics(data.analytics);
    setTelegramLive(data.telegramLive);
    setChatMessages((prev) =>
      prev.length <= 1 ? [buildWelcomeMessage(data.settings)] : prev
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    const visitorId = getOrCreateVisitorId();

    if (!visitLoggedRef.current) {
      visitLoggedRef.current = true;
      void fetch('/api/analytics/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId }),
      }).catch(() => {});
    }

    let eventSource: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let unmounted = false;

    const connectSse = () => {
      if (unmounted) return;
      eventSource = new EventSource(
        `/api/events?visitorId=${encodeURIComponent(visitorId)}`
      );

      eventSource.onopen = () => {
        setSseConnected(true);
      };

      eventSource.addEventListener('state:sync', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as AppStateResponse;
          applyFullState(data);
        } catch {
          // Ignore malformed event
        }
      });

      eventSource.addEventListener('presence:update', (event) => {
        try {
          const updated = JSON.parse((event as MessageEvent).data) as AnalyticsSummary;
          setAnalytics(updated);
        } catch {
          // Ignore malformed event
        }
      });

      eventSource.onerror = () => {
        setSseConnected(false);
        eventSource?.close();
        if (!unmounted) {
          reconnectTimer = window.setTimeout(connectSse, 2500);
        }
      };
    };

    connectSse();

    void fetch('/api/state')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AppStateResponse | null) => {
        if (data && !unmounted) applyFullState(data);
      })
      .catch(() => setLoading(false));

    return () => {
      unmounted = true;
      eventSource?.close();
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
    };
  }, [applyFullState]);

  const suggestedCode = useMemo(() => {
    const nums = movies
      .map((m) => parseInt(m.code, 10))
      .filter((n) => !Number.isNaN(n));
    return String(nums.length > 0 ? Math.max(...nums) + 1 : 101);
  }, [movies]);

  const appendBotReplies = (
    replies: Array<{
      text: string;
      movieCard?: Movie;
      highlightedCode?: string;
      inlineButtons?: TelegramInlineButton[][];
      isCodeBroadcast?: boolean;
    }>
  ) => {
    const now = currentTimeStr();
    const mapped: ChatMessage[] = replies.map((r, idx) => ({
      id: `bot-${Date.now()}-${idx}`,
      sender: 'bot',
      text: r.text,
      timestamp: now,
      movieCard: r.movieCard,
      highlightedCode: r.highlightedCode,
      inlineButtons: r.inlineButtons,
      isCodeBroadcast: r.isCodeBroadcast,
    }));
    setChatMessages((prev) => [...prev, ...mapped]);
  };

  const handleSendMessage = async (text: string) => {
    setSendingChat(true);
    setChatMessages((prev) => [
      ...prev,
      {
        id: `usr-${Date.now()}`,
        sender: 'user',
        text,
        timestamp: currentTimeStr(),
      },
    ]);

    try {
      const res = await fetch('/api/bot/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          replies: Array<{
            text: string;
            movieCard?: Movie;
            highlightedCode?: string;
            inlineButtons?: TelegramInlineButton[][];
            isCodeBroadcast?: boolean;
          }>;
          state?: AppStateResponse;
        };
        if (data.state) applyFullState(data.state);
        appendBotReplies(data.replies);
      }
    } finally {
      setSendingChat(false);
    }
  };

  const handleTriggerAction = async (action: string, label?: string) => {
    setSendingChat(true);
    if (label) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `usr-act-${Date.now()}`,
          sender: 'user',
          text: label,
          timestamp: currentTimeStr(),
        },
      ]);
    }
    try {
      const res = await fetch('/api/bot/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          replies: Array<{
            text: string;
            movieCard?: Movie;
            highlightedCode?: string;
            inlineButtons?: TelegramInlineButton[][];
            isCodeBroadcast?: boolean;
          }>;
          state?: AppStateResponse;
        };
        if (data.state) applyFullState(data.state);
        appendBotReplies(data.replies);
      }
    } finally {
      setSendingChat(false);
    }
  };

  const handleSendCode = async (payload: {
    movieId: string;
    template: 'channel_post' | 'short_code' | 'direct_reply';
    target: string;
    includeDetails: boolean;
    includeBotLink: boolean;
    includeChannel: boolean;
    customNote: string;
    sendToTelegramApi: boolean;
  }): Promise<{ ok: boolean; message: string }> => {
    try {
      const res = await fetch('/api/bot/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        error?: string;
        telegramNotice?: string | null;
        state?: AppStateResponse;
        botReply?: {
          text: string;
          movieCard?: Movie;
          highlightedCode?: string;
          inlineButtons?: TelegramInlineButton[][];
          isCodeBroadcast?: boolean;
        };
      };
      if (!res.ok) {
        return { ok: false, message: data.error || 'Kod yuborishda xatolik yuz berdi.' };
      }
      if (data.state) applyFullState(data.state);
      if (data.botReply) appendBotReplies([data.botReply]);
      return {
        ok: true,
        message:
          data.telegramNotice ||
          "Kino kodi muvaffaqiyatli yuborildi va Jonli Bot chatiga qo'shildi.",
      };
    } catch {
      return { ok: false, message: 'Server bilan ulanishda xatolik yuz berdi.' };
    }
  };

  const handleQuickSendCode = async (movieId: string) => {
    setSendingChat(true);
    try {
      await handleSendCode({
        movieId,
        template: 'short_code',
        target: 'Jonli sinov chati',
        includeDetails: true,
        includeBotLink: true,
        includeChannel: false,
        customNote: '',
        sendToTelegramApi: false,
      });
    } finally {
      setSendingChat(false);
    }
  };

  const handleSaveMovie = async (data: {
    id?: string;
    code: string;
    title: string;
    year: number;
    genre: string;
    duration: string;
    quality: string;
    language: string;
    rating: string;
    description: string;
    posterUrl: string;
    watchUrl: string;
    telegramFileId?: string;
    videoUrl?: string;
    videoFileName?: string;
    videoFileSize?: number;
  }): Promise<{ ok: boolean; error?: string }> => {
    const isEdit = Boolean(data.id);
    const url = isEdit ? `/api/movies/${data.id}` : '/api/movies';
    const method = isEdit ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = (await res.json()) as { state?: AppStateResponse; error?: string };
    if (!res.ok) {
      return { ok: false, error: json.error || "Saqlab bo'lmadi." };
    }
    if (json.state) applyFullState(json.state);
    return { ok: true };
  };

  const handleDeleteMovie = async (movie: Movie) => {
    const res = await fetch(`/api/movies/${movie.id}`, { method: 'DELETE' });
    if (res.ok) {
      const json = (await res.json()) as { state?: AppStateResponse };
      if (json.state) applyFullState(json.state);
    }
  };

  const handleBlockUser = async (telegramId: number, reason?: string) => {
    const res = await fetch(`/api/users/${telegramId}/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      const json = (await res.json()) as { state?: AppStateResponse };
      if (json.state) applyFullState(json.state);
    }
  };

  const handleUnblockUser = async (telegramId: number) => {
    const res = await fetch(`/api/users/${telegramId}/unblock`, {
      method: 'POST',
    });
    if (res.ok) {
      const json = (await res.json()) as { state?: AppStateResponse };
      if (json.state) applyFullState(json.state);
    }
  };

  const handleSaveSettings = async (updated: BotSettings) => {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    if (res.ok) {
      const json = (await res.json()) as { state?: AppStateResponse };
      if (json.state) applyFullState(json.state);
    }
  };

  const handleReconnectTelegram = async () => {
    const res = await fetch('/api/telegram/reconnect', { method: 'POST' });
    if (res.ok) {
      const json = (await res.json()) as { telegramLive: TelegramLiveStatus };
      setTelegramLive(json.telegramLive);
    }
  };

  const handleSendStatsToAdmin = async (): Promise<{ ok: boolean; message: string }> => {
    try {
      const res = await fetch('/api/telegram/send-stats-to-admin', { method: 'POST' });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) {
        return { ok: false, message: data.error || 'Yuborishda xatolik.' };
      }
      return { ok: true, message: data.message || 'Statistika Telegramga yuborildi.' };
    } catch {
      return { ok: false, message: 'Serverga ulanib bo‘lmadi.' };
    }
  };

  const openAddModal = () => {
    setEditingMovie(null);
    setPrefillVideo(null);
    setModalOpen(true);
  };

  const openEditModal = (movie: Movie) => {
    setPrefillVideo(null);
    setEditingMovie(movie);
    setModalOpen(true);
  };

  const openModalFromIncomingVideo = (video: IncomingTelegramVideo) => {
    setEditingMovie(null);
    setPrefillVideo(video);
    setModalOpen(true);
  };

  const openCodeSenderForMovie = (movieId: string) => {
    setSenderMovieId(movieId);
    setActiveTab('sender');
  };

  const activeNavLabel =
    NAV_ITEMS.find((n) => n.id === activeTab)?.label || 'Kinolar statistikasi';

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-30">
        <div className="h-14 flex items-center px-5 border-b border-slate-200">
          <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            {settings.botName}
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Asosiy navigatsiya">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-sky-50 text-sky-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.id === 'catalog' && (
                  <span className="font-mono tabular-nums text-xs text-slate-400">
                    {movies.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-slate-200 text-xs text-slate-500 space-y-1">
          <div className="font-mono text-slate-700 truncate">
            {telegramLive.connectedUsername || settings.botUsername}
          </div>
          <div className="font-mono tabular-nums truncate">
            {analytics.totalMovies} kino · {analytics.totalTelegramUsers} mijoz
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] bg-white h-full flex flex-col border-r border-slate-200 z-50">
            <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200">
              <span className="font-display text-base font-bold text-slate-900 whitespace-nowrap">
                {settings.botName}
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-900"
                aria-label="Menyuni yopish"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-sky-50 text-sky-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Menyuni ochish"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-500 hidden sm:inline whitespace-nowrap">
                {settings.botName}
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-semibold text-slate-900 truncate whitespace-nowrap">
                {activeNavLabel}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Kino qo'shish</span>
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1280px] w-full mx-auto">
          {activeTab === 'stats' && (
            <LiveMonitorPanel
              movies={movies}
              analytics={analytics}
              telegramLive={telegramLive}
              sseConnected={sseConnected}
              settings={settings}
              activityLogs={activityLogs}
              botUsers={botUsers}
              incomingVideos={incomingVideos}
              onReconnectTelegram={handleReconnectTelegram}
              onSendStatsToAdmin={handleSendStatsToAdmin}
              onBlockUser={handleBlockUser}
              onUnblockUser={handleUnblockUser}
              onDeleteMovie={handleDeleteMovie}
              onCreateMovieFromVideo={openModalFromIncomingVideo}
              onAddMovieClick={openAddModal}
            />
          )}

          {activeTab === 'catalog' && (
            <MovieCatalog
              movies={movies}
              settings={settings}
              loading={loading}
              onAddClick={openAddModal}
              onEditClick={openEditModal}
              onDeleteClick={handleDeleteMovie}
              onSendCodeClick={(movie) => openCodeSenderForMovie(movie.id)}
            />
          )}

          {activeTab === 'simulator' && (
            <TelegramSimulator
              movies={movies}
              settings={settings}
              messages={chatMessages}
              sending={sendingChat}
              onSendMessage={handleSendMessage}
              onTriggerAction={handleTriggerAction}
              onQuickSendCode={handleQuickSendCode}
              onResetChat={() => setChatMessages([buildWelcomeMessage(settings)])}
              onOpenCodeSender={openCodeSenderForMovie}
            />
          )}

          {activeTab === 'sender' && (
            <CodeSenderPanel
              movies={movies}
              settings={settings}
              sentLogs={sentLogs}
              telegramLive={telegramLive}
              initialMovieId={senderMovieId}
              onSendCode={handleSendCode}
              onJumpToSimulator={() => setActiveTab('simulator')}
            />
          )}

          {activeTab === 'settings' && (
            <BotSettingsPanel
              settings={settings}
              telegramLive={telegramLive}
              onSave={handleSaveSettings}
            />
          )}
        </main>
      </div>

      <MovieModal
        open={modalOpen}
        editingMovie={editingMovie}
        existingMovies={movies}
        suggestedCode={suggestedCode}
        incomingVideos={incomingVideos}
        prefillVideo={prefillVideo}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSaveMovie}
      />
    </div>
  );
}

export interface Movie {
  id: string;
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
  requestsCount: number;
  codeSentCount: number;
  lastWatchedAt?: string;
  createdAt: string;
}

export interface BotSettings {
  botName: string;
  botUsername: string;
  channelUsername: string;
  codePrefix: string;
  welcomeMessage: string;
  requireSubscription: boolean;
  autoSendCodeOnSearch: boolean;
  notifyAdminInTelegram: boolean;
}

export interface SentCodeLog {
  id: string;
  movieId: string;
  movieCode: string;
  movieTitle: string;
  template: 'channel_post' | 'short_code' | 'direct_reply';
  target: string;
  deliveryMode: 'simulator' | 'telegram_api';
  messageText: string;
  sentAt: string;
}

export interface WatchedMovieEntry {
  code: string;
  title: string;
  watchedAt: string;
}

export interface TelegramBotUser {
  telegramId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  joinedAt: string;
  lastActiveAt: string;
  requestsCount: number;
  lastQuery: string;
  watchedMovies: WatchedMovieEntry[];
  isBlocked: boolean;
  blockedAt?: string;
  blockedReason?: string;
  warningsCount: number;
}

export interface SiteVisitorRecord {
  visitorId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  views: number;
  userAgent: string;
}

export interface IncomingTelegramVideo {
  id: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  durationSeconds: number;
  width?: number;
  height?: number;
  fromName: string;
  fromUsername?: string;
  caption?: string;
  receivedAt: string;
}

export interface ActivityLog {
  id: string;
  source: 'telegram' | 'website' | 'admin';
  eventType:
    | 'telegram_start'
    | 'code_requested'
    | 'movie_sent'
    | 'code_not_found'
    | 'search_code_sent'
    | 'movie_added'
    | 'movie_updated'
    | 'movie_deleted'
    | 'video_received'
    | 'site_visit'
    | 'code_broadcast'
    | 'user_blocked'
    | 'user_unblocked'
    | 'abuse_flagged';
  actor: string;
  actorMeta?: string;
  actorTelegramId?: number;
  movieCode?: string;
  movieTitle?: string;
  detail: string;
  timestamp: string;
}

export interface AnalyticsSummary {
  onlineSiteVisitors: number;
  totalUniqueVisitors: number;
  todayUniqueVisitors: number;
  totalPageViews: number;
  totalTelegramUsers: number;
  blockedTelegramUsers: number;
  totalMovies: number;
  moviesWithVideo: number;
  totalCodeRequests: number;
  totalCodesSent: number;
}

export interface TelegramInlineButton {
  text: string;
  action: string;
  url?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  movieCard?: Movie;
  highlightedCode?: string;
  inlineButtons?: TelegramInlineButton[][];
  isCodeBroadcast?: boolean;
}

export interface TelegramLiveStatus {
  configured: boolean;
  pollingActive: boolean;
  connectedUsername: string | null;
  botId: number | null;
  adminTelegramId: number | null;
  lastError: string | null;
  lastCheckedAt: string | null;
}

export interface AppStateResponse {
  movies: Movie[];
  settings: BotSettings;
  sentLogs: SentCodeLog[];
  botUsers: TelegramBotUser[];
  incomingVideos: IncomingTelegramVideo[];
  activityLogs: ActivityLog[];
  analytics: AnalyticsSummary;
  telegramLive: TelegramLiveStatus;
}

export const POSTER_PRESETS: Array<{ label: string; url: string }> = [
  {
    label: 'Samarqand ufqi',
    url: '/src/assets/images/poster_samarkand_horizon_1795180533355.jpg',
  },
  {
    label: 'Orbita chegarasi',
    url: '/src/assets/images/poster_orbital_drift_1795180517003.jpg',
  },
  {
    label: "Tungi ta'qib",
    url: '/src/assets/images/poster_midnight_chase_1795180591509.jpg',
  },
  {
    label: "Qorli qal'a",
    url: '/src/assets/images/poster_winter_citadel_1795180515757.jpg',
  },
  {
    label: "Bulutlar bog'i",
    url: '/src/assets/images/poster_clockwork_garden_1795180539049.jpg',
  },
];

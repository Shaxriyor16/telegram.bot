import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Request, Response } from 'express';

interface Movie {
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

interface BotSettings {
  botName: string;
  botUsername: string;
  channelUsername: string;
  codePrefix: string;
  welcomeMessage: string;
  requireSubscription: boolean;
  autoSendCodeOnSearch: boolean;
  notifyAdminInTelegram: boolean;
}

interface SentCodeLog {
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

interface WatchedMovieEntry {
  code: string;
  title: string;
  watchedAt: string;
}

interface TelegramBotUser {
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

interface SiteVisitorRecord {
  visitorId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  views: number;
  userAgent: string;
}

interface IncomingTelegramVideo {
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

interface ActivityLog {
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

interface StoreData {
  schemaVersion: number;
  movies: Movie[];
  settings: BotSettings;
  sentLogs: SentCodeLog[];
  botUsers: TelegramBotUser[];
  siteVisitors: SiteVisitorRecord[];
  totalPageViews: number;
  incomingVideos: IncomingTelegramVideo[];
  activityLogs: ActivityLog[];
}

interface TelegramInlineButton {
  text: string;
  action: string;
  url?: string;
}

interface BotReplyPayload {
  text: string;
  movieCard?: Movie;
  highlightedCode?: string;
  inlineButtons?: TelegramInlineButton[][];
  isCodeBroadcast?: boolean;
}

interface SseClient {
  id: string;
  visitorId: string;
  res: Response;
}

interface AdminAddWizardState {
  step: 'await_media' | 'await_code' | 'await_title';
  telegramFileId?: string;
  videoUrl?: string;
  videoFileName?: string;
  videoFileSize?: number;
  detectedDuration?: string;
  detectedQuality?: string;
  suggestedTitle?: string;
  code?: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const STORE_PATH = path.join(DATA_DIR, 'bot-store.json');
const CURRENT_SCHEMA_VERSION = 4;

const DEFAULT_MOVIES: Movie[] = [];

const DEFAULT_SETTINGS: BotSettings = {
  botName: 'KinoKod Bot',
  botUsername: '@Tezkor_kino_izlash_bot',
  channelUsername: '',
  codePrefix: '',
  welcomeMessage:
    "Assalomu alaykum! Kino botga xush kelibsiz.\n\nKino ko'rish uchun uning kodini yuboring (masalan: 101) yoki kino nomini yozing — bot sizga kerakli kino kodini darhol yuboradi.",
  requireSubscription: false,
  autoSendCodeOnSearch: true,
  notifyAdminInTelegram: true,
};

function ensureDirectories(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function createInitialStore(): StoreData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    movies: [],
    settings: DEFAULT_SETTINGS,
    sentLogs: [],
    botUsers: [],
    siteVisitors: [],
    totalPageViews: 0,
    incomingVideos: [],
    activityLogs: [],
  };
}

function ensureStore(): StoreData {
  ensureDirectories();
  if (!fs.existsSync(STORE_PATH)) {
    const initial = createInitialStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoreData>;

    // Clean reset to zero when upgrading from pre-seeded demo schema
    if (parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      const fresh: StoreData = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        movies: [],
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        sentLogs: [],
        botUsers: [],
        siteVisitors: [],
        totalPageViews: 0,
        incomingVideos: [],
        activityLogs: [],
      };
      fs.writeFileSync(STORE_PATH, JSON.stringify(fresh, null, 2), 'utf-8');
      return fresh;
    }

    const normalizedUsers: TelegramBotUser[] = Array.isArray(parsed.botUsers)
      ? parsed.botUsers.map((u) => ({
          ...u,
          watchedMovies: Array.isArray(u.watchedMovies) ? u.watchedMovies : [],
          isBlocked: Boolean(u.isBlocked),
          warningsCount: typeof u.warningsCount === 'number' ? u.warningsCount : 0,
        }))
      : [];

    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      movies: Array.isArray(parsed.movies) ? parsed.movies : [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      sentLogs: Array.isArray(parsed.sentLogs) ? parsed.sentLogs : [],
      botUsers: normalizedUsers,
      siteVisitors: Array.isArray(parsed.siteVisitors) ? parsed.siteVisitors : [],
      totalPageViews: typeof parsed.totalPageViews === 'number' ? parsed.totalPageViews : 0,
      incomingVideos: Array.isArray(parsed.incomingVideos) ? parsed.incomingVideos : [],
      activityLogs: Array.isArray(parsed.activityLogs) ? parsed.activityLogs : [],
    };
  } catch {
    return createInitialStore();
  }
}

let store: StoreData = ensureStore();

function saveStore(): void {
  ensureDirectories();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

function getTelegramToken(): string {
  const rawToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || '';
  return rawToken && rawToken !== 'MY_TELEGRAM_BOT_TOKEN' ? rawToken : '';
}

function getAdminTelegramId(): number | null {
  const raw = process.env.ADMIN_TELEGRAM_ID?.trim() || '';
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const telegramLiveState = {
  configured: Boolean(getTelegramToken()),
  pollingActive: false,
  connectedUsername: null as string | null,
  botId: null as number | null,
  adminTelegramId: getAdminTelegramId(),
  lastError: null as string | null,
  lastCheckedAt: null as string | null,
};

// Connected live SSE clients
const sseClients = new Map<string, SseClient>();
// Admin interactive add-movie wizard state keyed by Telegram chat ID
const adminWizards = new Map<number, AdminAddWizardState>();
// Anti-flood tracker per Telegram user ID
const userMessageTimestamps = new Map<number, number[]>();

const INAPPROPRIATE_PATTERNS = [
  /\b(suka|blyat|nahuy|dalbayob|jalab|qotoq|sikay|gandon|pidar|fuck|bitch|porn|xxx)\b/i,
];

function isInappropriateText(text: string): boolean {
  return INAPPROPRIATE_PATTERNS.some((rx) => rx.test(text));
}

function checkFlood(userId: number): boolean {
  const now = Date.now();
  const prev = (userMessageTimestamps.get(userId) || []).filter((t) => now - t < 8000);
  prev.push(now);
  userMessageTimestamps.set(userId, prev);
  return prev.length >= 7;
}

function detectQualityFromDimensions(width?: number, height?: number): string {
  const maxDim = Math.max(width || 0, height || 0);
  if (maxDim >= 3840 || (height && height >= 2160)) return '4K UHD';
  if (maxDim >= 1920 || (height && height >= 1080)) return '1080p Full HD';
  if (maxDim >= 1280 || (height && height >= 720)) return '720p HD';
  if (maxDim > 0) return '480p SD';
  return '1080p Full HD';
}

function formatDurationFromSeconds(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '120 daq';
  const mins = Math.max(1, Math.round(seconds / 60));
  return `${mins} daq`;
}

function cleanTitleFromFilename(rawName: string): string {
  return rawName
    .replace(/\.[^.]+$/, '')
    .replace(/\b(1080p|720p|480p|2160p|4k|uhd|hdrip|webrip|web-dl|bluray|x264|x265|hevc|uzbek|tarjima)\b/gi, '')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function computeOnlineUniqueVisitors(): number {
  const uniqueIds = new Set<string>();
  for (const client of sseClients.values()) {
    uniqueIds.add(client.visitorId);
  }
  return uniqueIds.size;
}

function computeAnalytics() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayUniqueVisitors = store.siteVisitors.filter(
    (v) => v.lastSeenAt.slice(0, 10) === todayIso
  ).length;
  const totalCodeRequests = store.movies.reduce((acc, m) => acc + m.requestsCount, 0);
  const totalCodesSent = store.movies.reduce((acc, m) => acc + m.codeSentCount, 0);
  const moviesWithVideo = store.movies.filter(
    (m) => Boolean(m.telegramFileId || m.videoUrl)
  ).length;
  const blockedTelegramUsers = store.botUsers.filter((u) => u.isBlocked).length;

  return {
    onlineSiteVisitors: computeOnlineUniqueVisitors(),
    totalUniqueVisitors: store.siteVisitors.length,
    todayUniqueVisitors,
    totalPageViews: store.totalPageViews,
    totalTelegramUsers: store.botUsers.length,
    blockedTelegramUsers,
    totalMovies: store.movies.length,
    moviesWithVideo,
    totalCodeRequests,
    totalCodesSent,
  };
}

function getFullState() {
  return {
    movies: store.movies,
    settings: store.settings,
    sentLogs: store.sentLogs,
    botUsers: store.botUsers,
    incomingVideos: store.incomingVideos,
    activityLogs: store.activityLogs,
    analytics: computeAnalytics(),
    telegramLive: telegramLiveState,
  };
}

function broadcastEvent(eventName: string, payload: unknown): void {
  const frame = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const [clientId, client] of sseClients.entries()) {
    try {
      client.res.write(frame);
    } catch {
      sseClients.delete(clientId);
    }
  }
}

function pushActivity(entry: Omit<ActivityLog, 'id' | 'timestamp'>): ActivityLog {
  const log: ActivityLog = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  store.activityLogs.unshift(log);
  if (store.activityLogs.length > 150) {
    store.activityLogs = store.activityLogs.slice(0, 150);
  }
  saveStore();
  broadcastEvent('state:sync', getFullState());
  return log;
}

function formatCodeWithPrefix(code: string, prefix: string): string {
  const cleanPrefix = prefix.trim();
  if (!cleanPrefix) return code;
  if (code.toUpperCase().startsWith(cleanPrefix.toUpperCase())) return code;
  return `${cleanPrefix}${code}`;
}

function normalizeCodeInput(input: string, prefix: string): string {
  let cleaned = input.trim().replace(/^\/kod\s+/i, '').replace(/^#/, '').trim();
  const cleanPrefix = prefix.trim();
  if (cleanPrefix && cleaned.toUpperCase().startsWith(cleanPrefix.toUpperCase())) {
    cleaned = cleaned.slice(cleanPrefix.length).trim();
  }
  return cleaned;
}

function isDuplicateCode(code: string, excludeMovieId?: string): boolean {
  const normalized = normalizeCodeInput(code, store.settings.codePrefix).toLowerCase();
  if (!normalized) return false;
  return store.movies.some(
    (m) =>
      m.id !== excludeMovieId &&
      normalizeCodeInput(m.code, store.settings.codePrefix).toLowerCase() === normalized
  );
}

function findMovieByCode(input: string): Movie | undefined {
  const normalized = normalizeCodeInput(input, store.settings.codePrefix).toLowerCase();
  if (!normalized) return undefined;
  return store.movies.find(
    (m) =>
      normalizeCodeInput(m.code, store.settings.codePrefix).toLowerCase() === normalized ||
      formatCodeWithPrefix(m.code, store.settings.codePrefix).toLowerCase() ===
        input.trim().toLowerCase()
  );
}

function buildCodeMessage(
  movie: Movie,
  template: 'channel_post' | 'short_code' | 'direct_reply',
  options?: {
    includeDetails?: boolean;
    includeBotLink?: boolean;
    includeChannel?: boolean;
    customNote?: string;
  }
): string {
  const formattedCode = formatCodeWithPrefix(movie.code, store.settings.codePrefix);
  const includeDetails = options?.includeDetails ?? true;
  const includeBotLink = options?.includeBotLink ?? true;
  const includeChannel = options?.includeChannel ?? true;
  const customNote = options?.customNote?.trim();

  if (template === 'short_code') {
    const lines = [
      `🔢 Kino kodi: ${formattedCode}`,
      `🎬 ${movie.title} (${movie.year})`,
    ];
    if (customNote) lines.push(customNote);
    if (includeBotLink) {
      lines.push(`Kodni ${store.settings.botUsername} botiga yuboring.`);
    }
    return lines.join('\n');
  }

  if (template === 'direct_reply') {
    const lines = [
      `Siz so'ragan kino kodi tayyor:`,
      ``,
      `🎬 Nomi: ${movie.title}`,
      `🔢 Kino kodi: ${formattedCode}`,
    ];
    if (includeDetails) {
      lines.push(`📂 Janr: ${movie.genre} · ${movie.year} · ${movie.quality}`);
    }
    if (customNote) lines.push(`💬 ${customNote}`);
    if (includeBotLink) {
      lines.push(
        `\nKinoni ochish uchun ${formattedCode} kodini botga yuboring (${store.settings.botUsername}).`
      );
    }
    return lines.join('\n');
  }

  const lines = [`🎬 ${movie.title} (${movie.year})`, movie.description];
  if (includeDetails) {
    lines.push(
      `\n📂 Janr: ${movie.genre}`,
      `⏱ Davomiyligi: ${movie.duration} · ⭐ IMDb ${movie.rating}`,
      `🔊 Til: ${movie.language} · ${movie.quality}`
    );
  }
  lines.push(`\n🔢 Kino kodi: ${formattedCode}`);
  if (customNote) lines.push(`📌 ${customNote}`);
  if (includeBotLink) lines.push(`🤖 Bot: ${store.settings.botUsername}`);
  if (includeChannel && store.settings.channelUsername) {
    lines.push(`📢 Kanal: ${store.settings.channelUsername}`);
  }
  return lines.join('\n');
}

function recordWatchedMovie(telegramId: number | undefined, movie: Movie) {
  const now = new Date().toISOString();
  movie.lastWatchedAt = now;
  if (!telegramId) return;
  const user = store.botUsers.find((u) => u.telegramId === telegramId);
  if (!user) return;
  const formattedCode = formatCodeWithPrefix(movie.code, store.settings.codePrefix);
  user.watchedMovies.unshift({
    code: formattedCode,
    title: movie.title,
    watchedAt: now,
  });
  if (user.watchedMovies.length > 30) {
    user.watchedMovies = user.watchedMovies.slice(0, 30);
  }
  saveStore();
}

function processBotInput(
  textInput?: string,
  action?: string,
  actorContext?: {
    source: 'telegram' | 'website';
    actor: string;
    actorMeta?: string;
    telegramId?: number;
  }
): BotReplyPayload[] {
  const settings = store.settings;
  const source = actorContext?.source || 'website';
  const actor = actorContext?.actor || 'Sayt sinov chati';
  const actorMeta = actorContext?.actorMeta;
  const telegramId = actorContext?.telegramId;

  if (action) {
    if (action === 'list_codes') return processBotInput('/kodlar', undefined, actorContext);
    if (action === 'random_movie') return processBotInput('/random', undefined, actorContext);
    if (action === 'help') return processBotInput('/yordam', undefined, actorContext);
    if (action.startsWith('movie:')) {
      return processBotInput(action.slice('movie:'.length), undefined, actorContext);
    }
    if (action.startsWith('send_code:')) {
      const code = action.slice('send_code:'.length);
      const movie = findMovieByCode(code);
      if (!movie) {
        return [{ text: `Kechirasiz, ${code} kodli kino topilmadi.` }];
      }
      movie.codeSentCount += 1;
      const formattedCode = formatCodeWithPrefix(movie.code, settings.codePrefix);
      const codeMsg = buildCodeMessage(movie, 'short_code');
      store.sentLogs.unshift({
        id: `log-${Date.now()}`,
        movieId: movie.id,
        movieCode: formattedCode,
        movieTitle: movie.title,
        template: 'short_code',
        target: actor,
        deliveryMode: source === 'telegram' ? 'telegram_api' : 'simulator',
        messageText: codeMsg,
        sentAt: new Date().toISOString(),
      });
      if (store.sentLogs.length > 50) store.sentLogs = store.sentLogs.slice(0, 50);
      pushActivity({
        source,
        eventType: 'code_broadcast',
        actor,
        actorMeta,
        actorTelegramId: telegramId,
        movieCode: formattedCode,
        movieTitle: movie.title,
        detail: `${movie.title} (${formattedCode}) kodi yuborildi`,
      });
      return [
        {
          text: codeMsg,
          highlightedCode: formattedCode,
          isCodeBroadcast: true,
          inlineButtons: [
            [{ text: `🎬 Kinoni ochish (${formattedCode})`, action: `movie:${movie.code}` }],
            [{ text: '🔢 Barcha kino kodlari', action: 'list_codes' }],
          ],
        },
      ];
    }
  }

  const raw = (textInput || '').trim();
  if (!raw) {
    return [{ text: 'Iltimos, kino kodini yoki nomini yuboring.' }];
  }

  const lower = raw.toLowerCase();

  if (lower === '/start') {
    const channelHint =
      settings.requireSubscription && settings.channelUsername
        ? `\n\n📢 Rasmiy kanal: ${settings.channelUsername}`
        : '';
    pushActivity({
      source,
      eventType: 'telegram_start',
      actor,
      actorMeta,
      actorTelegramId: telegramId,
      detail: 'Botga /start bosib kirdi',
    });
    return [
      {
        text: `${settings.welcomeMessage}${channelHint}`,
        inlineButtons: [
          [
            { text: '🔢 Barcha kino kodlari', action: 'list_codes' },
            { text: '🎲 Tasodifiy kino', action: 'random_movie' },
          ],
          [{ text: '❓ Qanday ishlaydi?', action: 'help' }],
        ],
      },
    ];
  }

  if (lower === '/yordam' || lower === '/help') {
    const sampleCode = store.movies[0]
      ? formatCodeWithPrefix(store.movies[0].code, settings.codePrefix)
      : '101';
    return [
      {
        text: [
          `Botdan foydalanish qo'llanmasi:`,
          ``,
          `1. Kino olish uchun uning kodini yuboring (masalan: ${sampleCode}).`,
          `2. Kino kodini bilmasangiz, kino nomini yozing — bot sizga uning kodini yuboradi.`,
          `3. /kodlar — barcha mavjud kino kodlari ro'yxatini ko'rsatadi.`,
          `4. /random — tasodifiy kino va uning kodini yuboradi.`,
        ].join('\n'),
        inlineButtons: [[{ text: '🔢 Barcha kino kodlari', action: 'list_codes' }]],
      },
    ];
  }

  if (lower === '/kodlar' || lower === '/codes' || lower === 'kodlar') {
    if (store.movies.length === 0) {
      return [{ text: "Hozircha bazada kinolar yo'q." }];
    }
    const listLines = store.movies.map((m) => {
      const codeStr = formatCodeWithPrefix(m.code, settings.codePrefix);
      return `${codeStr} — ${m.title} (${m.year}, ${m.duration})`;
    });
    const buttons: TelegramInlineButton[][] = [];
    for (let i = 0; i < Math.min(store.movies.length, 8); i += 2) {
      const row: TelegramInlineButton[] = [];
      const m1 = store.movies[i];
      row.push({
        text: `🔢 ${formatCodeWithPrefix(m1.code, settings.codePrefix)} · ${m1.title.slice(0, 14)}`,
        action: `movie:${m1.code}`,
      });
      if (store.movies[i + 1]) {
        const m2 = store.movies[i + 1];
        row.push({
          text: `🔢 ${formatCodeWithPrefix(m2.code, settings.codePrefix)} · ${m2.title.slice(0, 14)}`,
          action: `movie:${m2.code}`,
        });
      }
      buttons.push(row);
    }
    return [
      {
        text: `Mavjud kino kodlari (${store.movies.length} ta):\n\n${listLines.join('\n')}\n\nIstalgan kodni yozing yoki pastdagi tugmani bosing:`,
        inlineButtons: buttons,
      },
    ];
  }

  if (lower === '/random' || lower === 'tasodifiy') {
    if (store.movies.length === 0) {
      return [{ text: 'Bazada kinolar mavjud emas.' }];
    }
    const movie = store.movies[Math.floor(Math.random() * store.movies.length)];
    movie.requestsCount += 1;
    movie.codeSentCount += 1;
    recordWatchedMovie(telegramId, movie);
    const formattedCode = formatCodeWithPrefix(movie.code, settings.codePrefix);
    pushActivity({
      source,
      eventType: 'movie_sent',
      actor,
      actorMeta,
      actorTelegramId: telegramId,
      movieCode: formattedCode,
      movieTitle: movie.title,
      detail: `/random orqali "${movie.title}" (${formattedCode}) ko'rdi`,
    });
    return [
      {
        text: `Tasodifiy tanlangan kino:\n\n🎬 ${movie.title} (${movie.year})\n⏱ ${movie.duration} · ${movie.quality}\n🔢 Kino kodi: ${formattedCode}\n\n${movie.description}`,
        movieCard: movie,
        highlightedCode: formattedCode,
        inlineButtons: [
          [
            { text: `📤 Kodni yuborish (${formattedCode})`, action: `send_code:${movie.code}` },
            { text: '🎲 Yana tasodifiy', action: 'random_movie' },
          ],
          [{ text: '🔢 Barcha kodlar', action: 'list_codes' }],
        ],
      },
    ];
  }

  const exactMovie = findMovieByCode(raw);
  if (exactMovie) {
    exactMovie.requestsCount += 1;
    recordWatchedMovie(telegramId, exactMovie);
    const formattedCode = formatCodeWithPrefix(exactMovie.code, settings.codePrefix);
    pushActivity({
      source,
      eventType: 'movie_sent',
      actor,
      actorMeta,
      actorTelegramId: telegramId,
      movieCode: formattedCode,
      movieTitle: exactMovie.title,
      detail: `"${formattedCode}" kodini yozdi — "${exactMovie.title}" yuborildi`,
    });
    return [
      {
        text: `🎬 ${exactMovie.title} (${exactMovie.year})\n${exactMovie.description}\n\n📂 ${exactMovie.genre} · ⏱ ${exactMovie.duration} · ${exactMovie.quality}\n⭐ IMDb: ${exactMovie.rating} · ${exactMovie.language}\n🔢 Kino kodi: ${formattedCode}`,
        movieCard: exactMovie,
        highlightedCode: formattedCode,
        inlineButtons: [
          [
            { text: `📤 Kodni ulashish (${formattedCode})`, action: `send_code:${exactMovie.code}` },
            { text: '🎲 Tasodifiy kino', action: 'random_movie' },
          ],
          [{ text: '🔢 Barcha kino kodlari', action: 'list_codes' }],
        ],
      },
    ];
  }

  if (/^#?\d+$/.test(raw.replace(/^\/kod\s+/i, '').trim())) {
    const sampleCodes = store.movies
      .slice(0, 5)
      .map((m) => formatCodeWithPrefix(m.code, settings.codePrefix))
      .join(', ');
    pushActivity({
      source,
      eventType: 'code_not_found',
      actor,
      actorMeta,
      actorTelegramId: telegramId,
      movieCode: raw,
      detail: `"${raw}" kodini so'radi (bazada topilmadi)`,
    });
    return [
      {
        text: `"${raw}" kodli kino topilmadi.\n\nMavjud kodlardan birini yuboring: ${sampleCodes || "hozircha yo'q"}`,
        inlineButtons: [[{ text: '🔢 Barcha kino kodlari', action: 'list_codes' }]],
      },
    ];
  }

  const matches = store.movies.filter((m) => {
    const haystack = `${m.title} ${m.genre} ${m.description} ${m.year}`.toLowerCase();
    return haystack.includes(lower);
  });

  if (matches.length > 0) {
    const topMatches = matches.slice(0, 4);
    topMatches.forEach((m) => {
      m.codeSentCount += 1;
    });

    if (topMatches.length === 1) {
      const m = topMatches[0];
      const formattedCode = formatCodeWithPrefix(m.code, settings.codePrefix);
      pushActivity({
        source,
        eventType: 'search_code_sent',
        actor,
        actorMeta,
        actorTelegramId: telegramId,
        movieCode: formattedCode,
        movieTitle: m.title,
        detail: `"${raw}" bo'yicha qidirdi — ${formattedCode} kodi yuborildi`,
      });
      return [
        {
          text: `Kino topildi! Mana uning kodi:\n\n🎬 ${m.title} (${m.year})\n🔢 Kino kodi: ${formattedCode}\n\nKinoni to'liq ochish uchun "${formattedCode}" kodini yuboring yoki pastdagi tugmani bosing.`,
          highlightedCode: formattedCode,
          inlineButtons: [
            [
              { text: `🎬 Kinoni ochish (${formattedCode})`, action: `movie:${m.code}` },
              { text: `📤 Kodni yuborish`, action: `send_code:${m.code}` },
            ],
          ],
        },
      ];
    }

    const lines = topMatches.map((m) => {
      const formattedCode = formatCodeWithPrefix(m.code, settings.codePrefix);
      return `🔢 ${formattedCode} — ${m.title} (${m.year})`;
    });
    const buttons: TelegramInlineButton[][] = topMatches.map((m) => {
      const formattedCode = formatCodeWithPrefix(m.code, settings.codePrefix);
      return [
        { text: `🎬 ${m.title} (${formattedCode})`, action: `movie:${m.code}` },
        { text: `📤 Kodni yuborish`, action: `send_code:${m.code}` },
      ];
    });
    pushActivity({
      source,
      eventType: 'search_code_sent',
      actor,
      actorMeta,
      actorTelegramId: telegramId,
      detail: `"${raw}" bo'yicha ${topMatches.length} ta kino kodi yuborildi`,
    });
    return [
      {
        text: `Qidiruv bo'yicha ${topMatches.length} ta kino kodi topildi:\n\n${lines.join('\n')}\n\nKodni tanlang:`,
        inlineButtons: buttons,
      },
    ];
  }

  pushActivity({
    source,
    eventType: 'code_not_found',
    actor,
    actorMeta,
    actorTelegramId: telegramId,
    detail: `"${raw}" so'rovi bo'yicha kino topilmadi`,
  });
  return [
    {
      text: `"${raw}" bo'yicha kino topilmadi.\nKino kodini (masalan: 101) yoki aniqroq kino nomini yuboring.`,
      inlineButtons: [
        [
          { text: '🔢 Barcha kino kodlari', action: 'list_codes' },
          { text: '🎲 Tasodifiy kino', action: 'random_movie' },
        ],
      ],
    },
  ];
}

// --- Real Telegram Bot API Helpers ---

let pollingLoopId = 0;

async function telegramApiCall(method: string, body?: Record<string, unknown>) {
  const token = getTelegramToken();
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN sozlanmagan');
  }
  const resp = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await resp.json()) as { ok: boolean; result?: unknown; description?: string };
  if (!data.ok) {
    throw new Error(data.description || 'Telegram API xatoligi');
  }
  return data.result;
}

async function telegramMultipartCall(method: string, formData: FormData) {
  const token = getTelegramToken();
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN sozlanmagan');
  }
  const resp = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    body: formData,
  });
  const data = (await resp.json()) as { ok: boolean; result?: unknown; description?: string };
  if (!data.ok) {
    throw new Error(data.description || 'Telegram multipart API xatoligi');
  }
  return data.result;
}

function toTelegramKeyboard(buttons?: TelegramInlineButton[][], watchUrl?: string) {
  const rows: Array<Array<{ text: string; url?: string; callback_data?: string }>> = [];
  if (watchUrl && /^https?:\/\//i.test(watchUrl)) {
    rows.push([{ text: '🎬 Tomosha qilish / Havola', url: watchUrl }]);
  }
  if (buttons && buttons.length > 0) {
    for (const row of buttons) {
      rows.push(
        row.map((btn) =>
          btn.url
            ? { text: btn.text, url: btn.url }
            : { text: btn.text, callback_data: btn.action }
        )
      );
    }
  }
  return rows.length > 0 ? { inline_keyboard: rows } : undefined;
}

async function deliverReplyToTelegram(chatId: number | string, reply: BotReplyPayload) {
  const movie = reply.movieCard;
  const replyMarkup = toTelegramKeyboard(reply.inlineButtons, movie?.watchUrl);

  if (movie) {
    if (movie.telegramFileId) {
      await telegramApiCall('sendVideo', {
        chat_id: chatId,
        video: movie.telegramFileId,
        caption: reply.text.slice(0, 1024),
        reply_markup: replyMarkup,
      });
      return;
    }

    if (movie.videoUrl && movie.videoUrl.startsWith('/uploads/')) {
      const localFile = path.join(UPLOADS_DIR, path.basename(movie.videoUrl));
      if (fs.existsSync(localFile)) {
        const buffer = fs.readFileSync(localFile);
        const form = new FormData();
        form.append('chat_id', String(chatId));
        form.append('caption', reply.text.slice(0, 1024));
        if (replyMarkup) {
          form.append('reply_markup', JSON.stringify(replyMarkup));
        }
        form.append(
          'video',
          new Blob([buffer], { type: 'video/mp4' }),
          movie.videoFileName || `${movie.code}.mp4`
        );
        const sent = (await telegramMultipartCall('sendVideo', form)) as {
          video?: { file_id?: string };
        };
        if (sent?.video?.file_id) {
          movie.telegramFileId = sent.video.file_id;
          saveStore();
          broadcastEvent('state:sync', getFullState());
        }
        return;
      }
    }

    if (movie.videoUrl && /^https?:\/\//i.test(movie.videoUrl)) {
      try {
        await telegramApiCall('sendVideo', {
          chat_id: chatId,
          video: movie.videoUrl,
          caption: reply.text.slice(0, 1024),
          reply_markup: replyMarkup,
        });
        return;
      } catch {
        // Fallback below if direct video fetch fails on Telegram side
      }
    }

    if (movie.posterUrl && movie.posterUrl.startsWith('/src/assets/')) {
      const posterPath = path.join(__dirname, movie.posterUrl.replace(/^\//, ''));
      if (fs.existsSync(posterPath)) {
        const buffer = fs.readFileSync(posterPath);
        const form = new FormData();
        form.append('chat_id', String(chatId));
        form.append('caption', reply.text.slice(0, 1024));
        if (replyMarkup) {
          form.append('reply_markup', JSON.stringify(replyMarkup));
        }
        form.append(
          'photo',
          new Blob([buffer], { type: 'image/jpeg' }),
          `${movie.code}_poster.jpg`
        );
        await telegramMultipartCall('sendPhoto', form);
        return;
      }
    }
  }

  await telegramApiCall('sendMessage', {
    chat_id: chatId,
    text: reply.text,
    reply_markup: replyMarkup,
  });
}

async function notifyAdminInTelegram(
  text: string,
  inlineKeyboard?: Array<Array<{ text: string; callback_data: string }>>
) {
  const adminId = getAdminTelegramId();
  if (!adminId || !getTelegramToken() || !store.settings.notifyAdminInTelegram) return;
  await telegramApiCall('sendMessage', {
    chat_id: adminId,
    text,
    reply_markup: inlineKeyboard ? { inline_keyboard: inlineKeyboard } : undefined,
  }).catch(() => {});
}

// --- Telegram Admin Panel (for Admin ID 8477547711 directly inside Telegram!) ---

function buildAdminHomeKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '📊 Kinolar statistikasi', callback_data: 'admin:stats' },
        { text: '👥 Kirgan odamlar', callback_data: 'admin:users' },
      ],
      [
        { text: "➕ Kino qo'shish", callback_data: 'admin:add_movie' },
        { text: "🗑 Kinoni o'chirish", callback_data: 'admin:movies' },
      ],
      [{ text: '🔢 Barcha kino kodlari', callback_data: 'list_codes' }],
    ],
  };
}

async function sendAdminHome(chatId: number) {
  const stats = computeAnalytics();
  const text = [
    `👑 Admin boshqaruv paneli (${store.settings.botName})`,
    ``,
    `🌐 Saytga kirganlar: ${stats.totalUniqueVisitors} (${stats.onlineSiteVisitors} onlayn)`,
    `👥 Telegram mijozlari: ${stats.totalTelegramUsers} (Bloklangan: ${stats.blockedTelegramUsers})`,
    `🎬 Bazada kinolar: ${stats.totalMovies} ta (Videoli: ${stats.moviesWithVideo})`,
    `📈 Jami ko'rilgan kinolar: ${stats.totalCodeRequests} marta`,
    ``,
    `Tezkor buyruqlar:`,
    `/stat — Kinolar statistikasi`,
    `/users — Kirgan odamlar va ko'rgan kinolari`,
    `/ochir 101 — Kinoni o'chirish`,
    `/ban ID — Foydalanuvchini bloklash`,
    `/unban ID — Blokdan chiqarish`,
  ].join('\n');

  await telegramApiCall('sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: buildAdminHomeKeyboard(),
  });
}

async function sendAdminStats(chatId: number) {
  const stats = computeAnalytics();
  const ranked = [...store.movies].sort((a, b) => b.requestsCount - a.requestsCount);
  const movieLines =
    ranked.length > 0
      ? ranked
          .slice(0, 15)
          .map(
            (m, i) =>
              `${i + 1}. #${formatCodeWithPrefix(m.code, store.settings.codePrefix)} ${m.title} — ${m.requestsCount} marta (${m.duration})`
          )
          .join('\n')
      : "Hozircha kinolar yo'q.";

  const text = [
    `📊 KINOLAR STATISTIKASI`,
    ``,
    `🌐 Sayt tashrifchilari: ${stats.totalUniqueVisitors} ta (Hozir onlayn: ${stats.onlineSiteVisitors})`,
    `👥 Bot foydalanuvchilari: ${stats.totalTelegramUsers} ta`,
    `🚫 Bloklanganlar: ${stats.blockedTelegramUsers} ta`,
    `🎬 Jami kinolar: ${stats.totalMovies} ta`,
    `👁 Jami kino ko'rishlar: ${stats.totalCodeRequests} marta`,
    ``,
    `🏆 Kinolar reytingi:`,
    movieLines,
  ].join('\n');

  await telegramApiCall('sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: buildAdminHomeKeyboard(),
  });
}

async function sendAdminUsers(chatId: number) {
  if (store.botUsers.length === 0) {
    await telegramApiCall('sendMessage', {
      chat_id: chatId,
      text: "Hozircha botga kirgan foydalanuvchilar yo'q.",
      reply_markup: buildAdminHomeKeyboard(),
    });
    return;
  }

  const lines: string[] = [`👥 BOTGA KIRGAN FOYDALANUVCHILAR (${store.botUsers.length} kishi):\n`];
  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

  for (const u of store.botUsers.slice(0, 12)) {
    const fullName = `${u.firstName}${u.lastName ? ` ${u.lastName}` : ''}`;
    const uname = u.username ? u.username : 'username yo‘q';
    const watched =
      u.watchedMovies.length > 0
        ? u.watchedMovies
            .slice(0, 3)
            .map((w) => `#${w.code} ${w.title}`)
            .join(', ')
        : "hali kino ko'rmagan";
    const status = u.isBlocked ? '🚫 BLOKLANGAN' : '✅ Faol';
    lines.push(
      `• ${fullName} (${uname}) | ID: ${u.telegramId}\n  Holat: ${status} · So'rovlar: ${u.requestsCount}\n  Ko'rgan kinolari: ${watched}`
    );

    if (u.telegramId !== getAdminTelegramId()) {
      buttons.push([
        u.isBlocked
          ? { text: `✅ Blokdan chiqarish: ${fullName.slice(0, 18)}`, callback_data: `admin:unban:${u.telegramId}` }
          : { text: `🚫 Bloklash: ${fullName.slice(0, 18)}`, callback_data: `admin:ban:${u.telegramId}` },
      ]);
    }
  }
  buttons.push([{ text: '⬅️ Admin menyu', callback_data: 'admin:home' }]);

  await telegramApiCall('sendMessage', {
    chat_id: chatId,
    text: lines.join('\n\n').slice(0, 4000),
    reply_markup: { inline_keyboard: buttons },
  });
}

async function sendAdminMoviesForDelete(chatId: number) {
  if (store.movies.length === 0) {
    await telegramApiCall('sendMessage', {
      chat_id: chatId,
      text: "Bazada kinolar yo'q.",
      reply_markup: buildAdminHomeKeyboard(),
    });
    return;
  }

  const lines = store.movies.map(
    (m) =>
      `#${formatCodeWithPrefix(m.code, store.settings.codePrefix)} — ${m.title} (${m.duration}, ${m.requestsCount} ko'rish)`
  );
  const buttons: Array<Array<{ text: string; callback_data: string }>> = store.movies
    .slice(0, 12)
    .map((m) => [
      {
        text: `🗑 O'chirish: #${m.code} ${m.title.slice(0, 20)}`,
        callback_data: `admin:del_movie:${m.id}`,
      },
    ]);
  buttons.push([{ text: '⬅️ Admin menyu', callback_data: 'admin:home' }]);

  await telegramApiCall('sendMessage', {
    chat_id: chatId,
    text: `🎬 KINOLAR RO'YXATI (${store.movies.length} ta)\nO'chirish uchun kino ustiga bosing yoki /ochir <kod> yozing:\n\n${lines.join('\n')}`,
    reply_markup: { inline_keyboard: buttons },
  });
}

async function blockTelegramUser(telegramId: number, reason: string, byActor = 'Admin') {
  let user = store.botUsers.find((u) => u.telegramId === telegramId);
  if (!user) {
    user = {
      telegramId,
      firstName: `ID ${telegramId}`,
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      requestsCount: 0,
      lastQuery: '',
      watchedMovies: [],
      isBlocked: true,
      blockedAt: new Date().toISOString(),
      blockedReason: reason,
      warningsCount: 1,
    };
    store.botUsers.unshift(user);
  } else {
    user.isBlocked = true;
    user.blockedAt = new Date().toISOString();
    user.blockedReason = reason;
  }

  // Attempt to notify user & ban from channel if bot is admin in channel
  if (getTelegramToken()) {
    await telegramApiCall('sendMessage', {
      chat_id: telegramId,
      text: `⛔ Siz nojo'ya harakat tufayli botdan chetlatildingiz.\nSabab: ${reason}`,
    }).catch(() => {});

    if (store.settings.channelUsername) {
      await telegramApiCall('banChatMember', {
        chat_id: store.settings.channelUsername,
        user_id: telegramId,
      }).catch(() => {});
    }
  }

  pushActivity({
    source: 'admin',
    eventType: 'user_blocked',
    actor: byActor,
    actorTelegramId: telegramId,
    actorMeta: user.username || `ID: ${telegramId}`,
    detail: `${user.firstName} (${user.username || telegramId}) bloklandi — ${reason}`,
  });

  return user;
}

async function unblockTelegramUser(telegramId: number, byActor = 'Admin') {
  const user = store.botUsers.find((u) => u.telegramId === telegramId);
  if (!user) return null;
  user.isBlocked = false;
  user.blockedAt = undefined;
  user.blockedReason = undefined;

  if (getTelegramToken()) {
    await telegramApiCall('sendMessage', {
      chat_id: telegramId,
      text: `✅ Sizning botga kirish huquqingiz qayta tiklandi.`,
    }).catch(() => {});

    if (store.settings.channelUsername) {
      await telegramApiCall('unbanChatMember', {
        chat_id: store.settings.channelUsername,
        user_id: telegramId,
        only_if_banned: true,
      }).catch(() => {});
    }
  }

  pushActivity({
    source: 'admin',
    eventType: 'user_unblocked',
    actor: byActor,
    actorTelegramId: telegramId,
    actorMeta: user.username || `ID: ${telegramId}`,
    detail: `${user.firstName} (${user.username || telegramId}) blokdan chiqarildi`,
  });

  return user;
}

function upsertTelegramUser(
  from: { id: number; first_name?: string; last_name?: string; username?: string },
  queryLabel: string
): TelegramBotUser {
  const now = new Date().toISOString();
  let existing = store.botUsers.find((u) => u.telegramId === from.id);
  if (!existing) {
    existing = {
      telegramId: from.id,
      firstName: from.first_name || 'Telegram mijoz',
      lastName: from.last_name,
      username: from.username ? `@${from.username}` : undefined,
      joinedAt: now,
      lastActiveAt: now,
      requestsCount: 1,
      lastQuery: queryLabel,
      watchedMovies: [],
      isBlocked: false,
      warningsCount: 0,
    };
    store.botUsers.unshift(existing);
  } else {
    existing.firstName = from.first_name || existing.firstName;
    existing.lastName = from.last_name;
    existing.username = from.username ? `@${from.username}` : existing.username;
    existing.lastActiveAt = now;
    existing.requestsCount += 1;
    existing.lastQuery = queryLabel;
  }
  saveStore();
  return existing;
}

async function handleRealTelegramUpdate(update: Record<string, unknown>) {
  const adminId = getAdminTelegramId();

  const message = update.message as
    | {
        chat?: { id: number };
        from?: { id: number; first_name?: string; last_name?: string; username?: string };
        text?: string;
        caption?: string;
        video?: {
          file_id: string;
          file_name?: string;
          file_size?: number;
          duration?: number;
          width?: number;
          height?: number;
        };
        document?: {
          file_id: string;
          file_name?: string;
          file_size?: number;
          mime_type?: string;
        };
      }
    | undefined;

  const callbackQuery = update.callback_query as
    | {
        id: string;
        data?: string;
        from?: { id: number; first_name?: string; last_name?: string; username?: string };
        message?: { chat?: { id: number } };
      }
    | undefined;

  // --- 1. Callback Query Handling ---
  if (callbackQuery && callbackQuery.message?.chat?.id) {
    const chatId = callbackQuery.message.chat.id;
    const fromId = callbackQuery.from?.id;
    const data = callbackQuery.data || '';
    const isAdmin = Boolean(adminId && fromId === adminId);

    await telegramApiCall('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
    }).catch(() => {});

    // Admin callbacks inside Telegram
    if (data.startsWith('admin:')) {
      if (!isAdmin) {
        await telegramApiCall('sendMessage', {
          chat_id: chatId,
          text: '⛔ Bu bo‘lim faqat admin uchun.',
        }).catch(() => {});
        return;
      }

      if (data === 'admin:home') {
        adminWizards.delete(chatId);
        await sendAdminHome(chatId);
        return;
      }
      if (data === 'admin:stats') {
        await sendAdminStats(chatId);
        return;
      }
      if (data === 'admin:users') {
        await sendAdminUsers(chatId);
        return;
      }
      if (data === 'admin:movies') {
        await sendAdminMoviesForDelete(chatId);
        return;
      }
      if (data === 'admin:add_movie') {
        adminWizards.set(chatId, { step: 'await_media' });
        await telegramApiCall('sendMessage', {
          chat_id: chatId,
          text: "➕ YANGI KINO QO'SHISH\n\n1-qadam: Kino videosini shu yerga yuboring (yoki to'g'ridan-to'g'ri video URL manzilini yozing).\nBot daqiqasi va sifatini o'zi avtomatik aniqlaydi!\n\nBekor qilish: /bekor",
        });
        return;
      }
      if (data.startsWith('admin:ban:')) {
        const targetId = Number(data.slice('admin:ban:'.length));
        if (targetId && targetId !== adminId) {
          const u = await blockTelegramUser(targetId, "Nojo'ya harakat (Admin blokladi)", 'Admin (Telegram)');
          await telegramApiCall('sendMessage', {
            chat_id: chatId,
            text: `🚫 ${u.firstName} (${u.username || targetId}) muvaffaqiyatli bloklandi va botdan chiqarib tashlandi.`,
            reply_markup: buildAdminHomeKeyboard(),
          });
        }
        return;
      }
      if (data.startsWith('admin:unban:')) {
        const targetId = Number(data.slice('admin:unban:'.length));
        if (targetId) {
          const u = await unblockTelegramUser(targetId, 'Admin (Telegram)');
          await telegramApiCall('sendMessage', {
            chat_id: chatId,
            text: u
              ? `✅ ${u.firstName} (${u.username || targetId}) blokdan chiqarildi.`
              : 'Foydalanuvchi topilmadi.',
            reply_markup: buildAdminHomeKeyboard(),
          });
        }
        return;
      }
      if (data.startsWith('admin:del_movie:')) {
        const movieId = data.slice('admin:del_movie:'.length);
        const target = store.movies.find((m) => m.id === movieId);
        if (target) {
          store.movies = store.movies.filter((m) => m.id !== movieId);
          pushActivity({
            source: 'admin',
            eventType: 'movie_deleted',
            actor: 'Admin (Telegram)',
            movieCode: target.code,
            movieTitle: target.title,
            detail: `"${target.title}" (#${target.code}) Telegram admin paneldan o'chirildi`,
          });
          await telegramApiCall('sendMessage', {
            chat_id: chatId,
            text: `🗑 "${target.title}" (#${target.code}) bazadan o'chirildi.`,
            reply_markup: buildAdminHomeKeyboard(),
          });
        }
        return;
      }
    }

    // Regular user callback
    const user = callbackQuery.from
      ? upsertTelegramUser(callbackQuery.from, data || 'tugma')
      : null;
    if (user?.isBlocked && !isAdmin) {
      await telegramApiCall('sendMessage', {
        chat_id: chatId,
        text: '⛔ Siz botdan chetlatilgansiz.',
      }).catch(() => {});
      return;
    }

    const actorName = user
      ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
      : `Chat #${chatId}`;
    const replies = processBotInput(undefined, data, {
      source: 'telegram',
      actor: actorName,
      actorMeta: user?.username || `ID: ${chatId}`,
      telegramId: fromId,
    });
    for (const reply of replies) {
      await deliverReplyToTelegram(chatId, reply).catch(() => {});
    }
    return;
  }

  // --- 2. Message Handling ---
  if (!message?.chat?.id) return;
  const chatId = message.chat.id;
  const fromId = message.from?.id;
  const isAdmin = Boolean(adminId && fromId === adminId);
  const text = (message.text || '').trim();

  // Check if non-admin user is blocked
  if (!isAdmin && fromId) {
    const existing = store.botUsers.find((u) => u.telegramId === fromId);
    if (existing?.isBlocked) {
      await telegramApiCall('sendMessage', {
        chat_id: chatId,
        text: "⛔ Siz nojo'ya harakat sababli botdan chetlatilgansiz.",
      }).catch(() => {});
      return;
    }
  }

  // --- Admin Interactive Add-Movie Wizard inside Telegram ---
  if (isAdmin && text === '/bekor') {
    adminWizards.delete(chatId);
    await sendAdminHome(chatId);
    return;
  }

  const wizard = isAdmin ? adminWizards.get(chatId) : undefined;
  const incomingMedia =
    message.video ||
    (message.document && message.document.mime_type?.startsWith('video/')
      ? message.document
      : null);

  if (isAdmin && wizard) {
    if (wizard.step === 'await_media') {
      if (incomingMedia) {
        const durSec = 'duration' in incomingMedia ? incomingMedia.duration || 0 : 0;
        const w = 'width' in incomingMedia ? incomingMedia.width : undefined;
        const h = 'height' in incomingMedia ? incomingMedia.height : undefined;
        const rawName = incomingMedia.file_name || `kino_${Date.now()}.mp4`;
        wizard.telegramFileId = incomingMedia.file_id;
        wizard.videoFileName = rawName;
        wizard.videoFileSize = incomingMedia.file_size || 0;
        wizard.detectedDuration = formatDurationFromSeconds(durSec);
        wizard.detectedQuality = detectQualityFromDimensions(w, h);
        wizard.suggestedTitle = message.caption?.trim() || cleanTitleFromFilename(rawName) || 'Yangi kino';
        wizard.step = 'await_code';
        adminWizards.set(chatId, wizard);

        const nextCodeNum =
          store.movies
            .map((m) => parseInt(m.code, 10))
            .filter((n) => !Number.isNaN(n))
            .reduce((max, n) => Math.max(max, n), 100) + 1;

        await telegramApiCall('sendMessage', {
          chat_id: chatId,
          text: `✅ Video qabul qilindi!\n⏱ Avto-aniqlangan davomiylik: ${wizard.detectedDuration}\n🎞 Sifat: ${wizard.detectedQuality}\n📝 Taxminiy nom: ${wizard.suggestedTitle}\n\n2-qadam: Kino kodini yuboring (masalan: ${nextCodeNum}):`,
        });
        return;
      }

      if (/^https?:\/\//i.test(text)) {
        wizard.videoUrl = text;
        wizard.detectedDuration = '120 daq';
        wizard.detectedQuality = /2160|4k/i.test(text)
          ? '4K UHD'
          : /720/i.test(text)
          ? '720p HD'
          : '1080p Full HD';
        wizard.suggestedTitle = cleanTitleFromFilename(text.split('/').pop() || 'Yangi kino') || 'Yangi kino';
        wizard.step = 'await_code';
        adminWizards.set(chatId, wizard);
        await telegramApiCall('sendMessage', {
          chat_id: chatId,
          text: `✅ Video havola qabul qilindi!\n🎞 Aniqlangan sifat: ${wizard.detectedQuality}\n\n2-qadam: Kino kodini yuboring (masalan: 106):`,
        });
        return;
      }

      await telegramApiCall('sendMessage', {
        chat_id: chatId,
        text: 'Iltimos, kino videosini yoki https:// video havolasini yuboring (bekor qilish: /bekor).',
      });
      return;
    }

    if (wizard.step === 'await_code') {
      const code = normalizeCodeInput(text, store.settings.codePrefix);
      if (!code) {
        await telegramApiCall('sendMessage', {
          chat_id: chatId,
          text: 'Iltimos, to‘g‘ri kino kodini kiriting (masalan: 106).',
        });
        return;
      }
      if (isDuplicateCode(code)) {
        await telegramApiCall('sendMessage', {
          chat_id: chatId,
          text: `❌ "${code}" kodi allaqachon boshqa kinoga biriktirilgan!\nBir xil kod kiritib bo'lmaydi. Iltimos, boshqa bo'sh kod yuboring:`,
        });
        return;
      }
      wizard.code = code;
      wizard.step = 'await_title';
      adminWizards.set(chatId, wizard);
      await telegramApiCall('sendMessage', {
        chat_id: chatId,
        text: `✅ Kod qabul qilindi: #${code}\n\n3-qadam: Kino nomini yuboring (avto-nom "${wizard.suggestedTitle}" ni qoldirish uchun "." yuboring):`,
      });
      return;
    }

    if (wizard.step === 'await_title') {
      const finalTitle = text === '.' || !text ? wizard.suggestedTitle || 'Yangi kino' : text;
      const newMovie: Movie = {
        id: `mov-${Date.now()}`,
        code: wizard.code || String(Date.now()).slice(-4),
        title: finalTitle,
        year: new Date().getFullYear(),
        genre: 'Kino',
        duration: wizard.detectedDuration || '120 daq',
        quality: wizard.detectedQuality || '1080p Full HD',
        language: "O'zbek tilida",
        rating: '8.0',
        description: `${finalTitle} — Telegram orqali joylangan kino.`,
        posterUrl: '',
        watchUrl: store.settings.channelUsername
          ? `https://t.me/${store.settings.channelUsername.replace(/^@/, '')}/${wizard.code}`
          : '',
        telegramFileId: wizard.telegramFileId,
        videoUrl: wizard.videoUrl,
        videoFileName: wizard.videoFileName,
        videoFileSize: wizard.videoFileSize,
        requestsCount: 0,
        codeSentCount: 0,
        createdAt: new Date().toISOString(),
      };
      store.movies.unshift(newMovie);
      adminWizards.delete(chatId);
      pushActivity({
        source: 'admin',
        eventType: 'movie_added',
        actor: 'Admin (Telegram)',
        movieCode: newMovie.code,
        movieTitle: newMovie.title,
        detail: `Telegramdan yangi kino qo'shildi: "${newMovie.title}" (#${newMovie.code}, ${newMovie.duration}, ${newMovie.quality})`,
      });
      await telegramApiCall('sendMessage', {
        chat_id: chatId,
        text: `🎉 Kino muvaffaqiyatli qo'shildi!\n\n🎬 Nomi: ${newMovie.title}\n🔢 Kodi: ${newMovie.code}\n⏱ Davomiylik: ${newMovie.duration}\n🎞 Sifat: ${newMovie.quality}\n\nEndi mijoz "${newMovie.code}" yozsa kino avtomatik boradi!`,
        reply_markup: buildAdminHomeKeyboard(),
      });
      return;
    }
  }

  // --- Capture Video Sent Directly to Bot (outside wizard) ---
  if (incomingMedia) {
    const user = message.from ? upsertTelegramUser(message.from, 'Video yubordi') : null;
    const fromName = user
      ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
      : `Chat #${chatId}`;
    const durSec = 'duration' in incomingMedia ? incomingMedia.duration || 0 : 0;
    const w = 'width' in incomingMedia ? incomingMedia.width : undefined;
    const h = 'height' in incomingMedia ? incomingMedia.height : undefined;

    const videoRecord: IncomingTelegramVideo = {
      id: `vid-${Date.now()}`,
      fileId: incomingMedia.file_id,
      fileName: incomingMedia.file_name || `telegram_video_${Date.now()}.mp4`,
      fileSize: incomingMedia.file_size || 0,
      durationSeconds: durSec,
      width: w,
      height: h,
      fromName,
      fromUsername: user?.username,
      caption: message.caption,
      receivedAt: new Date().toISOString(),
    };
    store.incomingVideos.unshift(videoRecord);
    if (store.incomingVideos.length > 30) {
      store.incomingVideos = store.incomingVideos.slice(0, 30);
    }
    pushActivity({
      source: 'telegram',
      eventType: 'video_received',
      actor: fromName,
      actorTelegramId: fromId,
      actorMeta: user?.username || `ID: ${chatId}`,
      detail: `Video qabul qilindi: ${videoRecord.fileName} (${formatDurationFromSeconds(durSec)}, ${detectQualityFromDimensions(w, h)})`,
    });
    await telegramApiCall('sendMessage', {
      chat_id: chatId,
      text: `✅ Video saytga saqlandi!\n⏱ Davomiylik: ${formatDurationFromSeconds(durSec)} · 🎞 ${detectQualityFromDimensions(w, h)}\n\nSaytda "Kino qo'shish" orqali kod bering yoki /admin dan "➕ Kino qo'shish" tugmasini bosing.`,
      reply_markup: isAdmin ? buildAdminHomeKeyboard() : undefined,
    }).catch(() => {});
    return;
  }

  // --- Admin Commands in Telegram ---
  if (isAdmin && text) {
    const lower = text.toLowerCase();
    if (lower === '/admin' || lower === '/start') {
      await sendAdminHome(chatId);
      return;
    }
    if (lower === '/stat' || lower === '/statistika') {
      await sendAdminStats(chatId);
      return;
    }
    if (lower === '/users' || lower === '/odamlar') {
      await sendAdminUsers(chatId);
      return;
    }
    if (lower === '/kinolar') {
      await sendAdminMoviesForDelete(chatId);
      return;
    }
    if (lower.startsWith('/ochir ')) {
      const codeArg = normalizeCodeInput(text.slice('/ochir '.length), store.settings.codePrefix);
      const target = findMovieByCode(codeArg);
      if (!target) {
        await telegramApiCall('sendMessage', {
          chat_id: chatId,
          text: `❌ "${codeArg}" kodli kino topilmadi.`,
        });
        return;
      }
      store.movies = store.movies.filter((m) => m.id !== target.id);
      pushActivity({
        source: 'admin',
        eventType: 'movie_deleted',
        actor: 'Admin (Telegram)',
        movieCode: target.code,
        movieTitle: target.title,
        detail: `"${target.title}" (#${target.code}) o'chirildi`,
      });
      await telegramApiCall('sendMessage', {
        chat_id: chatId,
        text: `🗑 "${target.title}" (#${target.code}) bazadan o'chirildi.`,
        reply_markup: buildAdminHomeKeyboard(),
      });
      return;
    }
    if (lower.startsWith('/ban ')) {
      const parts = text.split(/\s+/);
      const targetId = Number(parts[1]);
      const reason = parts.slice(2).join(' ') || "Nojo'ya harakat";
      if (!targetId || targetId === adminId) {
        await telegramApiCall('sendMessage', {
          chat_id: chatId,
          text: 'Foydalanish: /ban <telegram_id> [sabab]',
        });
        return;
      }
      const u = await blockTelegramUser(targetId, reason, 'Admin (Telegram)');
      await telegramApiCall('sendMessage', {
        chat_id: chatId,
        text: `🚫 ${u.firstName} (ID: ${targetId}) bloklandi.`,
      });
      return;
    }
    if (lower.startsWith('/unban ')) {
      const targetId = Number(text.split(/\s+/)[1]);
      if (!targetId) {
        await telegramApiCall('sendMessage', {
          chat_id: chatId,
          text: 'Foydalanish: /unban <telegram_id>',
        });
        return;
      }
      const u = await unblockTelegramUser(targetId, 'Admin (Telegram)');
      await telegramApiCall('sendMessage', {
        chat_id: chatId,
        text: u ? `✅ ${u.firstName} (ID: ${targetId}) blokdan chiqarildi.` : 'Foydalanuvchi topilmadi.',
      });
      return;
    }
  }

  // --- Regular Customer Text Handling + Abuse / Flood Protection ---
  if (text) {
    const user = message.from ? upsertTelegramUser(message.from, text) : null;
    const actorName = user
      ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
      : `Chat #${chatId}`;
    const actorMeta = user?.username || `ID: ${chatId}`;

    // Detect abuse or spam flooding from non-admin users
    if (!isAdmin && fromId) {
      const abusive = isInappropriateText(text);
      const flooding = checkFlood(fromId);
      if (abusive || flooding) {
        if (user) {
          user.warningsCount += 1;
          saveStore();
        }
        const reasonText = abusive ? "Nojo'ya so'z ishlatdi" : 'Spam / ketma-ket xabar yubordi';
        pushActivity({
          source: 'telegram',
          eventType: 'abuse_flagged',
          actor: actorName,
          actorMeta,
          actorTelegramId: fromId,
          detail: `⚠️ ${reasonText}: "${text.slice(0, 60)}"`,
        });
        await telegramApiCall('sendMessage', {
          chat_id: chatId,
          text: "⚠️ Iltimos, odob qoidalariga rioya qiling! Aks holda admin tomonidan botdan chetlatilasiz.",
        }).catch(() => {});

        await notifyAdminInTelegram(
          `⚠️ NOJO'YA HARAKAT ANIQLANDI!\n\n👤 ${actorName} (${actorMeta})\n🆔 ID: ${fromId}\n📌 Sabab: ${reasonText}\n💬 Xabar: "${text.slice(0, 120)}"`,
          [[{ text: `🚫 ${actorName} ni bloklash`, callback_data: `admin:ban:${fromId}` }]]
        );
        return;
      }
    }

    const replies = processBotInput(text, undefined, {
      source: 'telegram',
      actor: actorName,
      actorMeta,
      telegramId: fromId,
    });
    for (const reply of replies) {
      await deliverReplyToTelegram(chatId, reply).catch(() => {});
    }

    // Notify Admin in Telegram when a real customer starts bot or watches a movie
    if (!isAdmin && fromId) {
      const watchedCard = replies.find((r) => r.movieCard)?.movieCard;
      if (watchedCard) {
        await notifyAdminInTelegram(
          `🎬 Mijoz kino ko'rdi:\n👤 ${actorName} (${actorMeta})\n🆔 ID: ${fromId}\n🎞 Kino: #${watchedCard.code} — ${watchedCard.title}`,
          [[{ text: '🚫 Foydalanuvchini bloklash', callback_data: `admin:ban:${fromId}` }]]
        );
      } else if (text.toLowerCase() === '/start') {
        await notifyAdminInTelegram(
          `👤 Yangi mijoz botga kirdi:\nIsm: ${actorName}\nUsername: ${actorMeta}\nID: ${fromId}`,
          [[{ text: '🚫 Bloklash', callback_data: `admin:ban:${fromId}` }]]
        );
      }
    }
  }
}

async function startTelegramPolling() {
  const token = getTelegramToken();
  telegramLiveState.configured = Boolean(token);
  telegramLiveState.adminTelegramId = getAdminTelegramId();
  telegramLiveState.lastCheckedAt = new Date().toISOString();

  if (!token) {
    telegramLiveState.pollingActive = false;
    telegramLiveState.connectedUsername = null;
    telegramLiveState.botId = null;
    telegramLiveState.lastError = null;
    broadcastEvent('state:sync', getFullState());
    return;
  }

  const currentLoop = ++pollingLoopId;
  try {
    const me = (await telegramApiCall('getMe')) as { id?: number; username?: string; first_name?: string };
    await telegramApiCall('deleteWebhook', { drop_pending_updates: false }).catch(() => {});

    telegramLiveState.botId = me?.id || null;
    telegramLiveState.connectedUsername = me?.username ? `@${me.username}` : null;
    if (me?.username) {
      store.settings.botUsername = `@${me.username}`;
      if (me.first_name) store.settings.botName = me.first_name;
      saveStore();
    }
    telegramLiveState.pollingActive = true;
    telegramLiveState.lastError = null;
    telegramLiveState.lastCheckedAt = new Date().toISOString();
    broadcastEvent('state:sync', getFullState());

    console.log(
      `Telegram Bot ulangan: ${telegramLiveState.connectedUsername} (Admin ID: ${telegramLiveState.adminTelegramId})`
    );

    let offset = 0;
    const poll = async () => {
      while (telegramLiveState.pollingActive && currentLoop === pollingLoopId) {
        try {
          const updates = (await telegramApiCall('getUpdates', {
            offset,
            timeout: 20,
            allowed_updates: ['message', 'callback_query'],
          })) as Array<{ update_id: number } & Record<string, unknown>>;

          for (const upd of updates) {
            offset = upd.update_id + 1;
            await handleRealTelegramUpdate(upd);
          }
        } catch (err) {
          telegramLiveState.lastError =
            err instanceof Error ? err.message : 'Telegram polling xatoligi';
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    };
    void poll();
  } catch (err) {
    telegramLiveState.pollingActive = false;
    telegramLiveState.lastError =
      err instanceof Error ? err.message : "Telegram bot tokenini tekshirib bo'lmadi";
    broadcastEvent('state:sync', getFullState());
  }
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Real-time Server-Sent Events stream
  app.get('/api/events', (req: Request, res: Response) => {
    const visitorId =
      typeof req.query.visitorId === 'string' && req.query.visitorId.trim()
        ? req.query.visitorId.trim()
        : `anon-${Date.now()}`;
    const clientId = `${visitorId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.set(clientId, { id: clientId, visitorId, res });
    res.write(`event: state:sync\ndata: ${JSON.stringify(getFullState())}\n\n`);
    broadcastEvent('presence:update', computeAnalytics());

    const keepAlive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(keepAlive);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(clientId);
      broadcastEvent('presence:update', computeAnalytics());
    });
  });

  // Real website visit tracking
  app.post('/api/analytics/visit', (req: Request, res: Response) => {
    const { visitorId } = req.body as { visitorId?: string };
    const cleanId = visitorId?.trim() || `vis-${Date.now()}`;
    const userAgent = (req.headers['user-agent'] || 'Brauzer').slice(0, 120);
    const now = new Date().toISOString();

    let visitor = store.siteVisitors.find((v) => v.visitorId === cleanId);
    const isNew = !visitor;
    if (!visitor) {
      visitor = {
        visitorId: cleanId,
        firstSeenAt: now,
        lastSeenAt: now,
        views: 1,
        userAgent,
      };
      store.siteVisitors.unshift(visitor);
    } else {
      visitor.lastSeenAt = now;
      visitor.views += 1;
      visitor.userAgent = userAgent;
    }
    store.totalPageViews += 1;

    if (isNew) {
      pushActivity({
        source: 'website',
        eventType: 'site_visit',
        actor: 'Sayt tashrifchisi',
        actorMeta: cleanId.slice(0, 10),
        detail: 'Saytga kirdi',
      });
    } else {
      saveStore();
      broadcastEvent('presence:update', computeAnalytics());
    }

    res.json({ ok: true, analytics: computeAnalytics() });
  });

  // Auto-probe a video URL to extract title, size, quality, year, and duration hints
  app.post('/api/movies/probe-url', async (req: Request, res: Response) => {
    const { url } = req.body as { url?: string };
    const cleanUrl = url?.trim() || '';
    if (!/^https?:\/\//i.test(cleanUrl)) {
      res.status(400).json({ error: "To'g'ri https:// havola kiriting." });
      return;
    }

    try {
      const parsedUrl = new URL(cleanUrl);
      const lastSegment = decodeURIComponent(parsedUrl.pathname.split('/').pop() || '');
      let title = cleanTitleFromFilename(lastSegment);
      let fileSize: number | undefined;
      let contentType = '';
      let description = '';
      let duration = '';
      let year: number | undefined;

      const yearMatch = cleanUrl.match(/\b(199\d|20[0-2]\d)\b/);
      if (yearMatch) year = Number(yearMatch[1]);

      const quality = /2160|4k|uhd/i.test(cleanUrl)
        ? '4K UHD'
        : /720/i.test(cleanUrl)
        ? '720p HD'
        : /480/i.test(cleanUrl)
        ? '480p SD'
        : '1080p Full HD';

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const headResp = await fetch(cleanUrl, {
          method: 'HEAD',
          signal: controller.signal,
          redirect: 'follow',
        });
        contentType = headResp.headers.get('content-type') || '';
        const cl = headResp.headers.get('content-length');
        if (cl && !Number.isNaN(Number(cl))) {
          fileSize = Number(cl);
        }

        // If HTML page (like Telegram post / movie page), extract og:title & duration metadata
        if (contentType.includes('text/html')) {
          const getResp = await fetch(cleanUrl, {
            method: 'GET',
            signal: controller.signal,
            redirect: 'follow',
          });
          const html = (await getResp.text()).slice(0, 40000);
          const ogTitle = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1];
          const htmlTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
          const ogDesc = html.match(/property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1];
          const isoDur = html.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);

          if (ogTitle) title = ogTitle.trim();
          else if (htmlTitle) title = htmlTitle.trim();
          if (ogDesc) description = ogDesc.trim().slice(0, 260);
          if (isoDur && (isoDur[1] || isoDur[2])) {
            const totalMin = Number(isoDur[1] || 0) * 60 + Number(isoDur[2] || 0);
            if (totalMin > 0) duration = `${totalMin} daq`;
          }
          if (!year) {
            const yr = `${title} ${description}`.match(/\b(199\d|20[0-2]\d)\b/);
            if (yr) year = Number(yr[1]);
          }
        }
      } catch {
        // Proceed with URL-derived hints even if remote host blocks HEAD/GET
      } finally {
        clearTimeout(timeout);
      }

      res.json({
        title: title || undefined,
        description: description || undefined,
        duration: duration || undefined,
        quality,
        year,
        fileSize,
        isDirectVideo: contentType.startsWith('video/') || /\.(mp4|mov|mkv|webm)(\?|$)/i.test(cleanUrl),
      });
    } catch {
      res.status(400).json({ error: 'Havolani tahlil qilib bo‘lmadi.' });
    }
  });

  // Upload real video file (up to 50MB)
  app.post(
    '/api/upload/video',
    express.raw({ type: '*/*', limit: '50mb' }),
    (req: Request, res: Response) => {
      const buffer = req.body as Buffer;
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        res.status(400).json({ error: 'Video fayl bo‘sh yoki yuborilmadi.' });
        return;
      }

      const rawNameHeader = String(req.headers['x-file-name'] || 'kino.mp4');
      let decodedName = 'kino.mp4';
      try {
        decodedName = decodeURIComponent(rawNameHeader);
      } catch {
        decodedName = rawNameHeader;
      }
      const ext = path.extname(decodedName).toLowerCase() || '.mp4';
      const safeExt = ['.mp4', '.mov', '.mkv', '.webm'].includes(ext) ? ext : '.mp4';
      const storedName = `video_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${safeExt}`;
      const fullPath = path.join(UPLOADS_DIR, storedName);

      ensureDirectories();
      fs.writeFileSync(fullPath, buffer);

      res.status(201).json({
        videoUrl: `/uploads/${storedName}`,
        videoFileName: decodedName,
        videoFileSize: buffer.length,
      });
    }
  );

  // Block / Unblock Telegram user from Website Admin Panel
  app.post('/api/users/:telegramId/block', async (req: Request, res: Response) => {
    const telegramId = Number(req.params.telegramId);
    const { reason } = req.body as { reason?: string };
    if (!Number.isFinite(telegramId) || telegramId <= 0) {
      res.status(400).json({ error: "Noto'g'ri Telegram ID." });
      return;
    }
    if (telegramId === getAdminTelegramId()) {
      res.status(400).json({ error: 'Adminni bloklab bo‘lmaydi.' });
      return;
    }
    await blockTelegramUser(telegramId, reason?.trim() || "Nojo'ya harakat", 'Admin (Sayt)');
    res.json({ state: getFullState() });
  });

  app.post('/api/users/:telegramId/unblock', async (req: Request, res: Response) => {
    const telegramId = Number(req.params.telegramId);
    if (!Number.isFinite(telegramId) || telegramId <= 0) {
      res.status(400).json({ error: "Noto'g'ri Telegram ID." });
      return;
    }
    await unblockTelegramUser(telegramId, 'Admin (Sayt)');
    res.json({ state: getFullState() });
  });

  // Full state snapshot
  app.get('/api/state', (_req: Request, res: Response) => {
    res.json(getFullState());
  });

  // Reconnect real Telegram bot
  app.post('/api/telegram/reconnect', async (_req: Request, res: Response) => {
    await startTelegramPolling();
    res.json({ telegramLive: telegramLiveState });
  });

  // Send real statistics directly to Admin's Telegram chat on demand
  app.post('/api/telegram/send-stats-to-admin', async (_req: Request, res: Response) => {
    const adminId = getAdminTelegramId();
    if (!adminId || !getTelegramToken()) {
      res.status(400).json({ error: 'Telegram bot token yoki Admin ID ulanmagan.' });
      return;
    }
    try {
      await sendAdminStats(adminId);
      res.json({ ok: true, message: `Statistika Telegram admin (${adminId}) ga yuborildi.` });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Telegramga yuborishda xatolik.',
      });
    }
  });

  // Create movie (strict duplicate code prevention)
  app.post('/api/movies', (req: Request, res: Response) => {
    const body = req.body as Partial<Movie>;
    const title = body.title?.trim();
    if (!title) {
      res.status(400).json({ error: 'Kino nomi kiritilishi shart.' });
      return;
    }

    let code = normalizeCodeInput(body.code || '', store.settings.codePrefix);
    if (!code) {
      const numericCodes = store.movies
        .map((m) => parseInt(m.code, 10))
        .filter((n) => !Number.isNaN(n));
      const nextNum = numericCodes.length > 0 ? Math.max(...numericCodes) + 1 : 101;
      code = String(nextNum);
    }

    if (isDuplicateCode(code)) {
      res.status(409).json({
        error: `"${code}" kodi allaqachon boshqa kinoda bor! Bir xil kod kiritish taqiqlangan.`,
      });
      return;
    }

    const movie: Movie = {
      id: `mov-${Date.now()}`,
      code,
      title,
      year: Number(body.year) || new Date().getFullYear(),
      genre: body.genre?.trim() || 'Drama',
      duration: body.duration?.trim() || '120 daq',
      quality: body.quality?.trim() || '1080p Full HD',
      language: body.language?.trim() || "O'zbek tilida",
      rating: body.rating?.trim() || '8.0',
      description: body.description?.trim() || `${title} — yangi qo'shilgan kino.`,
      posterUrl: body.posterUrl?.trim() || '',
      watchUrl:
        body.watchUrl?.trim() ||
        (store.settings.channelUsername
          ? `https://t.me/${store.settings.channelUsername.replace(/^@/, '')}/${code}`
          : ''),
      telegramFileId: body.telegramFileId?.trim() || undefined,
      videoUrl: body.videoUrl?.trim() || undefined,
      videoFileName: body.videoFileName?.trim() || undefined,
      videoFileSize: typeof body.videoFileSize === 'number' ? body.videoFileSize : undefined,
      requestsCount: 0,
      codeSentCount: 0,
      createdAt: new Date().toISOString(),
    };

    store.movies.unshift(movie);
    const formattedCode = formatCodeWithPrefix(movie.code, store.settings.codePrefix);
    pushActivity({
      source: 'admin',
      eventType: 'movie_added',
      actor: 'Admin',
      movieCode: formattedCode,
      movieTitle: movie.title,
      detail: `Yangi kino joylandi: "${movie.title}" (Kod: ${formattedCode}, ${movie.duration})`,
    });

    res.status(201).json({ movie, state: getFullState() });
  });

  // Update movie (strict duplicate code prevention)
  app.put('/api/movies/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const idx = store.movies.findIndex((m) => m.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Kino topilmadi.' });
      return;
    }

    const body = req.body as Partial<Movie>;
    const newCode = normalizeCodeInput(
      body.code || store.movies[idx].code,
      store.settings.codePrefix
    );
    if (isDuplicateCode(newCode, id)) {
      res.status(409).json({
        error: `"${newCode}" kodi allaqachon boshqa kinoda band! Boshqa kod kiriting.`,
      });
      return;
    }

    store.movies[idx] = {
      ...store.movies[idx],
      code: newCode,
      title: body.title?.trim() || store.movies[idx].title,
      year: Number(body.year) || store.movies[idx].year,
      genre: body.genre?.trim() || store.movies[idx].genre,
      duration: body.duration?.trim() || store.movies[idx].duration,
      quality: body.quality?.trim() || store.movies[idx].quality,
      language: body.language?.trim() || store.movies[idx].language,
      rating: body.rating?.trim() || store.movies[idx].rating,
      description: body.description?.trim() ?? store.movies[idx].description,
      posterUrl: body.posterUrl !== undefined ? body.posterUrl.trim() : store.movies[idx].posterUrl,
      watchUrl: body.watchUrl !== undefined ? body.watchUrl.trim() : store.movies[idx].watchUrl,
      telegramFileId:
        body.telegramFileId !== undefined
          ? body.telegramFileId.trim() || undefined
          : store.movies[idx].telegramFileId,
      videoUrl:
        body.videoUrl !== undefined
          ? body.videoUrl.trim() || undefined
          : store.movies[idx].videoUrl,
      videoFileName:
        body.videoFileName !== undefined
          ? body.videoFileName.trim() || undefined
          : store.movies[idx].videoFileName,
      videoFileSize:
        body.videoFileSize !== undefined ? body.videoFileSize : store.movies[idx].videoFileSize,
    };

    const updatedMovie = store.movies[idx];
    const formattedCode = formatCodeWithPrefix(updatedMovie.code, store.settings.codePrefix);
    pushActivity({
      source: 'admin',
      eventType: 'movie_updated',
      actor: 'Admin',
      movieCode: formattedCode,
      movieTitle: updatedMovie.title,
      detail: `"${updatedMovie.title}" (${formattedCode}) tahrirlandi`,
    });

    res.json({ movie: updatedMovie, state: getFullState() });
  });

  // Delete movie
  app.delete('/api/movies/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const target = store.movies.find((m) => m.id === id);
    if (!target) {
      res.status(404).json({ error: 'Kino topilmadi.' });
      return;
    }
    store.movies = store.movies.filter((m) => m.id !== id);
    pushActivity({
      source: 'admin',
      eventType: 'movie_deleted',
      actor: 'Admin',
      movieCode: target.code,
      movieTitle: target.title,
      detail: `"${target.title}" (#${target.code}) o'chirildi`,
    });
    res.json({ state: getFullState() });
  });

  // Update bot settings
  app.put('/api/settings', (req: Request, res: Response) => {
    const body = req.body as Partial<BotSettings>;
    store.settings = {
      ...store.settings,
      botName: body.botName?.trim() || store.settings.botName,
      botUsername: body.botUsername?.trim() || store.settings.botUsername,
      channelUsername: body.channelUsername?.trim() ?? store.settings.channelUsername,
      codePrefix:
        body.codePrefix !== undefined ? body.codePrefix.trim() : store.settings.codePrefix,
      welcomeMessage: body.welcomeMessage?.trim() || store.settings.welcomeMessage,
      requireSubscription:
        typeof body.requireSubscription === 'boolean'
          ? body.requireSubscription
          : store.settings.requireSubscription,
      autoSendCodeOnSearch:
        typeof body.autoSendCodeOnSearch === 'boolean'
          ? body.autoSendCodeOnSearch
          : store.settings.autoSendCodeOnSearch,
      notifyAdminInTelegram:
        typeof body.notifyAdminInTelegram === 'boolean'
          ? body.notifyAdminInTelegram
          : store.settings.notifyAdminInTelegram,
    };
    saveStore();
    broadcastEvent('state:sync', getFullState());
    res.json({ settings: store.settings, state: getFullState() });
  });

  // Interactive Bot Chat endpoint
  app.post('/api/bot/message', (req: Request, res: Response) => {
    const { text, action } = req.body as { text?: string; action?: string };
    const replies = processBotInput(text, action, {
      source: 'website',
      actor: 'Sayt sinov chati',
    });
    res.json({
      replies,
      state: getFullState(),
    });
  });

  // Send Movie Code endpoint
  app.post('/api/bot/send-code', async (req: Request, res: Response) => {
    const {
      movieId,
      template = 'channel_post',
      target = '',
      includeDetails = true,
      includeBotLink = true,
      includeChannel = true,
      customNote = '',
      sendToTelegramApi = false,
    } = req.body as {
      movieId?: string;
      template?: 'channel_post' | 'short_code' | 'direct_reply';
      target?: string;
      includeDetails?: boolean;
      includeBotLink?: boolean;
      includeChannel?: boolean;
      customNote?: string;
      sendToTelegramApi?: boolean;
    };

    const movie = store.movies.find((m) => m.id === movieId);
    if (!movie) {
      res.status(404).json({ error: 'Tanlangan kino topilmadi.' });
      return;
    }

    const formattedCode = formatCodeWithPrefix(movie.code, store.settings.codePrefix);
    const messageText = buildCodeMessage(movie, template, {
      includeDetails,
      includeBotLink,
      includeChannel,
      customNote,
    });

    let deliveryMode: 'simulator' | 'telegram_api' = 'simulator';
    let telegramNotice: string | null = null;

    if (sendToTelegramApi) {
      if (!getTelegramToken()) {
        res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN sozlanmagan.' });
        return;
      }
      const chatId =
        target.trim() ||
        store.settings.channelUsername.trim() ||
        (getAdminTelegramId() ? String(getAdminTelegramId()) : '');
      if (!chatId) {
        res.status(400).json({ error: 'Telegram chat ID yoki @kanal nomini kiriting.' });
        return;
      }
      try {
        await deliverReplyToTelegram(chatId, {
          text: messageText,
          movieCard: template === 'channel_post' ? movie : undefined,
          inlineButtons: [
            [{ text: `🎬 Kinoni ochish (${formattedCode})`, action: `movie:${movie.code}` }],
          ],
        });
        deliveryMode = 'telegram_api';
        telegramNotice = `Kino kodi (${formattedCode}) ${chatId} manziliga Telegram orqali yuborildi.`;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Telegram API xatoligi';
        res.status(502).json({ error: `Telegramga yuborishda xatolik: ${message}` });
        return;
      }
    }

    movie.codeSentCount += 1;
    const logEntry: SentCodeLog = {
      id: `log-${Date.now()}`,
      movieId: movie.id,
      movieCode: formattedCode,
      movieTitle: movie.title,
      template,
      target: target.trim() || 'Jonli sinov chati',
      deliveryMode,
      messageText,
      sentAt: new Date().toISOString(),
    };
    store.sentLogs.unshift(logEntry);
    if (store.sentLogs.length > 50) store.sentLogs = store.sentLogs.slice(0, 50);

    pushActivity({
      source: deliveryMode === 'telegram_api' ? 'telegram' : 'admin',
      eventType: 'code_broadcast',
      actor: 'Admin',
      actorMeta: logEntry.target,
      movieCode: formattedCode,
      movieTitle: movie.title,
      detail: `${movie.title} (${formattedCode}) kodi ${logEntry.target} ga yuborildi`,
    });

    const botReply: BotReplyPayload = {
      text: messageText,
      movieCard: template === 'channel_post' ? movie : undefined,
      highlightedCode: formattedCode,
      isCodeBroadcast: true,
      inlineButtons: [
        [
          { text: `🎬 Kinoni ochish (${formattedCode})`, action: `movie:${movie.code}` },
          { text: '🔢 Barcha kodlar', action: 'list_codes' },
        ],
      ],
    };

    res.json({
      log: logEntry,
      botReply,
      state: getFullState(),
      telegramNotice,
    });
  });

  // Telegram webhook endpoint
  app.post('/api/telegram/webhook', async (req: Request, res: Response) => {
    try {
      await handleRealTelegramUpdate(req.body as Record<string, unknown>);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ ok: false });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`KinoKod Bot server running on http://0.0.0.0:${port}`);
    void startTelegramPolling();
  });
}

void createServer();

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Link2, Loader2, Upload, Video, X } from 'lucide-react';
import {
  POSTER_PRESETS,
  type IncomingTelegramVideo,
  type Movie,
} from '../types';

interface MovieModalProps {
  open: boolean;
  editingMovie: Movie | null;
  existingMovies: Movie[];
  suggestedCode: string;
  incomingVideos: IncomingTelegramVideo[];
  prefillVideo?: IncomingTelegramVideo | null;
  onClose: () => void;
  onSubmit: (data: {
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
  }) => Promise<{ ok: boolean; error?: string }>;
}

const GENRE_OPTIONS = [
  'Tarixiy drama',
  'Fantastika',
  'Jangari triller',
  'Sarguzasht',
  'Multfilm',
  'Komediya',
  'Drama',
  'Detektiv',
];

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function qualityFromHeight(height?: number, width?: number): string {
  const maxDim = Math.max(width || 0, height || 0);
  if (maxDim >= 3840 || (height && height >= 2160)) return '4K UHD';
  if (maxDim >= 1920 || (height && height >= 1080)) return '1080p Full HD';
  if (maxDim >= 1280 || (height && height >= 720)) return '720p HD';
  if (maxDim > 0) return '480p SD';
  return '1080p Full HD';
}

function cleanTitleFromFile(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/\b(1080p|720p|480p|2160p|4k|uhd|hdrip|webrip|web-dl|bluray|x264|x265|hevc)\b/gi, '')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function probeVideoElementMetadata(
  src: string
): Promise<{ durationMins?: number; width?: number; height?: number }> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    const timer = window.setTimeout(() => {
      video.removeAttribute('src');
      resolve({});
    }, 5000);

    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const durationMins =
        Number.isFinite(video.duration) && video.duration > 0
          ? Math.max(1, Math.round(video.duration / 60))
          : undefined;
      const width = video.videoWidth || undefined;
      const height = video.videoHeight || undefined;
      video.removeAttribute('src');
      resolve({ durationMins, width, height });
    };

    video.onerror = () => {
      window.clearTimeout(timer);
      resolve({});
    };

    video.src = src;
  });
}

export function MovieModal({
  open,
  editingMovie,
  existingMovies,
  suggestedCode,
  incomingVideos,
  prefillVideo,
  onClose,
  onSubmit,
}: MovieModalProps) {
  const [code, setCode] = useState(suggestedCode);
  const [title, setTitle] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [genre, setGenre] = useState('Fantastika');
  const [duration, setDuration] = useState('120 daq');
  const [quality, setQuality] = useState('1080p Full HD');
  const [language, setLanguage] = useState("O'zbek tilida");
  const [rating, setRating] = useState('8.0');
  const [description, setDescription] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [watchUrl, setWatchUrl] = useState('');

  const [videoMode, setVideoMode] = useState<'upload' | 'url' | 'telegram'>('upload');
  const [telegramFileId, setTelegramFileId] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFileName, setVideoFileName] = useState('');
  const [videoFileSize, setVideoFileSize] = useState<number | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [probingUrl, setProbingUrl] = useState(false);
  const [autoDetectedNote, setAutoDetectedNote] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Real-time duplicate movie code detection
  const duplicateMovie = useMemo(() => {
    const cleaned = code.trim().replace(/^#/, '').toLowerCase();
    if (!cleaned) return null;
    return (
      existingMovies.find(
        (m) =>
          m.id !== editingMovie?.id &&
          m.code.trim().replace(/^#/, '').toLowerCase() === cleaned
      ) || null
    );
  }, [code, existingMovies, editingMovie]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setAutoDetectedNote(null);

    if (editingMovie) {
      setCode(editingMovie.code);
      setTitle(editingMovie.title);
      setYear(editingMovie.year);
      setGenre(editingMovie.genre);
      setDuration(editingMovie.duration);
      setQuality(editingMovie.quality);
      setLanguage(editingMovie.language);
      setRating(editingMovie.rating);
      setDescription(editingMovie.description);
      setPosterUrl(editingMovie.posterUrl);
      setWatchUrl(editingMovie.watchUrl);
      setTelegramFileId(editingMovie.telegramFileId || '');
      setVideoUrl(editingMovie.videoUrl || '');
      setVideoFileName(editingMovie.videoFileName || '');
      setVideoFileSize(editingMovie.videoFileSize);
      setVideoMode(
        editingMovie.telegramFileId
          ? 'telegram'
          : editingMovie.videoUrl?.startsWith('http')
          ? 'url'
          : 'upload'
      );
    } else if (prefillVideo) {
      const detectedDur = prefillVideo.durationSeconds
        ? `${Math.max(1, Math.round(prefillVideo.durationSeconds / 60))} daq`
        : '120 daq';
      const detectedQual = qualityFromHeight(prefillVideo.height, prefillVideo.width);
      setCode(suggestedCode);
      setTitle(
        prefillVideo.caption?.trim() ||
          cleanTitleFromFile(prefillVideo.fileName) ||
          'Yangi kino'
      );
      setYear(new Date().getFullYear());
      setGenre('Fantastika');
      setDuration(detectedDur);
      setQuality(detectedQual);
      setLanguage("O'zbek tilida");
      setRating('8.0');
      setDescription(prefillVideo.caption?.trim() || '');
      setPosterUrl('');
      setWatchUrl('');
      setTelegramFileId(prefillVideo.fileId);
      setVideoUrl('');
      setVideoFileName(prefillVideo.fileName);
      setVideoFileSize(prefillVideo.fileSize);
      setVideoMode('telegram');
      setAutoDetectedNote(
        `Avto-aniqlandi: ${detectedDur} · ${detectedQual}${prefillVideo.fileSize ? ` · ${formatBytes(prefillVideo.fileSize)}` : ''}`
      );
    } else {
      setCode(suggestedCode);
      setTitle('');
      setYear(new Date().getFullYear());
      setGenre('Fantastika');
      setDuration('120 daq');
      setQuality('1080p Full HD');
      setLanguage("O'zbek tilida");
      setRating('8.0');
      setDescription('');
      setPosterUrl('');
      setWatchUrl('');
      setTelegramFileId('');
      setVideoUrl('');
      setVideoFileName('');
      setVideoFileSize(undefined);
      setVideoMode('upload');
    }
  }, [open, editingMovie, suggestedCode, prefillVideo]);

  if (!open) return null;

  // Auto-detect duration, resolution, size, and title when picking local video file
  const handleVideoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setError(
        "Sayt orqali yuklash limiti 50 MB. Katta kinolarni Telegram botingizga yuboring — bot daqiqasi va sifatini o'zi aniqlab saqlaydi."
      );
      return;
    }

    setError(null);
    setAutoDetectedNote(null);

    // 1. Auto-detect exact duration & video resolution in browser
    const objectUrl = URL.createObjectURL(file);
    const meta = await probeVideoElementMetadata(objectUrl);
    URL.revokeObjectURL(objectUrl);

    const detectedParts: string[] = [];
    if (meta.durationMins) {
      setDuration(`${meta.durationMins} daq`);
      detectedParts.push(`${meta.durationMins} daq`);
    }
    if (meta.width || meta.height) {
      const q = qualityFromHeight(meta.height, meta.width);
      setQuality(q);
      detectedParts.push(`${q} (${meta.width}×${meta.height})`);
    }
    if (!title.trim()) {
      const autoTitle = cleanTitleFromFile(file.name);
      if (autoTitle) setTitle(autoTitle);
    }
    const yearInName = file.name.match(/\b(199\d|20[0-2]\d)\b/);
    if (yearInName) setYear(Number(yearInName[1]));

    detectedParts.push(formatBytes(file.size));

    // 2. Upload file to server
    setUploading(true);
    try {
      const resp = await fetch('/api/upload/video', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name),
        },
        body: file,
      });
      const data = (await resp.json()) as {
        videoUrl?: string;
        videoFileName?: string;
        videoFileSize?: number;
        error?: string;
      };
      if (!resp.ok || !data.videoUrl) {
        setError(data.error || "Videoni yuklab bo'lmadi.");
      } else {
        setVideoUrl(data.videoUrl);
        setVideoFileName(data.videoFileName || file.name);
        setVideoFileSize(data.videoFileSize || file.size);
        setTelegramFileId('');
        setAutoDetectedNote(`Fayldan avto-aniqlandi: ${detectedParts.join(' · ')}`);
      }
    } catch {
      setError('Video yuklashda tarmoq xatoligi yuz berdi.');
    } finally {
      setUploading(false);
    }
  };

  // Auto-detect metadata from pasted Video URL
  const handleProbeUrl = async (targetUrl?: string) => {
    const u = (targetUrl ?? videoUrl).trim();
    if (!/^https?:\/\//i.test(u)) return;

    setProbingUrl(true);
    setError(null);
    setAutoDetectedNote(null);

    try {
      const [serverRes, browserMeta] = await Promise.all([
        fetch('/api/movies/probe-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: u }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null) as Promise<{
          title?: string;
          description?: string;
          duration?: string;
          quality?: string;
          year?: number;
          fileSize?: number;
        } | null>,
        probeVideoElementMetadata(u),
      ]);

      const detectedParts: string[] = [];

      if (browserMeta.durationMins) {
        setDuration(`${browserMeta.durationMins} daq`);
        detectedParts.push(`${browserMeta.durationMins} daq`);
      } else if (serverRes?.duration) {
        setDuration(serverRes.duration);
        detectedParts.push(serverRes.duration);
      }

      if (browserMeta.width || browserMeta.height) {
        const q = qualityFromHeight(browserMeta.height, browserMeta.width);
        setQuality(q);
        detectedParts.push(q);
      } else if (serverRes?.quality) {
        setQuality(serverRes.quality);
        detectedParts.push(serverRes.quality);
      }

      if (serverRes?.title && !title.trim()) {
        setTitle(serverRes.title);
      }
      if (serverRes?.description && !description.trim()) {
        setDescription(serverRes.description);
      }
      if (serverRes?.year) {
        setYear(serverRes.year);
      }
      if (serverRes?.fileSize) {
        setVideoFileSize(serverRes.fileSize);
        detectedParts.push(formatBytes(serverRes.fileSize));
      }

      if (!watchUrl.trim()) {
        setWatchUrl(u);
      }

      setAutoDetectedNote(
        detectedParts.length > 0
          ? `URL dan avto-aniqlandi: ${detectedParts.join(' · ')}`
          : 'URL havola tekshirildi va biriktirildi.'
      );
    } finally {
      setProbingUrl(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (duplicateMovie) {
      setError(
        `"${code.trim()}" kodi allaqachon "${duplicateMovie.title}" kinosida band! Boshqa kod kiriting.`
      );
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await onSubmit({
        id: editingMovie?.id,
        code: code.trim(),
        title: title.trim(),
        year: Number(year) || new Date().getFullYear(),
        genre,
        duration: duration.trim() || '120 daq',
        quality,
        language,
        rating: rating.trim() || '8.0',
        description: description.trim() || `${title.trim()} — kino`,
        posterUrl: posterUrl.trim(),
        watchUrl: watchUrl.trim(),
        telegramFileId: telegramFileId.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
        videoFileName: videoFileName.trim() || undefined,
        videoFileSize,
      });
      if (!res.ok) {
        setError(res.error || 'Saqlashda xatolik yuz berdi.');
      } else {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="movie-modal-title"
    >
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 id="movie-modal-title" className="text-base font-semibold text-slate-900">
            {editingMovie ? 'Kinoni tahrirlash' : "Yangi kino qo'shish"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Yopish"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleFormSubmit}
          className="p-5 overflow-y-auto thin-scroll space-y-4"
        >
          {error && (
            <div className="px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Video File or URL (Auto-detects duration, quality & title first!) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                <Video className="w-4 h-4 text-sky-600" />
                <span>Kino fayli yoki URL (daqiqa va sifat avto-aniqlanadi)</span>
              </div>
              {(telegramFileId || videoUrl) && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <Check className="w-3.5 h-3.5" />
                  <span>Tayyor</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-200/70 rounded-lg">
              {[
                { id: 'upload' as const, label: 'Fayldan yuklash' },
                { id: 'url' as const, label: 'URL bilan qo‘shish' },
                { id: 'telegram' as const, label: 'Telegram video' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setVideoMode(tab.id)}
                  className={`py-1.5 px-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    videoMode === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {videoMode === 'upload' && (
              <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-slate-300 bg-white hover:border-sky-500 cursor-pointer text-xs font-medium text-slate-700 transition-colors">
                {uploading ? (
                  <Loader2 className="w-4 h-4 text-sky-600 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 text-sky-600" />
                )}
                <span className="truncate">
                  {uploading
                    ? 'Video yuklanmoqda va tahlil qilinmoqda...'
                    : videoFileName
                    ? `${videoFileName} ${videoFileSize ? `(${formatBytes(videoFileSize)})` : ''}`
                    : 'MP4 / MOV / MKV faylni tanlang (50 MB gacha)'}
                </span>
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                  onChange={(e) => void handleVideoFileSelect(e)}
                  disabled={uploading}
                  className="sr-only"
                />
              </label>
            )}

            {videoMode === 'url' && (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Link2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    onBlur={() => {
                      if (videoUrl.trim().startsWith('http')) void handleProbeUrl(videoUrl);
                    }}
                    placeholder="https://example.com/kino.mp4"
                    className="w-full pl-8 pr-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-600"
                  />
                </div>
                <button
                  type="button"
                  disabled={probingUrl || !videoUrl.trim().startsWith('http')}
                  onClick={() => void handleProbeUrl()}
                  className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  {probingUrl ? 'Aniqlanmoqda...' : 'Avto aniqlash'}
                </button>
              </div>
            )}

            {videoMode === 'telegram' && (
              <div className="space-y-2">
                {incomingVideos.length > 0 && (
                  <select
                    value={telegramFileId}
                    onChange={(e) => {
                      const picked = incomingVideos.find((v) => v.fileId === e.target.value);
                      setTelegramFileId(e.target.value);
                      if (picked) {
                        setVideoFileName(picked.fileName);
                        setVideoFileSize(picked.fileSize);
                        if (picked.durationSeconds) {
                          setDuration(`${Math.max(1, Math.round(picked.durationSeconds / 60))} daq`);
                        }
                        if (picked.width || picked.height) {
                          setQuality(qualityFromHeight(picked.height, picked.width));
                        }
                        if (!title.trim()) {
                          setTitle(picked.caption?.trim() || cleanTitleFromFile(picked.fileName));
                        }
                        setAutoDetectedNote(
                          `Telegram videodan avto-aniqlandi: ${
                            picked.durationSeconds
                              ? `${Math.max(1, Math.round(picked.durationSeconds / 60))} daq`
                              : '—'
                          } · ${qualityFromHeight(picked.height, picked.width)}`
                        );
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                  >
                    <option value="">Telegram botga yuborilgan videoni tanlang...</option>
                    {incomingVideos.map((v) => (
                      <option key={v.id} value={v.fileId}>
                        {v.fileName} ({formatBytes(v.fileSize)})
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  value={telegramFileId}
                  onChange={(e) => setTelegramFileId(e.target.value)}
                  placeholder="BAACAgIAAxkBAA... (Telegram video file_id)"
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
            )}

            {autoDetectedNote && (
              <div className="text-xs text-emerald-700 font-medium">{autoDetectedNote}</div>
            )}
          </div>

          {/* Code (with strict duplicate warning) + Title */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="m-code" className="block text-xs font-medium text-slate-700">
                Kino kodi
              </label>
              <input
                id="m-code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="106"
                className={`w-full px-3 py-2 text-sm font-mono border rounded-lg text-slate-900 focus:outline-none focus:ring-2 ${
                  duplicateMovie
                    ? 'border-red-500 bg-red-50/40 focus:ring-red-500/25'
                    : 'border-slate-300 focus:ring-sky-500/25 focus:border-sky-600'
                }`}
              />
              {duplicateMovie && (
                <p className="text-[11px] font-medium text-red-600">
                  Band! ({duplicateMovie.title}) — boshqa kod yozing
                </p>
              )}
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="m-title" className="block text-xs font-medium text-slate-700">
                Kino nomi
              </label>
              <input
                id="m-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Kino nomi (fayl/URL dan avto olinadi)"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="m-duration" className="block text-xs font-medium text-slate-700">
                Daqiqasi (avto)
              </label>
              <input
                id="m-duration"
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="120 daq"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="m-quality" className="block text-xs font-medium text-slate-700">
                Sifati (avto)
              </label>
              <select
                id="m-quality"
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="w-full px-2.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-600"
              >
                <option value="4K UHD">4K UHD</option>
                <option value="1080p Full HD">1080p Full HD</option>
                <option value="720p HD">720p HD</option>
                <option value="480p SD">480p SD</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="m-year" className="block text-xs font-medium text-slate-700">
                Yili
              </label>
              <input
                id="m-year"
                type="number"
                min={1950}
                max={2035}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="m-genre" className="block text-xs font-medium text-slate-700">
                Janr
              </label>
              <select
                id="m-genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full px-2.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-600"
              >
                {GENRE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="m-lang" className="block text-xs font-medium text-slate-700">
                Til / Dublyaj
              </label>
              <select
                id="m-lang"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-600"
              >
                <option value="O'zbek tilida">O'zbek tilida</option>
                <option value="O'zbekcha dublyaj">O'zbekcha dublyaj</option>
                <option value="Subtitr (O'zbek)">Subtitr (O'zbek)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="m-rating" className="block text-xs font-medium text-slate-700">
                IMDb reyting
              </label>
              <input
                id="m-rating"
                type="text"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                placeholder="8.0"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-600"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="m-desc" className="block text-xs font-medium text-slate-700">
              Qisqacha tavsif (ixtiyoriy)
            </label>
            <textarea
              id="m-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kino haqida qisqacha ma'lumot..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-600"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700">
              Poster (ixtiyoriy)
            </label>
            <div className="grid grid-cols-6 gap-2">
              <button
                type="button"
                onClick={() => setPosterUrl('')}
                className={`aspect-[3/4] rounded-lg border-2 text-[10px] font-medium flex items-center justify-center text-center px-1 transition-colors ${
                  posterUrl === ''
                    ? 'border-sky-600 bg-sky-50 text-sky-700'
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                }`}
              >
                Postersiz
              </button>
              {POSTER_PRESETS.map((preset) => (
                <button
                  key={preset.url}
                  type="button"
                  onClick={() => setPosterUrl(preset.url)}
                  className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-colors ${
                    posterUrl === preset.url
                      ? 'border-sky-600'
                      : 'border-transparent hover:border-slate-300'
                  }`}
                  title={preset.label}
                >
                  <img
                    src={preset.url}
                    alt={preset.label}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={submitting || uploading || probingUrl || Boolean(duplicateMovie)}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-45 text-white text-xs font-medium transition-colors"
            >
              {submitting ? 'Saqlanmoqda...' : editingMovie ? 'Yangilash' : "Kinoni qo'shish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import type { BotSettings, Movie } from '../types';
import { generateNodeBotCode, generatePythonBotCode } from '../utils/botCodeGenerator';

interface BotCodeExportProps {
  movies: Movie[];
  settings: BotSettings;
}

export function BotCodeExport({ movies, settings }: BotCodeExportProps) {
  const [runtime, setRuntime] = useState<'python' | 'node'>('python');
  const [copied, setCopied] = useState(false);

  const code = useMemo(() => {
    return runtime === 'python'
      ? generatePythonBotCode(movies, settings)
      : generateNodeBotCode(movies, settings);
  }, [movies, settings, runtime]);

  const filename = runtime === 'python' ? 'kinokod_bot.py' : 'kinokod_bot.mjs';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Tayyor Telegram Bot manba kodi
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Hozirgi {movies.length} ta kino va barcha kino kodini yuborish buyruqlari bilan avtomatik sinxronlangan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setRuntime('python')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                runtime === 'python'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Python (aiogram 3)
            </button>
            <button
              type="button"
              onClick={() => setRuntime('node')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                runtime === 'node'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Node.js (grammy)
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Nusxalandi</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Nusxalash</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{filename} yuklab olish</span>
          </button>
        </div>
      </div>

      {/* 3-Step Setup Instructions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-900">
            01. BotFather orqali token oling
          </div>
          <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
            Telegramda <span className="font-mono text-slate-700">@BotFather</span> ga kirib{' '}
            <span className="font-mono text-slate-700">/newbot</span> buyrug'i bilan yangi bot yarating va tokenni nusxalang.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-900">
            02. Kutubxona va .env ni sozlang
          </div>
          <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
            {runtime === 'python' ? (
              <>
                Terminalda <code className="font-mono text-slate-700">pip install aiogram python-dotenv</code> bajaring va{' '}
                <code className="font-mono text-slate-700">.env</code> fayliga <code className="font-mono text-slate-700">TELEGRAM_BOT_TOKEN</code> kiriting.
              </>
            ) : (
              <>
                Terminalda <code className="font-mono text-slate-700">npm install grammy dotenv</code> bajaring va{' '}
                <code className="font-mono text-slate-700">.env</code> fayliga <code className="font-mono text-slate-700">TELEGRAM_BOT_TOKEN</code> kiriting.
              </>
            )}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-900">
            03. Botni ishga tushiring
          </div>
          <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
            {runtime === 'python' ? (
              <>
                <code className="font-mono text-slate-700">python {filename}</code> buyrug'ini ishga tushiring. Admin{' '}
                <code className="font-mono text-slate-700">/kod_yubor @kanal 101</code> orqali kino kodini yuborishi mumkin.
              </>
            ) : (
              <>
                <code className="font-mono text-slate-700">node {filename}</code> buyrug'ini ishga tushiring. Admin{' '}
                <code className="font-mono text-slate-700">/kod_yubor @kanal 101</code> orqali kino kodini yuborishi mumkin.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Code Viewer */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-400">
          <span className="font-mono text-slate-200">{filename}</span>
          <span className="font-mono tabular-nums">{code.split('\n').length} qator</span>
        </div>
        <pre className="p-5 overflow-x-auto max-h-[540px] thin-scroll text-xs leading-relaxed font-mono text-slate-200">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

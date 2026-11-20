import { useEffect, useState } from 'react';
import { Check, Save } from 'lucide-react';
import type { BotSettings, TelegramLiveStatus } from '../types';

interface BotSettingsPanelProps {
  settings: BotSettings;
  telegramLive: TelegramLiveStatus;
  onSave: (updated: BotSettings) => Promise<void>;
}

export function BotSettingsPanel({
  settings,
  telegramLive,
  onSave,
}: BotSettingsPanelProps) {
  const [form, setForm] = useState<BotSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(false);
    try {
      await onSave(form);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2400);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
      >
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Telegram Bot sozlamalari
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Bot nomi, kanal havolasi, kod prefiksi va Telegram admin xabarnomalarini boshqaring.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="bot-name" className="block text-xs font-medium text-slate-700">
              Bot nomi
            </label>
            <input
              id="bot-name"
              type="text"
              required
              value={form.botName}
              onChange={(e) => setForm({ ...form, botName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-600"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="bot-username" className="block text-xs font-medium text-slate-700">
              Bot username
            </label>
            <input
              id="bot-username"
              type="text"
              required
              value={form.botUsername}
              onChange={(e) => setForm({ ...form, botUsername: e.target.value })}
              placeholder="@KinoKod_UzBot"
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-600"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="channel-username" className="block text-xs font-medium text-slate-700">
              Rasmiy Telegram kanali (ixtiyoriy)
            </label>
            <input
              id="channel-username"
              type="text"
              value={form.channelUsername}
              onChange={(e) => setForm({ ...form, channelUsername: e.target.value })}
              placeholder="@kanalingiz"
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-600"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="code-prefix" className="block text-xs font-medium text-slate-700">
              Kino kodi prefiksi (ixtiyoriy)
            </label>
            <input
              id="code-prefix"
              type="text"
              value={form.codePrefix}
              onChange={(e) => setForm({ ...form, codePrefix: e.target.value })}
              placeholder="Masalan: KINO- (yoki bo'sh qoldiring)"
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-600"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="welcome-msg" className="block text-xs font-medium text-slate-700">
            /start xush kelibsiz xabari
          </label>
          <textarea
            id="welcome-msg"
            rows={4}
            required
            value={form.welcomeMessage}
            onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-sky-500/25 focus:border-sky-600"
          />
        </div>

        <div className="space-y-3 pt-1 border-t border-slate-100">
          <label className="flex items-start gap-2.5 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={form.notifyAdminInTelegram}
              onChange={(e) =>
                setForm({ ...form, notifyAdminInTelegram: e.target.checked })
              }
              className="mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <div>
              <div className="text-xs font-medium text-slate-800">
                Admin Telegramiga jonli bildirishnomalar yuborish
              </div>
              <div className="text-xs text-slate-500">
                Kimdir botga kirsa, kino ko'rsa yoki nojo'ya harakat qilsa, darhol sizning Telegramingizga xabar va bloklash tugmasi boradi.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.autoSendCodeOnSearch}
              onChange={(e) =>
                setForm({ ...form, autoSendCodeOnSearch: e.target.checked })
              }
              className="mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <div>
              <div className="text-xs font-medium text-slate-800">
                Kino nomidan qidirganda avtomatik kodini yuborish
              </div>
              <div className="text-xs text-slate-500">
                Foydalanuvchi kino nomini yozsa, bot mos kinoning kodini yuboradi.
              </div>
            </div>
          </label>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="text-xs text-emerald-700 flex items-center gap-1.5">
            {savedNotice && (
              <>
                <Check className="w-4 h-4" />
                <span>Sozlamalar saqlandi</span>
              </>
            )}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-medium transition-colors whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saqlanmoqda...' : 'Saqlash'}</span>
          </button>
        </div>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
        <h3 className="text-sm font-semibold text-slate-900">
          Ulangan Telegram Bot ma'lumoti
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          {telegramLive.pollingActive ? (
            <>
              Bot faol ulangan:{' '}
              <span className="font-mono font-medium text-slate-900">
                {telegramLive.connectedUsername}
              </span>
              {telegramLive.adminTelegramId && (
                <>
                  {' '}· Admin ID:{' '}
                  <span className="font-mono font-medium text-slate-900">
                    {telegramLive.adminTelegramId}
                  </span>
                </>
              )}
            </>
          ) : (
            <>
              Telegram Bot hali ulanmagan ({telegramLive.lastError || 'TELEGRAM_BOT_TOKEN kiritilmagan'}).
            </>
          )}
        </p>
      </div>
    </div>
  );
}

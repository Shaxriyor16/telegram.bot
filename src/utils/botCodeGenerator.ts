import type { BotSettings, Movie } from '../types';

function escapePyString(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function escapeJsString(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

export function generatePythonBotCode(movies: Movie[], settings: BotSettings): string {
  const movieEntries = movies
    .map(
      (m) => `    "${escapePyString(m.code)}": {
        "title": "${escapePyString(m.title)}",
        "year": ${m.year},
        "genre": "${escapePyString(m.genre)}",
        "duration": "${escapePyString(m.duration)}",
        "quality": "${escapePyString(m.quality)}",
        "language": "${escapePyString(m.language)}",
        "rating": "${escapePyString(m.rating)}",
        "description": "${escapePyString(m.description)}",
        "watch_url": "${escapePyString(m.watchUrl)}",
        "file_id": "${escapePyString(m.telegramFileId || '')}",
    },`
    )
    .join('\n');

  return `"""
${settings.botName} (${settings.botUsername})
Telegram Kino Bot — kino kodini yuborish va kod orqali kino berish funksiyalari bilan.
O'rnatish: pip install aiogram python-dotenv
Ishga tushirish: python bot.py
"""

import asyncio
import os
import random
from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import Command, CommandStart
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
ADMIN_ID = int(os.getenv("ADMIN_ID", "0"))
CHANNEL_USERNAME = "${escapePyString(settings.channelUsername)}"
BOT_USERNAME = "${escapePyString(settings.botUsername)}"
CODE_PREFIX = "${escapePyString(settings.codePrefix)}"

MOVIES = {
${movieEntries}
}


def format_code(code: str) -> str:
    return f"{CODE_PREFIX}{code}" if CODE_PREFIX else code


def normalize_code(text: str) -> str:
    cleaned = text.strip().lstrip("#")
    if CODE_PREFIX and cleaned.upper().startswith(CODE_PREFIX.upper()):
        cleaned = cleaned[len(CODE_PREFIX):].strip()
    return cleaned


def build_movie_keyboard(code: str, watch_url: str) -> InlineKeyboardMarkup:
    code_label = format_code(code)
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text=f"📤 Kodni yuborish ({code_label})",
                    callback_data=f"send_code:{code}",
                ),
                InlineKeyboardButton(text="🎬 Tomosha qilish", url=watch_url),
            ],
            [
                InlineKeyboardButton(text="🔢 Barcha kodlar", callback_data="list_codes"),
                InlineKeyboardButton(text="🎲 Tasodifiy kino", callback_data="random_movie"),
            ],
        ]
    )


bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()


@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="🔢 Barcha kino kodlari", callback_data="list_codes"),
                InlineKeyboardButton(text="🎲 Tasodifiy kino", callback_data="random_movie"),
            ]
        ]
    )
    await message.answer(
        "${escapePyString(settings.welcomeMessage)}",
        reply_markup=kb,
    )


@dp.message(Command("kodlar"))
async def cmd_codes(message: types.Message):
    lines = [
        f"🔢 {format_code(code)} — {m['title']} ({m['year']})"
        for code, m in MOVIES.items()
    ]
    await message.answer(
        "Mavjud kino kodlari:\\n\\n" + "\\n".join(lines) + "\\n\\nKino olish uchun kodni yuboring."
    )


@dp.message(Command("random"))
async def cmd_random(message: types.Message):
    code = random.choice(list(MOVIES.keys()))
    await send_movie_by_code(message, code)


# Admin funksiyasi: Istalgan kanal yoki foydalanuvchiga kino kodini yuborish
# Foydalanish: /kod_yubor @kanal_nomi 101
@dp.message(Command("kod_yubor"))
async def cmd_send_movie_code(message: types.Message):
    if ADMIN_ID and message.from_user.id != ADMIN_ID:
        await message.answer("Bu buyruq faqat bot admini uchun.")
        return

    parts = message.text.split()
    if len(parts) < 3:
        await message.answer("Foydalanish: /kod_yubor @kanal_yoki_id 101")
        return

    target_chat = parts[1]
    code = normalize_code(parts[2])
    movie = MOVIES.get(code)
    if not movie:
        await message.answer(f"{code} kodli kino topilmadi.")
        return

    formatted = format_code(code)
    text = (
        f"🎬 {movie['title']} ({movie['year']})\\n"
        f"{movie['description']}\\n\\n"
        f"📂 Janr: {movie['genre']} · {movie['duration']} · {movie['quality']}\\n"
        f"🔢 Kino kodi: {formatted}\\n"
        f"🤖 Bot: {BOT_USERNAME}"
    )
    await bot.send_message(
        chat_id=target_chat,
        text=text,
        reply_markup=build_movie_keyboard(code, movie["watch_url"]),
    )
    await message.answer(f"Kino kodi ({formatted}) {target_chat} manziliga yuborildi.")


async def send_movie_by_code(target: types.Message, code: str):
    movie = MOVIES.get(code)
    if not movie:
        await target.answer("Bunday kodli kino topilmadi. /kodlar orqali ro'yxatni ko'ring.")
        return

    formatted = format_code(code)
    caption = (
        f"🎬 {movie['title']} ({movie['year']})\\n"
        f"{movie['description']}\\n\\n"
        f"📂 {movie['genre']} · {movie['duration']} · {movie['quality']} · {movie['language']}\\n"
        f"⭐ IMDb: {movie['rating']}\\n"
        f"🔢 Kino kodi: {formatted}"
    )
    if movie.get("file_id"):
        await target.answer_video(
            video=movie["file_id"],
            caption=caption,
            reply_markup=build_movie_keyboard(code, movie["watch_url"]),
        )
    else:
        await target.answer(
            caption,
            reply_markup=build_movie_keyboard(code, movie["watch_url"]),
        )


# Inline tugma orqali kino kodini alohida xabar sifatida yuborish
@dp.callback_query(F.data.startswith("send_code:"))
async def cb_send_code(callback: types.CallbackQuery):
    code = callback.data.split(":", 1)[1]
    movie = MOVIES.get(code)
    if not movie:
        await callback.answer("Kino topilmadi", show_alert=True)
        return
    formatted = format_code(code)
    await callback.message.answer(
        f"🔢 Kino kodi: {formatted}\\n"
        f"🎬 {movie['title']} ({movie['year']})\\n"
        f"Kodni {BOT_USERNAME} botiga yuboring."
    )
    await callback.answer("Kino kodi yuborildi!")


@dp.callback_query(F.data == "list_codes")
async def cb_list_codes(callback: types.CallbackQuery):
    await cmd_codes(callback.message)
    await callback.answer()


@dp.callback_query(F.data == "random_movie")
async def cb_random_movie(callback: types.CallbackQuery):
    code = random.choice(list(MOVIES.keys()))
    await send_movie_by_code(callback.message, code)
    await callback.answer()


# Foydalanuvchi kod yuborsa -> kinoni beradi; kino nomini yozsa -> kino kodini yuboradi!
@dp.message(F.text)
async def handle_text(message: types.Message):
    raw = message.text.strip()
    code = normalize_code(raw)
    if code in MOVIES:
        await send_movie_by_code(message, code)
        return

    query = raw.lower()
    found = [
        (c, m)
        for c, m in MOVIES.items()
        if query in m["title"].lower() or query in m["genre"].lower()
    ]
    if found:
        lines = [f"🔢 {format_code(c)} — {m['title']} ({m['year']})" for c, m in found]
        kb = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(
                        text=f"🎬 {m['title']} ({format_code(c)})",
                        callback_data=f"send_code:{c}",
                    )
                ]
                for c, m in found[:5]
            ]
        )
        await message.answer(
            "Topilgan kino kodlari:\\n\\n" + "\\n".join(lines),
            reply_markup=kb,
        )
        return

    await message.answer("Kino topilmadi. Kodni tekshiring yoki /kodlar buyrug'ini yuboring.")


async def main():
    if not BOT_TOKEN:
        raise RuntimeError("TELEGRAM_BOT_TOKEN .env faylida ko'rsatilmagan")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
`;
}

export function generateNodeBotCode(movies: Movie[], settings: BotSettings): string {
  const movieEntries = movies
    .map(
      (m) => `  '${escapeJsString(m.code)}': {
    title: '${escapeJsString(m.title)}',
    year: ${m.year},
    genre: '${escapeJsString(m.genre)}',
    duration: '${escapeJsString(m.duration)}',
    quality: '${escapeJsString(m.quality)}',
    language: '${escapeJsString(m.language)}',
    rating: '${escapeJsString(m.rating)}',
    description: '${escapeJsString(m.description)}',
    watchUrl: '${escapeJsString(m.watchUrl)}',
    fileId: '${escapeJsString(m.telegramFileId || '')}',
  },`
    )
    .join('\n');

  return `// ${settings.botName} (${settings.botUsername})
// O'rnatish: npm install grammy dotenv
// Ishga tushirish: node bot.mjs

import 'dotenv/config';
import { Bot, InlineKeyboard } from 'grammy';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME = '${escapeJsString(settings.botUsername)}';
const CODE_PREFIX = '${escapeJsString(settings.codePrefix)}';

if (!BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN .env faylida topilmadi');
}

const MOVIES = {
${movieEntries}
};

const formatCode = (code) => (CODE_PREFIX ? \`\${CODE_PREFIX}\${code}\` : code);

const normalizeCode = (input) => {
  let clean = input.trim().replace(/^#/, '');
  if (CODE_PREFIX && clean.toUpperCase().startsWith(CODE_PREFIX.toUpperCase())) {
    clean = clean.slice(CODE_PREFIX.length).trim();
  }
  return clean;
};

const bot = new Bot(BOT_TOKEN);

function movieKeyboard(code, watchUrl) {
  const label = formatCode(code);
  return new InlineKeyboard()
    .text(\`📤 Kodni yuborish (\${label})\`, \`send_code:\${code}\`)
    .url('🎬 Tomosha qilish', watchUrl)
    .row()
    .text('🔢 Barcha kodlar', 'list_codes')
    .text('🎲 Tasodifiy kino', 'random_movie');
}

bot.command('start', (ctx) => {
  const kb = new InlineKeyboard()
    .text('🔢 Barcha kino kodlari', 'list_codes')
    .text('🎲 Tasodifiy kino', 'random_movie');
  return ctx.reply('${escapeJsString(settings.welcomeMessage)}', { reply_markup: kb });
});

bot.command('kodlar', (ctx) => {
  const list = Object.entries(MOVIES)
    .map(([code, m]) => \`🔢 \${formatCode(code)} — \${m.title} (\${m.year})\`)
    .join('\\n');
  return ctx.reply(\`Mavjud kino kodlari:\\n\\n\${list}\\n\\nKino olish uchun kodni yuboring.\`);
});

bot.command('random', (ctx) => {
  const codes = Object.keys(MOVIES);
  const code = codes[Math.floor(Math.random() * codes.length)];
  const m = MOVIES[code];
  const label = formatCode(code);
  return ctx.reply(
    \`🎬 \${m.title} (\${m.year})\\n\${m.description}\\n\\n🔢 Kino kodi: \${label}\`,
    { reply_markup: movieKeyboard(code, m.watchUrl) }
  );
});

// Admin buyrug'i: /kod_yubor @kanal_nomi 101
bot.command('kod_yubor', async (ctx) => {
  const [, targetChat, rawCode] = (ctx.message?.text || '').split(/\\s+/);
  if (!targetChat || !rawCode) {
    return ctx.reply('Foydalanish: /kod_yubor @kanal_nomi 101');
  }
  const code = normalizeCode(rawCode);
  const m = MOVIES[code];
  if (!m) return ctx.reply(\`\${code} kodli kino topilmadi.\`);

  const label = formatCode(code);
  await bot.api.sendMessage(
    targetChat,
    \`🎬 \${m.title} (\${m.year})\\n\${m.description}\\n\\n🔢 Kino kodi: \${label}\\n🤖 Bot: \${BOT_USERNAME}\`,
    { reply_markup: movieKeyboard(code, m.watchUrl) }
  );
  return ctx.reply(\`Kino kodi (\${label}) \${targetChat} manziliga yuborildi.\`);
});

bot.callbackQuery(/^send_code:(.+)$/, async (ctx) => {
  const code = ctx.match[1];
  const m = MOVIES[code];
  if (!m) return ctx.answerCallbackQuery({ text: 'Kino topilmadi', show_alert: true });

  const label = formatCode(code);
  await ctx.reply(
    \`🔢 Kino kodi: \${label}\\n🎬 \${m.title} (\${m.year})\\nKodni \${BOT_USERNAME} botiga yuboring.\`
  );
  return ctx.answerCallbackQuery({ text: 'Kino kodi yuborildi!' });
});

bot.callbackQuery('list_codes', async (ctx) => {
  const list = Object.entries(MOVIES)
    .map(([code, m]) => \`🔢 \${formatCode(code)} — \${m.title} (\${m.year})\`)
    .join('\\n');
  await ctx.reply(\`Mavjud kino kodlari:\\n\\n\${list}\`);
  return ctx.answerCallbackQuery();
});

bot.callbackQuery('random_movie', async (ctx) => {
  const codes = Object.keys(MOVIES);
  const code = codes[Math.floor(Math.random() * codes.length)];
  const m = MOVIES[code];
  await ctx.reply(
    \`🎬 \${m.title} (\${m.year})\\n\${m.description}\\n\\n🔢 Kino kodi: \${formatCode(code)}\`,
    { reply_markup: movieKeyboard(code, m.watchUrl) }
  );
  return ctx.answerCallbackQuery();
});

bot.on('message:text', (ctx) => {
  const text = ctx.message.text.trim();
  const code = normalizeCode(text);

  if (MOVIES[code]) {
    const m = MOVIES[code];
    const label = formatCode(code);
    const caption = \`🎬 \${m.title} (\${m.year})\\n\${m.description}\\n\\n📂 \${m.genre} · \${m.duration} · \${m.quality}\\n🔢 Kino kodi: \${label}\`;
    if (m.fileId) {
      return ctx.replyWithVideo(m.fileId, {
        caption,
        reply_markup: movieKeyboard(code, m.watchUrl),
      });
    }
    return ctx.reply(caption, {
      reply_markup: movieKeyboard(code, m.watchUrl),
    });
  }

  const query = text.toLowerCase();
  const found = Object.entries(MOVIES).filter(
    ([, m]) => m.title.toLowerCase().includes(query) || m.genre.toLowerCase().includes(query)
  );

  if (found.length > 0) {
    const lines = found.map(([c, m]) => \`🔢 \${formatCode(c)} — \${m.title} (\${m.year})\`).join('\\n');
    return ctx.reply(\`Topilgan kino kodlari:\\n\\n\${lines}\\n\\nKinoni ochish uchun kodni yuboring.\`);
  }

  return ctx.reply("Kino topilmadi. Kodni tekshiring yoki /kodlar buyrug'ini yuboring.");
});

bot.start();
console.log(\`\${BOT_USERNAME} ishga tushdi...\`);
`;
}

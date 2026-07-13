# Bot Telegram Manual untuk CS dan Admin

Project ini dibuat sebagai bot Telegram manual untuk flow support website, tanpa otomatisasi agent AI.

## Fokus alur

- Customer masuk dari website ke Telegram melalui deep-link
- Bot otomatis membuat atau memuat tiket support
- CS bisa melihat tiket terbuka dan mengambil tiket
- Admin bisa melihat semua tiket dan prioritas

## Struktur folder

- `src/app.ts` → entry point aplikasi
- `src/config.ts` → konfigurasi environment
- `src/bot/bot.ts` → flow Telegram manual
- `src/services/ticketStore.ts` → penyimpanan tiket dan sesi dalam memory
- `src/services/telegramPayload.ts` → parser payload deep-link dari website

## Persiapan

1. Copy `.env.example` menjadi `.env`
2. Isi token Telegram dan base URL website
3. Install dependency:

```bash
npm install
```

4. Jalankan bot:

```bash
npm run dev
```

5. Build untuk produksi:

```bash
npm run build
npm start
```

## Environment

- `TELEGRAM_BOT_TOKEN`: token dari BotFather
- `TELEGRAM_BOT_USERNAME`: username bot Telegram
- `WEBSITE_BASE_URL`: base URL website untuk link back
- `HERMES_AGENT_URL`: tetap bisa dipakai kalau nanti ingin menambahkan agent secara optional
- `HERMES_AGENT_API_KEY`: API key jika Hermes Agent dipakai
- `HERMES_AGENT_MODEL`: model jika Hermes Agent dipakai

## Deep-link website ke Telegram

Contoh payload pendek:

```text
https://t.me/your_bot_username?start=customer-12345-ticket-987
```

Payload artinya:

- `customer` = role customer
- `12345` = user id dari website
- `ticket` = indikator tiket
- `987` = id ticket

Bot akan membaca payload dan langsung menyiapkan experience sesuai role.

## Alur yang tersedia

- `/start` → mulai percakapan dan membentuk ticket customer
- `/status` → cek tiket aktif customer
- `/cs` → masuk mode CS
- `/admin` → masuk mode admin
- tombol inline menu:
  - customer → lihat tiket, hubungi CS
  - CS → daftar tiket terbuka, ambil tiket
  - admin → semua tiket, tiket urgent

## Catatan

Saat ini data tiket disimpan di memory server. Untuk deployment nyata, Anda akan perlu mengganti `ticketStore.ts` menjadi database seperti PostgreSQL atau MySQL agar data aman dan konsisten.

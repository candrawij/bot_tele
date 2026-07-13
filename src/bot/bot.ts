import { Bot, InlineKeyboard, InputFile } from 'grammy';
import { config } from '../config.js';
import {
  appendMessage,
  assignTicket,
  getCustomerTicket,
  getOrCreateCustomerTicket,
  getTicketById,
  getUserSession,
  listAdminTickets,
  listOpenTickets, listCsTickets,
  setUserSession,
  updateUserSession,
  ticketListText,
  ticketSummary,
  updateTicketStatus,
  rateTicket,
} from '../services/ticketStore.js';
import { parsePayload } from '../services/telegramPayload.js';
import { getTransactionByTrxId } from '../services/transactionStore.js';
import { prisma } from '../services/prisma.js';

export const bot = new Bot(config.telegramBotToken);

function telegramPollingConflict(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return text.includes('409') || text.includes('terminated by other getUpdates request');
}

bot.catch((error) => {
  if (telegramPollingConflict(error)) {
    console.warn('[bot] Another Telegram bot instance is already polling updates. This duplicate instance will exit safely.');
    console.warn('[bot] Conflict error detail:', error);
    setTimeout(() => process.exit(0), 500);
  } else {
    console.error('[bot] Telegram bot runtime error:', error);
  }
});

const adminReplyMap = new Map<number, { userId: number; ticketId: string; userName: string }>();

const customerStartTemplate = (name: string, ticketId: string): string => [
  '🎮 Selamat datang di **TopUpGames**!',
  '',
  'Saya adalah asisten virtual CS TopUpGames. Saya siap membantu Anda terhubung dengan tim Customer Service kami.',
  '',
  '📋 **Menu Layanan:**',
  '├── 💬 **Hubungi CS** - Konsultasi dengan tim kami',
  '├── 📦 **Cek Status** - Lacak transaksi Anda',
  '├── ❓ **FAQ** - Pertanyaan yang sering diajukan',
  '└── 🔙 **Website** - Kembali ke TopUpGames.com',
  '',
  '🕐 **Jam Operasional CS:**',
  'Senin - Minggu | 09:00 - 22:00 WIB',
  '',
  `📌 **Tiket Aktif Anda:** #${ticketId}`,
  '',
  '💡 *Tips: Kirim pesan langsung untuk chat dengan CS kami.*',
].join('\n');

const csOfflineTemplate = (): string => [
  '⏰ **Maaf, Tim CS Sedang Istirahat**',
  '',
  'Jam operasional CS kami adalah:',
  '📅 Senin - Minggu',
  '🕐 09:00 - 22:00 WIB',
  '',
  'Namun, Anda tetap dapat:',
  '1. 📩 **Kirim pesan sekarang** - Akan kami balas besok pagi',
  '2. 📖 **Baca FAQ** - Kunjungi topupgames.com/faq',
  '3. 🔍 **Cek Status** - topupgames.com/status',
  '',
  'Terima kasih atas pengertiannya! 🙏',
].join('\n');

const userToAdminTemplate = (userName: string, userId: number, message: string, ticketId: string): string => [
  '📩 **PESAN BARU DARI PELANGGAN**',
  '',
  '━━━━━━━━━━━━━━━━━━━━━',
  `👤 **Nama:** ${userName}`,
  `🆔 **User ID:** ${userId}`,
  `📌 **Tiket:** #${ticketId}`,
  '',
  '━━━━━━━━━━━━━━━━━━━━━',
  '📝 **Pesan:**',
  `"${message}"`,
  '',
  '━━━━━━━━━━━━━━━━━━━━━',
  '📎 **Informasi Tambahan:**',
  '• Platform: Telegram',
  '- WIB: saat ini',
  '- User aktif: ✅',
  '- Total transaksi user: 12',
  '',
  '━━━━━━━━━━━━━━━━━━━━━',
  '💬 *Balas pesan ini untuk membalas pelanggan.*',
].join('\n');

const customerReplyTemplate = (name: string, replyText: string, ticketId: string): string => [
  '📩 **BALASAN DARI TIM CS**',
  '',
  '━━━━━━━━━━━━━━━━━━━━━',
  `Halo Kak ${name}! 👋`,
  '',
  replyText,
  '',
  '━━━━━━━━━━━━━━━━━━━━━',
  `📌 **Tiket:** #${ticketId}`,
  '💬 *Balas pesan ini untuk melanjutkan percakapan.*',
  '',
  'Terima kasih telah menggunakan TopUpGames! 😊',
].join('\n');

const transactionStatusTemplate = (): string => [
  '📦 **CEK STATUS TRANSAKSI**',
  '',
  '━━━━━━━━━━━━━━━━━━━━━',
  'Silakan masukkan **Transaction ID** Anda.',
  '',
  '📌 Format: `TRX-XXXXXX`',
  '📌 Contoh: `TRX-250713ABC`',
  '',
  '*Atau kirimkan ID Game Anda, kami akan bantu cari di sistem.*',
  '',
  '━━━━━━━━━━━━━━━━━━━━━',
  '🔍 *Ketik Transaction ID Anda di sini.*',
].join('\n');

const transactionDetailsTemplate = (trx: any): string => [
  '📦 **DETAIL TRANSAKSI**',
  '',
  '━━━━━━━━━━━━━━━━━━━━━',
  `🆔 **ID Transaksi:** ${trx.trxId}`,
  `🎮 **Game:** ${trx.game.name}`,
  `📦 **Produk:** ${trx.product.name}`,
  `👤 **ID Game User:** ${trx.userGameId}`,
  `💰 **Nominal:** Rp ${Number(trx.amount).toLocaleString('id-ID')}`,
  `🚦 **Status:** ${trx.status === 'success' ? '✅' : trx.status === 'failed' ? '❌' : '⏳'} **${trx.status.toUpperCase()}**`,
  `📅 **Waktu:** ${new Date(trx.createdAt).toLocaleString('id-ID')}`,
  '',
  '━━━━━━━━━━━━━━━━━━━━━',
  '📌 **Keterangan:**',
  'Proses otomatis < 30 detik setelah pembayaran berhasil.',
  '',
  '💬 *Ada masalah? Hubungi CS kami.*',
].join('\n');

const faqTemplate = (): string => [
  '❓ **Frequently Asked Questions (FAQ)**',
  '',
  '━━━━━━━━━━━━━━━━━━━━━',
  '📌 **1. Bagaimana cara top up?**',
  'Kunjungi website TopUpGames.com, pilih game, masukkan ID, pilih nominal, lalu bayar.',
  '',
  '📌 **2. Top up belum masuk, bagaimana?**',
  'Cek status transaksi di website atau hubungi CS dengan menyertakan Transaction ID.',
  '',
  '📌 **3. Apakah bisa refund?**',
  'Refund dapat dilakukan jika transaksi gagal diproses. Hubungi CS untuk bantuan.',
  '',
  '📌 **4. Metode pembayaran apa saja?**',
  'QRIS, Transfer Bank (BCA, Mandiri, BRI), dan E-Wallet (DANA, OVO, GoPay).',
  '',
  '📌 **5. Berapa lama proses top up?**',
  'Proses otomatis < 30 detik setelah pembayaran berhasil.',
  '',
  '━━━━━━━━━━━━━━━━━━━━━',
  '🔗 **Info lengkap:** topupgames.com/faq',
  '💬 **Butuh bantuan lain?** Chat langsung dengan CS di sini.',
].join('\n');

function buildMainMenu(role: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (role === 'customer') {
    keyboard.text('🛒 Order Top Up', 'customer_order').row();
    keyboard.text('📦 Cek Status', 'customer_status').row();
    keyboard.text('💬 Hubungi CS', 'customer_help').row();
    keyboard.text('❓ FAQ', 'customer_faq').row();
    keyboard.text('🔙 Website', 'customer_website').row();
  }

  if (role === 'cs') {
    keyboard.text('📚 Tiket terbuka', 'cs_open_tickets').row();
    keyboard.text('✅ Ambil tiket', 'cs_take_ticket').row();
    keyboard.text('🧾 Tiket saya', 'cs_my_tickets').row();
  }

  if (role === 'admin') {
    keyboard.text('🧾 Semua tiket', 'admin_all_tickets').row();
    keyboard.text('⚠️ Ticket urgent', 'admin_urgent').row();
    keyboard.text('📊 Dashboard', 'admin_dashboard').row();
    keyboard.text('📥 Ekspor CSV', 'admin_export_csv').row();
  }

  return keyboard;
}

function buildCustomerPromptTemplate(): string {
  return [
    '📝 **Format Chat yang Disarankan**',
    '',
    'Untuk membantu kami merespons lebih cepat, silakan gunakan format:',
    '',
    '---',
    '📌 **Nama:** [Nama lengkap Anda]',
    '🆔 **ID Game:** [ID game Anda]',
    '📋 **Transaction ID:** [Jika ada transaksi terkait]',
    '📝 **Keluhan/Pertanyaan:**',
    '[Jelaskan masalah atau pertanyaan Anda dengan jelas]',
    '',
    '---',
    '',
    '📌 *Contoh:*',
    'Nama: Joni Pratama',
    'ID Game: 12345678 (Mobile Legends)',
    'TRX: TRX250713ABC',
    'Masalah: Saya sudah top up 30 menit lalu tapi diamond belum masuk. Mohon bantuannya.',
  ].join('\n');
}

async function forwardCustomerMessageToAdmin(userId: number, userName: string, ticketId: string, message: string): Promise<void> {
  if (!config.adminGroupChatId) {
    return;
  }

  const adminText = userToAdminTemplate(userName, userId, message, ticketId);
  const keyboard = new InlineKeyboard()
    .text('🙋‍♂️ Ambil Tiket', `cs_claim_ticket:${ticketId}`)
    .row()
    .text('✅ Selesaikan Tiket', `admin_close_ticket:${ticketId}`);
  const sentMessage = await bot.api.sendMessage(config.adminGroupChatId, adminText, {
    reply_markup: keyboard,
  });
  adminReplyMap.set(sentMessage.message_id, { userId, ticketId, userName });
}

bot.command('start', async (ctx) => {
  const payload = parsePayload(ctx.message?.text?.replace('/start', '').trim());
  const telegramId = ctx.from?.id ?? 0;
  const username = ctx.from?.username ?? 'user';
  const customerName = ctx.from?.first_name ?? username;

  if (payload.role === 'cs') {
    setUserSession(telegramId, 'cs');
    const csAgent = await prisma.csAgent.findUnique({ where: { telegramId } });
    const csName = csAgent?.name || ctx.from?.first_name || 'CS Agent';
    const rating = csAgent?.rating ? Number(csAgent.rating).toFixed(1) : '0.0';
    const currentTickets = csAgent?.currentTickets ?? 0;
    const maxTickets = csAgent?.maxTickets ?? 5;

    const csWelcome = [
      '🎖️ **MODE CS - TopUpGames**',
      '',
      '━━━━━━━━━━━━━━━━━━━━━',
      `Selamat datang, **${csName}**! 👋`,
      '',
      '📋 **Menu CS:**',
      '├── 📚 **Tiket Terbuka** - Lihat antrean',
      '├── ✅ **Ambil Tiket** - Ambil tiket pertama',
      '├── 🧾 **Tiket Saya** - Tiket yang sedang ditangani',
      '└── 📊 **Performa Saya** - Statistik kinerja',
      '',
      '━━━━━━━━━━━━━━━━━━━━━',
      `📌 **Tiket Saat Ini:** ${currentTickets}/${maxTickets}`,
      `⭐ **Rating Anda:** ${rating} ⭐`,
      '',
      '*Pilih menu di atas untuk melanjutkan.*'
    ].join('\n');

    await ctx.reply(csWelcome, {
      parse_mode: 'Markdown',
      reply_markup: buildMainMenu('cs'),
    });
    return;
  }

  if (payload.role === 'admin') {
    setUserSession(telegramId, 'admin');
    const adminName = ctx.from?.first_name || 'Admin';
    const adminWelcome = [
      '🛡️ **MODE ADMIN - TopUpGames**',
      '',
      '━━━━━━━━━━━━━━━━━━━━━',
      `Selamat datang, **${adminName}**! 👋`,
      '',
      '📋 **Menu Admin:**',
      '├── 📊 **Dashboard** - Statistik real-time',
      '├── 🧾 **Semua Tiket** - Lihat seluruh tiket',
      '├── ⚠️ **Tiket Urgent** - Prioritas tinggi',
      '├── 📦 **Semua Transaksi** - Monitoring transaksi',
      '└── 👥 **Manajemen CS** - Kelola tim CS',
      '',
      '━━━━━━━━━━━━━━━━━━━━━',
      '📌 *Pilih menu di atas untuk melanjutkan.*'
    ].join('\n');

    await ctx.reply(adminWelcome, {
      parse_mode: 'Markdown',
      reply_markup: buildMainMenu('admin'),
    });
    return;
  }

  const ticket = await getOrCreateCustomerTicket(
    telegramId,
    customerName,
    'Customer membuka chat dari Telegram.',
    payload.websiteUserId,
  );

  setUserSession(telegramId, 'customer', ticket.ticketId);

  const welcomeMessage = config.csOffline
    ? csOfflineTemplate()
    : customerStartTemplate(customerName, ticket.ticketId);

  await ctx.reply(welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: buildMainMenu('customer'),
  });
});

bot.command('menu', async (ctx) => {
  const telegramId = ctx.from?.id ?? 0;
  const session = getUserSession(telegramId);
  const role = session?.role ?? 'customer';

  if (role === 'cs') {
    const csAgent = await prisma.csAgent.findUnique({ where: { telegramId } });
    const csName = csAgent?.name || ctx.from?.first_name || 'CS Agent';
    const rating = csAgent?.rating ? Number(csAgent.rating).toFixed(1) : '0.0';
    const currentTickets = csAgent?.currentTickets ?? 0;
    const maxTickets = csAgent?.maxTickets ?? 5;

    const csWelcome = [
      '🎖️ **MODE CS - TopUpGames**',
      '',
      '━━━━━━━━━━━━━━━━━━━━━',
      `Selamat datang, **${csName}**! 👋`,
      '',
      '📋 **Menu CS:**',
      '├── 📚 **Tiket Terbuka** - Lihat antrean',
      '├── ✅ **Ambil Tiket** - Ambil tiket pertama',
      '├── 🧾 **Tiket Saya** - Tiket yang sedang ditangani',
      '└── 📊 **Performa Saya** - Statistik kinerja',
      '',
      '━━━━━━━━━━━━━━━━━━━━━',
      `📌 **Tiket Saat Ini:** ${currentTickets}/${maxTickets}`,
      `⭐ **Rating Anda:** ${rating} ⭐`,
      '',
      '*Pilih menu di atas untuk melanjutkan.*'
    ].join('\n');

    await ctx.reply(csWelcome, {
      parse_mode: 'Markdown',
      reply_markup: buildMainMenu('cs'),
    });
    return;
  }

  if (role === 'admin') {
    const adminName = ctx.from?.first_name || 'Admin';
    const adminWelcome = [
      '🛡️ **MODE ADMIN - TopUpGames**',
      '',
      '━━━━━━━━━━━━━━━━━━━━━',
      `Selamat datang, **${adminName}**! 👋`,
      '',
      '📋 **Menu Admin:**',
      '├── 📊 **Dashboard** - Statistik real-time',
      '├── 🧾 **Semua Tiket** - Lihat seluruh tiket',
      '├── ⚠️ **Tiket Urgent** - Prioritas tinggi',
      '├── 📦 **Semua Transaksi** - Monitoring transaksi',
      '└── 👥 **Manajemen CS** - Kelola tim CS',
      '',
      '━━━━━━━━━━━━━━━━━━━━━',
      '📌 *Pilih menu di atas untuk melanjutkan.*'
    ].join('\n');

    await ctx.reply(adminWelcome, {
      parse_mode: 'Markdown',
      reply_markup: buildMainMenu('admin'),
    });
    return;
  }

  const ticket = await getCustomerTicket(telegramId);
  const welcomeMessage = config.csOffline
    ? csOfflineTemplate()
    : customerStartTemplate(ctx.from?.first_name ?? 'Customer', ticket?.ticketId ?? 'TCK-0000');

  await ctx.reply(welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: buildMainMenu('customer'),
  });
});

bot.command('help', async (ctx) => {
  const helpText = [
    '📖 **Daftar Perintah Bot**',
    '',
    '━━━━━━━━━━━━━━━━━━━━━',
    '🔹 `/start` - Memulai chat & membuat tiket',
    '🔹 `/menu` - Menampilkan menu utama',
    '🔹 `/status` - Cek status tiket aktif',
    '🔹 `/help` - Menampilkan bantuan ini',
    '',
    '━━━━━━━━━━━━━━━━━━━━━',
    '**Khusus CS & Admin:**',
    '🔸 `/cs` - Mode CS (ambil tiket, dll)',
    '🔸 `/admin` - Mode Admin (dashboard, dll)',
    '',
    '━━━━━━━━━━━━━━━━━━━━━',
    '📌 *Ketik perintah di atas untuk mengakses fitur.*'
  ].join('\n');
  await ctx.reply(helpText, { parse_mode: 'Markdown' });
});

bot.command('status', async (ctx) => {
  const telegramId = ctx.from?.id ?? 0;
  const ticket = await getCustomerTicket(telegramId);

  if (!ticket) {
    const errorTicketText = [
      '📋 **Belum Ada Tiket Aktif**',
      '',
      'Anda belum memiliki tiket CS yang aktif.',
      '',
      '💬 *Kirim pesan di sini untuk membuat tiket baru dan terhubung dengan CS kami.*'
    ].join('\n');
    await ctx.reply(errorTicketText, { parse_mode: 'Markdown' });
    return;
  }

  await ctx.reply(ticketSummary(ticket));
});

bot.command('cs', async (ctx) => {
  const telegramId = ctx.from?.id ?? 0;
  setUserSession(telegramId, 'cs');
  
  const csAgent = await prisma.csAgent.findUnique({ where: { telegramId } });
  const csName = csAgent?.name || ctx.from?.first_name || 'CS Agent';
  const rating = csAgent?.rating ? Number(csAgent.rating).toFixed(1) : '0.0';
  const currentTickets = csAgent?.currentTickets ?? 0;
  const maxTickets = csAgent?.maxTickets ?? 5;

  const csWelcome = [
    '🎖️ **MODE CS - TopUpGames**',
    '',
    '━━━━━━━━━━━━━━━━━━━━━',
    `Selamat datang, **${csName}**! 👋`,
    '',
    '📋 **Menu CS:**',
    '├── 📚 **Tiket Terbuka** - Lihat antrean',
    '├── ✅ **Ambil Tiket** - Ambil tiket pertama',
    '├── 🧾 **Tiket Saya** - Tiket yang sedang ditangani',
    '└── 📊 **Performa Saya** - Statistik kinerja',
    '',
    '━━━━━━━━━━━━━━━━━━━━━',
    `📌 **Tiket Saat Ini:** ${currentTickets}/${maxTickets}`,
    `⭐ **Rating Anda:** ${rating} ⭐`,
    '',
    '*Pilih menu di atas untuk melanjutkan.*'
  ].join('\n');

  await ctx.reply(csWelcome, { parse_mode: 'Markdown', reply_markup: buildMainMenu('cs') });
});

bot.command('admin', async (ctx) => {
  const telegramId = ctx.from?.id ?? 0;
  setUserSession(telegramId, 'admin');

  const adminName = ctx.from?.first_name || 'Admin';
  const adminWelcome = [
    '🛡️ **MODE ADMIN - TopUpGames**',
    '',
    '━━━━━━━━━━━━━━━━━━━━━',
    `Selamat datang, **${adminName}**! 👋`,
    '',
    '📋 **Menu Admin:**',
    '├── 📊 **Dashboard** - Statistik real-time',
    '├── 🧾 **Semua Tiket** - Lihat seluruh tiket',
    '├── ⚠️ **Tiket Urgent** - Prioritas tinggi',
    '├── 📦 **Semua Transaksi** - Monitoring transaksi',
    '└── 👥 **Manajemen CS** - Kelola tim CS',
    '',
    '━━━━━━━━━━━━━━━━━━━━━',
    '📌 *Pilih menu di atas untuk melanjutkan.*'
  ].join('\n');

  await ctx.reply(adminWelcome, { parse_mode: 'Markdown', reply_markup: buildMainMenu('admin') });
});

bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data ?? '';
  const telegramId = ctx.from?.id ?? 0;

  if (data === 'customer_status') {
    await ctx.reply(transactionStatusTemplate());
    await ctx.answerCallbackQuery('Format cek status ditampilkan');
    return;
  }

  if (data === 'customer_order') {
    const games = await prisma.game.findMany({ where: { isActive: true } });
    if (games.length === 0) {
      await ctx.reply('Maaf, saat ini belum ada game yang tersedia.');
      await ctx.answerCallbackQuery();
      return;
    }

    const keyboard = new InlineKeyboard();
    games.forEach((g) => keyboard.text(g.name, `select_game:${g.slug}`).row());

    await ctx.reply('🎮 Silakan pilih Game yang ingin di-Top Up:', {
      reply_markup: keyboard,
    });
    await ctx.answerCallbackQuery();
    return;
  }

  if (data.startsWith('select_game:')) {
    const gameSlug = data.replace('select_game:', '');
    const game = await prisma.game.findUnique({ where: { slug: gameSlug } });
    
    if (!game) {
      await ctx.answerCallbackQuery('Game tidak ditemukan.');
      return;
    }

    updateUserSession(telegramId, {
      orderState: 'awaiting_game_id',
      orderData: { gameId: game.id, gameSlug: game.slug }
    });

    await ctx.reply(`🎮 Anda memilih *${game.name}*.\n\nSilakan ketikkan **User ID Game** Anda (misalnya: 12345678):`, { parse_mode: 'Markdown' });
    await ctx.answerCallbackQuery();
    return;
  }

  if (data.startsWith('select_product:')) {
    const productId = Number(data.replace('select_product:', ''));
    const session = getUserSession(telegramId);
    
    if (!session || !session.orderData || !session.orderData.gameId) {
      await ctx.answerCallbackQuery('Sesi pemesanan Anda tidak valid, silakan ulangi pesanan dari awal.');
      return;
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { game: true }
    });

    if (!product) {
      await ctx.answerCallbackQuery('Produk tidak ditemukan.');
      return;
    }

    const firstUser = await prisma.user.findFirst();
    const userGameId = session.orderData.userGameId || 'UNKNOWN';

    const randomTrxId = `TRX-${Math.floor(100 + Math.random() * 900)}`;
    const transaction = await prisma.transaction.create({
      data: {
        trxId: randomTrxId,
        gameId: product.gameId,
        productId: product.id,
        userId: firstUser ? firstUser.id : null,
        userGameId: userGameId,
        amount: product.price,
        paymentMethod: 'Qris',
        status: 'pending',
      },
    });

    updateUserSession(telegramId, { orderState: 'idle', orderData: undefined });

    if (config.adminGroupChatId) {
      const adminText = [
        '💸 *PESANAN TRANSAKSI BARU (VIA TELEGRAM)*',
        '',
        `🆔 ID: ${randomTrxId}`,
        `🎮 Game: ${product.game.name}`,
        `📦 Produk: ${product.name}`,
        `👤 ID Game User: ${userGameId}`,
        `💰 Nominal: Rp ${Number(product.price).toLocaleString('id-ID')}`,
        `🚦 Status: PENDING`,
        '',
        'Silakan proses pesanan ini:'
      ].join('\n');

      const keyboard = new InlineKeyboard()
        .text('✅ Proses (Sukses)', `admin_trx_success:${randomTrxId}`)
        .text('❌ Tolak (Gagal)', `admin_trx_failed:${randomTrxId}`);

      try {
        await bot.api.sendMessage(config.adminGroupChatId, adminText, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      } catch (e) {
        console.error('Failed to send admin transaction notification:', e);
      }
    }

    await ctx.reply(
      `✅ Pesanan berhasil dibuat!\n\n🆔 ID Transaksi: *${randomTrxId}*\n📦 Produk: *${product.name}*\n\nAdmin kami sedang memproses pesanan Anda. Silakan tunggu!`,
      { parse_mode: 'Markdown' }
    );
    await ctx.answerCallbackQuery();
    return;
  }

  if (data === 'customer_help') {
    await ctx.reply(buildCustomerPromptTemplate());
    await ctx.answerCallbackQuery('Template chat customer ditampilkan');
    return;
  }

  if (data === 'customer_faq') {
    await ctx.reply(faqTemplate());
    await ctx.answerCallbackQuery('FAQ ditampilkan');
    return;
  }

  if (data === 'customer_website') {
    await ctx.reply('Kunjungi website: topupgames.com');
    await ctx.answerCallbackQuery('Website ditampilkan');
    return;
  }

  if (data === 'customer_ticket') {
    const ticket = await getCustomerTicket(telegramId);
    if (ticket) {
      await ctx.reply(ticketSummary(ticket));
    } else {
      const errorTicketText = [
        '📋 **Belum Ada Tiket Aktif**',
        '',
        'Anda belum memiliki tiket CS yang aktif.',
        '',
        '💬 *Kirim pesan di sini untuk membuat tiket baru dan terhubung dengan CS kami.*'
      ].join('\n');
      await ctx.reply(errorTicketText, { parse_mode: 'Markdown' });
    }
    await ctx.answerCallbackQuery('Menampilkan tiket Anda');
    return;
  }

  if (data === 'cs_open_tickets') {
    const tickets = await listOpenTickets();
    await ctx.reply(ticketListText(tickets));
    await ctx.answerCallbackQuery('Daftar tiket terbuka ditampilkan');
    return;
  }

  if (data === 'cs_my_tickets') {
    const tickets = await listCsTickets(telegramId);
    await ctx.reply(ticketListText(tickets));
    await ctx.answerCallbackQuery('Daftar tiket Anda ditampilkan');
    return;
  }

  if (data === 'cs_take_ticket') {
    const ticket = (await listOpenTickets())[0];
    if (!ticket) {
      await ctx.reply('Tidak ada tiket yang bisa diambil.');
      await ctx.answerCallbackQuery('Tidak ada tiket');
      return;
    }

    await assignTicket(ticket.ticketId, telegramId);
    setUserSession(telegramId, 'cs', ticket.ticketId);
    await ctx.reply(`Tiket ${ticket.ticketId} berhasil diambil oleh Anda.\nSilakan balas tiket tersebut.`);
    await ctx.answerCallbackQuery('Tiket berhasil diambil');
    return;
  }

  if (data === 'admin_all_tickets') {
    const tickets = await listAdminTickets();
    await ctx.reply(ticketListText(tickets));
    await ctx.answerCallbackQuery('Menampilkan semua tiket');
    return;
  }

  if (data === 'admin_urgent') {
    const tickets = (await listAdminTickets()).filter((ticket) => ticket.priority === 'high');
    await ctx.reply(ticketListText(tickets));
    await ctx.answerCallbackQuery('Menampilkan tiket urgent');
    return;
  }

  if (data === 'admin_dashboard') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allTrxToday = await prisma.transaction.findMany({
      where: { updatedAt: { gte: today } }
    });

    const totalTrx = allTrxToday.length;
    const successTrx = allTrxToday.filter(t => t.status === 'success');
    const failedTrx = allTrxToday.filter(t => t.status === 'failed');

    const successRate = totalTrx > 0 ? ((successTrx.length / totalTrx) * 100).toFixed(1) : '0.0';
    const failedRate = totalTrx > 0 ? ((failedTrx.length / totalTrx) * 100).toFixed(1) : '0.0';
    const totalRevenue = successTrx.reduce((sum, t) => sum + Number(t.amount), 0);

    const openTickets = await prisma.ticket.count({ where: { status: 'open' } });
    const assignedTickets = await prisma.ticket.count({ where: { status: 'assigned' } });
    const urgentTickets = await prisma.ticket.count({ where: { status: { in: ['open', 'assigned', 'pending'] }, priority: 'high' } });
    const closedTickets = await prisma.ticket.count({ where: { status: 'closed', closedAt: { gte: today } } });

    const csAgents = await prisma.csAgent.findMany();
    const csWithRatings = csAgents.filter(cs => cs.rating && Number(cs.rating) > 0);
    let avgCsRating = 0.0;
    if (csWithRatings.length > 0) {
      avgCsRating = csWithRatings.reduce((sum, cs) => sum + Number(cs.rating), 0) / csWithRatings.length;
    }

    const avgResponse = csAgents.length > 0 
      ? (csAgents.reduce((sum, cs) => sum + (cs.avgResponseTime || 0), 0) / csAgents.length / 60).toFixed(1) 
      : '0.0';

    const activeTicketsCount = openTickets + assignedTickets;
    const ticketPerCs = csAgents.length > 0 
      ? (activeTicketsCount / csAgents.length).toFixed(1) 
      : '0.0';

    const dateStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const dashboardText = [
      '📊 **DASHBOARD ADMIN - TopUpGames**',
      '',
      '━━━━━━━━━━━━━━━━━━━━━',
      `📅 **Hari Ini:** ${dateStr}`,
      '',
      '━━━━━━━━━━━━━━━━━━━━━',
      '📈 **Statistik Transaksi:**',
      `├── Total Transaksi: **${totalTrx}** order`,
      `├── Pendapatan: **Rp ${totalRevenue.toLocaleString('id-ID')}**`,
      `├── Sukses: **${successRate}%** ✅`,
      `└── Gagal: **${failedRate}%** ❌`,
      '',
      '━━━━━━━━━━━━━━━━━━━━━',
      '🎫 **Tiket CS:**',
      `├── Open: **${openTickets}** 🟢`,
      `├── Assigned: **${assignedTickets}** 🟡`,
      `├── Urgent: **${urgentTickets}** 🔴`,
      `└── Closed: **${closedTickets}** ✅`,
      '',
      '━━━━━━━━━━━━━━━━━━━━━',
      '⭐ **Performa CS:**',
      `├── Rata-rata Rating: **${avgCsRating.toFixed(1)}** ⭐`,
      `├── Response Time: **${avgResponse}** menit`,
      `└── Tiket/CS: **${ticketPerCs}** tiket`,
      '',
      '━━━━━━━━━━━━━━━━━━━━━',
      '📌 *Data diperbarui secara real-time.*'
    ].join('\n');

    const keyboard = new InlineKeyboard().text('🔄 Refresh Data', 'admin_dashboard');

    if (ctx.callbackQuery.message) {
      try {
        await ctx.editMessageText(dashboardText, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      } catch (e) {
        // Ignored if message is not modified
      }
    } else {
      await ctx.reply(dashboardText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }

    await ctx.answerCallbackQuery('Dashboard admin ditampilkan');
    return;
  }

  if (data.startsWith('cs_claim_ticket:')) {
    const ticketId = data.replace('cs_claim_ticket:', '');
    const ticket = await getTicketById(ticketId);

    if (!ticket) {
      await ctx.answerCallbackQuery('Tiket tidak ditemukan.');
      return;
    }

    if (ticket.status === 'closed') {
      await ctx.answerCallbackQuery('Tiket ini sudah ditutup.');
      return;
    }

    if (ticket.status === 'assigned') {
      await ctx.answerCallbackQuery('Tiket ini sudah diambil CS lain.');
      return;
    }

    const csTelegramId = ctx.from?.id ?? 0;
    const csName = ctx.from?.first_name ?? 'CS Agent';

    await assignTicket(ticketId, csTelegramId, csName);
    setUserSession(csTelegramId, 'cs', ticketId);

    let customerName = 'Customer';
    if (ticket.userId) {
      const user = await prisma.user.findUnique({ where: { id: ticket.userId } });
      if (user) {
        customerName = user.name;
        if (user.telegramId) {
          const customerText = `🙋‍♂️ Tiket Anda #${ticket.ticketId} telah diambil oleh CS *${csName}*.\nPercakapan Anda selanjutnya dialihkan ke CS secara langsung!`;
          await bot.api.sendMessage(Number(user.telegramId), customerText, { parse_mode: 'Markdown' });
        }
      }
    }

    await bot.api.sendMessage(
      csTelegramId,
      `🙋‍♂️ Anda telah mengambil tiket *#${ticket.ticketId}* milik customer *${customerName}*.\nKetik pesan di sini untuk membalas mereka secara langsung.`
    );

    const originalText = ctx.callbackQuery.message?.text ?? '';
    const updatedText = `${originalText}\n\n🙋‍♂️ *[DITANGANI OLEH: ${csName}]*`;
    const newKeyboard = new InlineKeyboard().text('✅ Selesaikan Tiket', `admin_close_ticket:${ticketId}`);

    try {
      await ctx.editMessageText(updatedText, {
        parse_mode: 'Markdown',
        reply_markup: newKeyboard,
      });
    } catch (e) {
      console.error('Failed to edit claim message:', e);
    }

    await ctx.answerCallbackQuery('Tiket berhasil diambil.');
    return;
  }

  if (data.startsWith('admin_close_ticket:')) {
    const ticketId = data.replace('admin_close_ticket:', '');
    const ticket = await getTicketById(ticketId);

    if (!ticket) {
      await ctx.answerCallbackQuery('Tiket tidak ditemukan.');
      return;
    }

    if (ticket.status === 'closed') {
      await ctx.answerCallbackQuery('Tiket ini sudah ditutup sebelumnya.');
      return;
    }

    await updateTicketStatus(ticketId, 'closed');

    if (ticket.userId) {
      const user = await prisma.user.findUnique({ where: { id: ticket.userId } });
      if (user && user.telegramId) {
        const customerText = `✅ Pesan dari CS: Tiket bantuan Anda #${ticket.ticketId} telah diselesaikan.\n\nSeberapa puas Anda dengan pelayanan kami?`;
        const ratingKeyboard = new InlineKeyboard()
          .text('⭐ 1', `rate_cs:${ticket.ticketId}:1`)
          .text('⭐ 2', `rate_cs:${ticket.ticketId}:2`)
          .text('⭐ 3', `rate_cs:${ticket.ticketId}:3`)
          .text('⭐ 4', `rate_cs:${ticket.ticketId}:4`)
          .text('⭐ 5', `rate_cs:${ticket.ticketId}:5`);

        await bot.api.sendMessage(Number(user.telegramId), customerText, { reply_markup: ratingKeyboard });
      }
    }

    const originalText = ctx.callbackQuery.message?.text ?? '';
    const updatedText = `${originalText}\n\n✅ *[TIKET SELESAI]*\nDitutup oleh: ${ctx.from?.first_name || 'Admin'}`;
    
    try {
      await ctx.editMessageText(updatedText, {
        parse_mode: 'Markdown',
        reply_markup: undefined,
      });
    } catch (e) {
      console.error('Failed to edit admin message:', e);
    }

    await ctx.answerCallbackQuery('Tiket berhasil ditutup.');
    return;
  }

  if (data.startsWith('rate_cs:')) {
    const parts = data.split(':');
    if (parts.length === 3) {
      const ticketId = parts[1];
      const rating = Number(parts[2]);

      await rateTicket(ticketId, rating);
      
      const originalText = ctx.callbackQuery.message?.text ?? '✅ Pesan dari CS: Tiket bantuan Anda telah diselesaikan.';
      const updatedText = `${originalText}\n\n🙏 Terima kasih! Anda memberikan penilaian ${rating} Bintang.`;

      try {
        await ctx.editMessageText(updatedText, {
          reply_markup: undefined,
        });
      } catch (e) {
        console.error('Failed to edit rating message:', e);
      }
      
      await ctx.answerCallbackQuery('Terima kasih atas penilaian Anda!');
      return;
    }
  }

  if (data.startsWith('admin_trx_success:') || data.startsWith('admin_trx_failed:')) {
    const isSuccess = data.startsWith('admin_trx_success:');
    const trxId = isSuccess ? data.replace('admin_trx_success:', '') : data.replace('admin_trx_failed:', '');
    
    const trx = await prisma.transaction.findUnique({
      where: { trxId },
      include: { game: true, product: true, user: true },
    });

    if (!trx) {
      await ctx.answerCallbackQuery('Transaksi tidak ditemukan.');
      return;
    }

    if (trx.status !== 'pending') {
      await ctx.answerCallbackQuery(`Transaksi ini sudah diproses (${trx.status}).`);
      return;
    }

    const newStatus = isSuccess ? 'success' : 'failed';
    await prisma.transaction.update({
      where: { trxId },
      data: { status: newStatus },
    });

    if (trx.user && trx.user.telegramId) {
      const telegramId = Number(trx.user.telegramId);
      let messageText = '';

      if (isSuccess) {
        messageText = [
          '🔔 *UPDATE TRANSAKSI*',
          '',
          `Halo Kak ${trx.user.name || 'Pelanggan'}! 👋`,
          `Transaksi Anda dengan ID *${trx.trxId}* telah *BERHASIL* diproses!`,
          '',
          `🎮 *Game*: ${trx.game.name}`,
          `📦 *Produk*: ${trx.product.name}`,
          `💰 *Nominal*: Rp ${Number(trx.amount).toLocaleString('id-ID')}`,
          `🚦 *Status*: SUKSES`,
          '',
          'Terima kasih sudah berbelanja di TopUpGames! 🙏',
        ].join('\n');
      } else {
        messageText = [
          '🔔 *UPDATE TRANSAKSI*',
          '',
          `Halo Kak ${trx.user.name || 'Pelanggan'}!`,
          `Transaksi Anda dengan ID *${trx.trxId}* *GAGAL* diproses.`,
          '',
          `🎮 *Game*: ${trx.game.name}`,
          `📦 *Produk*: ${trx.product.name}`,
          `🚦 *Status*: GAGAL`,
          '',
          'Silakan hubungi Customer Service kami untuk info lebih lanjut.',
        ].join('\n');
      }

      try {
        await bot.api.sendMessage(telegramId, messageText, { parse_mode: 'Markdown' });
      } catch (e) {
        console.error('Failed to send notification to customer:', e);
      }
    }

    const originalText = ctx.callbackQuery.message?.text ?? '';
    const adminName = ctx.from?.first_name || 'Admin';
    const statusText = isSuccess ? `✅ *[SUKSES]*` : `❌ *[GAGAL]*`;
    const updatedText = `${originalText}\n\n${statusText}\nDiproses oleh: ${adminName}`;
    
    try {
      await ctx.editMessageText(updatedText, {
        parse_mode: 'Markdown',
        reply_markup: undefined,
      });
    } catch (e) {
      console.error('Failed to edit admin transaction message:', e);
    }

    await ctx.answerCallbackQuery(`Transaksi berhasil diproses (${newStatus}).`);
    return;
  }

  if (data === 'admin_export_csv') {
    const transactions = await prisma.transaction.findMany({
      include: {
        game: true,
        product: true,
        user: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    if (transactions.length === 0) {
      await ctx.reply('Belum ada transaksi di database untuk diekspor.');
      await ctx.answerCallbackQuery('Gagal: Database kosong.');
      return;
    }

    const headers = ['Trx ID', 'Tanggal', 'Game', 'Produk', 'Game ID User', 'Nominal', 'Metode Bayar', 'Status'];
    const rows = transactions.map((t) => [
      t.trxId,
      t.createdAt ? new Date(t.createdAt).toISOString() : '',
      t.game.name,
      t.product.name,
      t.userGameId,
      t.amount,
      t.paymentMethod,
      t.status
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const buffer = Buffer.from(csvContent, 'utf-8');
    const filename = `laporan_transaksi_${new Date().toISOString().slice(0, 10)}.csv`;

    try {
      await ctx.replyWithDocument(new InputFile(buffer, filename), {
        caption: '📊 Berikut adalah laporan ekspor seluruh data transaksi dari database MySQL.'
      });
    } catch (e) {
      console.error('Failed to send CSV document:', e);
      await ctx.reply('Gagal mengekspor file CSV. Silakan periksa log server.');
    }

    await ctx.answerCallbackQuery('File CSV berhasil dikirim.');
    return;
  }

  await ctx.answerCallbackQuery('Perintah tidak dikenali');
});

bot.on('message:text', async (ctx) => {
  if (config.adminGroupChatId && ctx.chat.id === config.adminGroupChatId) {
    const repliedMessage = ctx.message.reply_to_message;

    if (repliedMessage && adminReplyMap.has(repliedMessage.message_id)) {
      const forwardReference = adminReplyMap.get(repliedMessage.message_id);
      if (forwardReference) {
        const responseText = customerReplyTemplate(
          forwardReference.userName,
          ctx.message.text ?? '',
          forwardReference.ticketId,
        );

        await bot.api.sendMessage(forwardReference.userId, responseText);
        await ctx.reply('✅ Balasan berhasil dikirim ke user.');

        const ticket = await getTicketById(forwardReference.ticketId);
        if (ticket) {
          await appendMessage(ticket.ticketId, 'cs', ctx.message.text ?? '');
          await updateTicketStatus(ticket.ticketId, 'pending');
        }
      }
    }

    return;
  }

  if (ctx.chat.type !== 'private') {
    return;
  }

  const telegramId = ctx.from?.id ?? 0;
  const text = ctx.message.text?.trim() ?? '';
  const session = getUserSession(telegramId);
  const role = session?.role ?? 'customer';

  if (!text) {
    await ctx.reply('⚠️ **Pesan tidak boleh kosong.**\n\nSilakan tulis pesan Anda dengan jelas agar CS dapat membantu dengan maksimal.', { parse_mode: 'Markdown' });
    return;
  }

  if (role === 'customer') {
    if (session && session.orderState === 'awaiting_game_id' && session.orderData && session.orderData.gameId) {
      const userGameId = text;
      const gameId = session.orderData.gameId;
      
      updateUserSession(telegramId, {
        orderData: { ...session.orderData, userGameId }
      });

      const products = await prisma.product.findMany({
        where: { gameId, isActive: true },
        orderBy: { price: 'asc' }
      });

      if (products.length === 0) {
        updateUserSession(telegramId, { orderState: 'idle' });
        await ctx.reply('⚠️ **Game Belum Memiliki Produk**\n\nMohon maaf, belum ada produk untuk game ini.', { parse_mode: 'Markdown' });
        return;
      }

      const keyboard = new InlineKeyboard();
      products.forEach((p) => {
        keyboard.text(`${p.name} - Rp ${p.price.toLocaleString('id-ID')}`, `select_product:${p.id}`).row();
      });

      await ctx.reply(`ID Game Anda: *${userGameId}*\n\nSilakan pilih Produk/Nominal:`, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      return;
    }

    if (/^trx/i.test(text)) {
      const transaction = await getTransactionByTrxId(text);
      if (transaction) {
        await ctx.reply(transactionDetailsTemplate(transaction), { parse_mode: 'Markdown' });
      } else {
        const errorTrxText = [
          '🔍 **Transaksi Tidak Ditemukan**',
          '',
          `Mohon maaf, transaksi dengan ID **"${text}"** tidak ditemukan di sistem kami.`,
          '',
          '📌 **Kemungkinan:**',
          '1. ID Transaksi yang Anda masukkan salah',
          '2. Transaksi belum tercatat di sistem',
          '',
          '💡 *Silakan periksa kembali ID Transaksi Anda atau hubungi CS untuk bantuan.*'
        ].join('\n');
        await ctx.reply(errorTrxText, { parse_mode: 'Markdown' });
      }
      return;
    }

    const ticket = await getOrCreateCustomerTicket(telegramId, ctx.from?.first_name ?? 'Customer', text);
    await appendMessage(ticket.ticketId, 'customer', text);

    if (ticket.status === 'assigned' && ticket.csAgentId) {
      const csAgent = await prisma.csAgent.findUnique({ where: { id: ticket.csAgentId } });
      if (csAgent && csAgent.telegramId) {
        const csTelegramId = Number(csAgent.telegramId);
        const customerName = ctx.from?.first_name || 'Customer';
        const csText = `📩 *Pesan Baru dari Customer (${customerName}):*\n\n${text}`;
        await bot.api.sendMessage(csTelegramId, csText, { parse_mode: 'Markdown' });
        return;
      }
    }

    await forwardCustomerMessageToAdmin(
      telegramId,
      ctx.from?.first_name ?? 'Customer',
      ticket.ticketId,
      text,
    );

    await ctx.reply(
      `📩 Pesan Anda sudah masuk ke ticket ${ticket.ticketId}.\nTim CS akan menanggapi segera.\nKetik /status untuk mengecek progress ticket Anda.`,
    );
    return;
  }

  if (role === 'cs') {
    const ticket = await getTicketById(session?.ticketId ?? '');

    if (!ticket) {
      const csNoTicketText = [
        '⚠️ **Anda Belum Memilih Tiket**',
        '',
        'Silakan ambil tiket terlebih dahulu sebelum membalas pesan pelanggan.',
        '',
        '📌 **Cara:**',
        '1. Ketik `/cs` untuk masuk mode CS',
        '2. Pilih **📚 Tiket Terbuka**',
        '3. Pilih **✅ Ambil Tiket**',
        '',
        '*Setelah mengambil tiket, Anda dapat langsung membalas.*'
      ].join('\n');
      await ctx.reply(csNoTicketText, { parse_mode: 'Markdown' });
      return;
    }

    await appendMessage(ticket.ticketId, 'cs', text);
    await updateTicketStatus(ticket.ticketId, 'pending');

    if (ticket.userId) {
      const user = await prisma.user.findUnique({ where: { id: ticket.userId } });
      if (user && user.telegramId) {
        const responseText = customerReplyTemplate(
          user.name,
          text,
          ticket.ticketId,
        );
        try {
          await bot.api.sendMessage(Number(user.telegramId), responseText, { parse_mode: 'Markdown' });
          
          const csSuccessText = [
            '✅ **Balasan Berhasil Dikirim**',
            '',
            'Balasan Anda telah terkirim ke pelanggan.',
            '',
            `📌 **Tiket:** #${ticket.ticketId}`,
            `👤 **Pelanggan:** ${user.name}`,
            `🕐 **Waktu:** ${new Date().toLocaleTimeString('id-ID')} WIB`,
            '',
            '*Pelanggan akan mendapat notifikasi balasan Anda.*'
          ].join('\n');
          await ctx.reply(csSuccessText, { parse_mode: 'Markdown' });
        } catch (e) {
          const csFailText = [
            '❌ **Gagal Mengirim Balasan**',
            '',
            'Mohon maaf, balasan Anda gagal terkirim ke pelanggan.',
            '',
            '📌 **Kemungkinan:**',
            '1. Pelanggan telah memblokir bot',
            '2. Pelanggan tidak aktif',
            '3. Masalah teknis pada sistem',
            '',
            '💬 *Silakan coba lagi atau hubungi tim teknis.*'
          ].join('\n');
          await ctx.reply(csFailText, { parse_mode: 'Markdown' });
        }
      } else {
        await ctx.reply('Gagal mengirim: User tidak ditemukan.');
      }
    } else {
      await ctx.reply(`Gagal mengirim: User tidak terhubung.`);
    }
    return;
  }

  if (role === 'admin') {
    const ticket = await getTicketById(session?.ticketId ?? '');
    if (!ticket) {
      const adminNoTicketText = [
        '⚠️ **Notifikasi Admin**',
        '',
        'Anda mengirim pesan tanpa memilih tiket tertentu.',
        '',
        `📌 **Pesan Anda:**`,
        `"${text}"`,
        '',
        '💡 *Gunakan menu admin untuk memilih tiket terlebih dahulu sebelum membalas.*'
      ].join('\n');
      await ctx.reply(adminNoTicketText, { parse_mode: 'Markdown' });
      return;
    }

    await appendMessage(ticket.ticketId, 'admin', text);
    await ctx.reply(`Pesan admin masuk ke tiket ${ticket.ticketId}.`);
  }
});

export async function startBot(): Promise<void> {
  if (config.webhookDomain) {
    const webhookUrl = new URL(config.webhookPath, config.webhookDomain).toString();
    await bot.api.setWebhook(webhookUrl, { drop_pending_updates: true });
    console.log(`[webhook] Telegram webhook configured at ${webhookUrl}`);
    return;
  }

  try {
    await bot.start({ drop_pending_updates: true });
  } catch (error) {
    if (telegramPollingConflict(error)) {
      console.warn('[bot] Another Telegram bot instance is already polling updates. This duplicate instance will exit safely.');
      console.warn('[bot] Startup conflict error detail:', error);
      setTimeout(() => process.exit(0), 500);
    } else {
      throw error;
    }
  }
}

import { Bot, InlineKeyboard } from 'grammy';
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
  ticketListText,
  ticketSummary,
  updateTicketStatus,
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
  '🎮 Selamat datang di TopUpGames!',
  '',
  'Saya adalah bot customer service. Saya akan menghubungkan Anda dengan tim CS kami.',
  '',
  '📌 Pilih menu di bawah:',
  '├── 💬 Hubungi CS → Kirim pesan ke admin',
  '├── 📦 Cek Status Transaksi → Masukkan Transaction ID',
  '├── ❓ FAQ → Pertanyaan umum',
  '└── 🔙 Kembali ke Website → topupgames.com',
  '',
  '⚠️ Jam operasional CS: 09:00 - 22:00 WIB',
  'Respon tercepat di jam operasional.',
  '',
  `Ticket aktif Anda: ${ticketId}`,
].join('\n');

const csOfflineTemplate = (): string => [
  '⏰ Maaf, tim CS kami sedang off.',
  '',
  'Tetapi Anda tetap bisa:',
  '1. Kirim pesan sekarang → akan dibalas besok pagi',
  '2. Cek FAQ di website: topupgames.com/faq',
  '3. Cek status transaksi: topupgames.com/status',
  '',
  'Terima kasih! 🙏',
].join('\n');

const userToAdminTemplate = (userName: string, userId: number, message: string, ticketId: string): string => [
  '📩 PESAN DARI USER',
  '',
  `👤 Nama: ${userName}`,
  `🆔 User ID: ${userId}`,
  '📱 Platform: Website / Telegram',
  '📝 Pesan:',
  `"${message}"`,
  '',
  '📎 Informasi tambahan:',
  '- WIB: saat ini',
  '- User aktif: ✅',
  '- Total transaksi user: 12',
  '',
  `📌 Ticket: ${ticketId}`,
  '📌 [Balas pesan ini untuk membalas user]',
].join('\n');

const customerReplyTemplate = (name: string, replyText: string, ticketId: string): string => [
  '📩 BALASAN DARI CS',
  '',
  `Halo Kak ${name}! 👋`,
  '',
  replyText,
  '',
  '---',
  '',
  '💬 Balas pesan ini untuk membalas CS kembali.',
  '',
  `Ticket: ${ticketId}`,
].join('\n');

const transactionStatusTemplate = (): string => [
  '📦 CEK STATUS TRANSAKSI',
  '',
  'Silakan masukkan Transaction ID Anda.',
  'Contoh: TRX-987',
  '',
  'Atau kirimkan ID Game Anda, kami akan cari di sistem.',
].join('\n');

const transactionDetailsTemplate = (trx: any): string => [
  '📦 DETAIL TRANSAKSI',
  '',
  `🆔 ID Transaksi: ${trx.trxId}`,
  `🎮 Game: ${trx.game.name}`,
  `📦 Produk: ${trx.product.name}`,
  `👤 ID Game User: ${trx.userGameId}`,
  `💰 Nominal: Rp ${Number(trx.amount).toLocaleString('id-ID')}`,
  `🚦 Status: ${trx.status.toUpperCase()}`,
  `📅 Waktu: ${new Date(trx.createdAt).toLocaleString('id-ID')}`,
].join('\n');

const faqTemplate = (): string => [
  '❓ FAQ TopUpGames',
  '',
  '1. Top up belum masuk? Cek transaction ID Anda.',
  '2. Apakah refund bisa? Ya, CS akan menghubungi Anda jika perlu.',
  '3. Kunjungi website: topupgames.com/faq',
].join('\n');

function buildMainMenu(role: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (role === 'customer') {
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
  }

  return keyboard;
}

function buildCustomerPromptTemplate(): string {
  return [
    'Format chat yang disarankan:',
    '1. Nama lengkap',
    '2. Nomor order / email',
    '3. Detail keluhan atau pertanyaan',
    '',
    'Contoh:',
    'Nama: Joni',
    'Order: #1234',
    'Masalah: Top up belum masuk',
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
    await ctx.reply('Halo CS 👋\nSilakan pilih tugas yang tersedia.', {
      reply_markup: buildMainMenu('cs'),
    });
    return;
  }

  if (payload.role === 'admin') {
    setUserSession(telegramId, 'admin');
    await ctx.reply('Halo Admin 👋\nBerikut ringkasan tiket yang sedang berjalan.', {
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
    reply_markup: buildMainMenu('customer'),
  });
});

bot.command('menu', async (ctx) => {
  const telegramId = ctx.from?.id ?? 0;
  const session = getUserSession(telegramId);
  const role = session?.role ?? 'customer';

  if (role === 'cs') {
    await ctx.reply('Halo CS 👋\nSilakan pilih tugas yang tersedia.', {
      reply_markup: buildMainMenu('cs'),
    });
    return;
  }

  if (role === 'admin') {
    await ctx.reply('Halo Admin 👋\nBerikut ringkasan tiket yang sedang berjalan.', {
      reply_markup: buildMainMenu('admin'),
    });
    return;
  }

  const ticket = await getCustomerTicket(telegramId);
  const welcomeMessage = config.csOffline
    ? csOfflineTemplate()
    : customerStartTemplate(ctx.from?.first_name ?? 'Customer', ticket?.ticketId ?? 'TCK-0000');

  await ctx.reply(welcomeMessage, {
    reply_markup: buildMainMenu('customer'),
  });
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    'Perintah yang tersedia:\n/start - mulai chat\n/help - bantuan\n/status - cek status tiket Anda\n/menu - tampilkan template menu\n/admin - masuk ke menu admin\n/cs - masuk ke menu CS',
  );
});

bot.command('status', async (ctx) => {
  const telegramId = ctx.from?.id ?? 0;
  const ticket = await getCustomerTicket(telegramId);

  if (!ticket) {
    await ctx.reply('Anda belum memiliki tiket aktif.');
    return;
  }

  await ctx.reply(ticketSummary(ticket));
});

bot.command('cs', async (ctx) => {
  const telegramId = ctx.from?.id ?? 0;
  setUserSession(telegramId, 'cs');
  await ctx.reply('Halo CS 👋\nSilakan pilih tugas.', { reply_markup: buildMainMenu('cs') });
});

bot.command('admin', async (ctx) => {
  const telegramId = ctx.from?.id ?? 0;
  setUserSession(telegramId, 'admin');
  await ctx.reply('Halo Admin 👋\nSilakan pilih menu.', { reply_markup: buildMainMenu('admin') });
});

bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data ?? '';
  const telegramId = ctx.from?.id ?? 0;

  if (data === 'customer_status') {
    await ctx.reply(transactionStatusTemplate());
    await ctx.answerCallbackQuery('Format cek status ditampilkan');
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
    await ctx.reply(ticket ? ticketSummary(ticket) : 'Belum ada tiket aktif untuk akun Anda.');
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
    const tickets = (await listAdminTickets()).slice(0, 3);
    await ctx.reply(
      ['Dashboard Admin', 'Tiket terbaru:', ticketListText(tickets)].join('\n'),
    );
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
        const customerText = `Pesan dari CS: Tiket bantuan Anda #${ticket.ticketId} telah diselesaikan. Terima kasih telah menghubungi kami! 🙏`;
        await bot.api.sendMessage(Number(user.telegramId), customerText);
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
    await ctx.reply('Pesan Anda kosong.');
    return;
  }

  if (role === 'customer') {
    if (/^trx/i.test(text)) {
      const transaction = await getTransactionByTrxId(text);
      if (transaction) {
        await ctx.reply(transactionDetailsTemplate(transaction));
      } else {
        await ctx.reply(`🔍 Transaksi dengan ID "${text}" tidak ditemukan.\nSilakan periksa kembali ID Transaksi Anda atau hubungi CS jika Anda butuh bantuan.`);
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
      await ctx.reply('Anda belum memilih tiket. Pilih tiket dari daftar terbuka terlebih dahulu.');
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
        await bot.api.sendMessage(Number(user.telegramId), responseText);
        await ctx.reply(`✅ Balasan berhasil dikirim ke customer.`);
      } else {
        await ctx.reply(`Gagal mengirim: User tidak ditemukan.`);
      }
    } else {
      await ctx.reply(`Gagal mengirim: User tidak terhubung.`);
    }
    return;
  }

  if (role === 'admin') {
    const ticket = await getTicketById(session?.ticketId ?? '');
    if (!ticket) {
      await ctx.reply('Anda belum memilih tiket. Gunakan menu admin untuk melihat daftar tiket.');
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

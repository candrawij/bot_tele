import { bot } from '../src/bot/bot.js';
import { prisma } from '../src/services/prisma.js';

async function simulate() {
  console.log("=== MEMULAI SIMULASI UJI COBA BOT TOPUPIN ===\n");

  bot.botInfo = {
    id: 123456789,
    is_bot: true,
    first_name: 'TestBot',
    username: 'test_bot',
    can_join_groups: true,
    can_read_all_group_messages: true,
    supports_inline_queries: false,
  };

  let latestMessage = "";

  bot.api.config.use(async (prev, method, payload, signal) => {
    if (method === 'sendMessage') {
      const p = payload as any;
      console.log(`\n[BOT -> ${p.chat_id}]:`);
      console.log(p.text);
      if (p.reply_markup) {
        console.log('--- KEYBOARD ---');
        console.log(JSON.stringify(p.reply_markup, null, 2));
      }
      latestMessage = p.text;
    } else if (method === 'answerCallbackQuery') {
      const p = payload as any;
      console.log(`\n[BOT ALERT (Callback)]: ${p.text}`);
    }
    return { ok: true, result: {} } as any;
  });

  const testUserId = 999999999;
  const username = "UserTester";

  async function sendText(text: string) {
    const entities = text.startsWith('/') ? [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }] : undefined;

    console.log(`\n🧑 USER (${username}): ${text}`);
    await bot.handleUpdate({
      update_id: Math.floor(Math.random() * 1000000),
      message: {
        message_id: Math.floor(Math.random() * 1000000),
        date: Math.floor(Date.now() / 1000),
        chat: { id: testUserId, type: 'private', first_name: username },
        from: { id: testUserId, is_bot: false, first_name: username },
        text: text,
        entities: entities,
      } as any
    });
    await new Promise(r => setTimeout(r, 100)); // wait for async handlers
  }

  async function sendCallback(data: string) {
    console.log(`\n🧑 USER (${username}) KLIK TOMBOL: ${data}`);
    await bot.handleUpdate({
      update_id: Math.floor(Math.random() * 1000000),
      callback_query: {
        id: Math.floor(Math.random() * 1000000).toString(),
        from: { id: testUserId, is_bot: false, first_name: username },
        chat_instance: 'test_instance',
        data: data,
        message: {
          message_id: Math.floor(Math.random() * 1000000),
          date: Math.floor(Date.now() / 1000),
          chat: { id: testUserId, type: 'private', first_name: username },
        } as any
      } as any
    });
    await new Promise(r => setTimeout(r, 100));
  }

  // Bikin dummy transaction agar dikenali
  const dummyUser = await prisma.user.upsert({
    where: { telegramId: String(testUserId) },
    update: {},
    create: {
      telegramId: String(testUserId),
      name: username,
      phone: '08123456789',
      email: 'tester@test.com',
      password: 'dummy'
    }
  });

  const dummyGame = await prisma.game.upsert({
    where: { slug: 'simulasi-game' },
    update: {},
    create: { name: 'Simulasi Game', slug: 'simulasi-game' }
  });

  const dummyProduct = await prisma.product.findFirst({ where: { gameId: dummyGame.id } }) || await prisma.product.create({
    data: { name: '100 Diamond', price: 10000, gameId: dummyGame.id }
  });

  const dummyTrx = await prisma.transaction.upsert({
    where: { trxId: 'TRX-SIMULATE' },
    update: {},
    create: {
      trxId: 'TRX-SIMULATE',
      userId: dummyUser.id,
      gameId: dummyGame.id,
      productId: dummyProduct.id,
      userGameId: 'UserSim123',
      amount: 10000,
      status: 'pending',
      paymentMethod: 'qris'
    }
  });

  console.log("\n--- SKENARIO 1: START NORMAL (TANPA DEEP LINK) ---");
  await sendText('/start');

  console.log("\n--- SKENARIO 2: ORDER TOPUP LEWAT BOT MENU ---");
  await sendCallback('customer_order');
  await sendCallback(`select_game:${dummyGame.id}`);
  await sendText('12345678'); // Input Game ID
  await sendCallback(`select_product:${dummyProduct.id}`);

  console.log("\n--- SKENARIO 3: DEEP LINK TANYA CS TRANSAKSI (DARI WEB) ---");
  await sendText(`/start trx_${dummyTrx.trxId}`);
  await sendText('Min, pesanan saya ini kok belum masuk?');

  console.log("\n--- SKENARIO 4: PROSES CS MENGAMBIL TIKET ---");
  // CS Telegram ID: 888888888
  const csTelegramId = 888888888;
  const csName = "CS_Tester";
  
  // Ambil TCK ID dari ticket terbaru
  const latestTicket = await prisma.ticket.findFirst({
    where: { userId: dummyUser.id },
    orderBy: { createdAt: 'desc' }
  });
  const ticketId = latestTicket ? latestTicket.ticketId : 'TCK-0001';

  // Simulasikan klik CS Ambil Tiket
  console.log(`\n🧑 CS (${csName}) KLIK TOMBOL: cs_claim_ticket:${ticketId}`);
  await bot.handleUpdate({
    update_id: Math.floor(Math.random() * 1000000),
    callback_query: {
      id: Math.floor(Math.random() * 1000000).toString(),
      from: { id: csTelegramId, is_bot: false, first_name: csName },
      chat_instance: 'cs_instance',
      data: `cs_claim_ticket:${ticketId}`,
      message: {
        message_id: Math.floor(Math.random() * 1000000),
        date: Math.floor(Date.now() / 1000),
        chat: { id: -5399260473, type: 'group', title: 'Admin TopUpin' },
      } as any
    } as any
  });
  await new Promise(r => setTimeout(r, 100));

  console.log("\n--- SKENARIO 5: CHAT DUA ARAH (CUSTOMER <-> CS) ---");
  // Customer mengirim pesan (harus diteruskan langsung ke CS, bukan ke grup admin)
  await sendText('Halo CS, tolong dong dibantu periksa.');
  
  // CS membalas pesan pelanggan
  console.log(`\n🧑 CS (${csName}): Baik Kak, mohon ditunggu sebentar ya.`);
  await bot.handleUpdate({
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: Math.floor(Math.random() * 1000000),
      date: Math.floor(Date.now() / 1000),
      chat: { id: csTelegramId, type: 'private', first_name: csName },
      from: { id: csTelegramId, is_bot: false, first_name: csName },
      text: 'Baik Kak, mohon ditunggu sebentar ya.',
    } as any
  });
  await new Promise(r => setTimeout(r, 100));

  console.log("\n--- SKENARIO 6: CUSTOMER MENGECEK STATUS TIKET ---");
  await sendText('/status');

  console.log("\n--- SKENARIO 7: CS MENYELESAIKAN TIKET & CUSTOMER MEMBERI RATING ---");
  // CS klik tombol selesai
  console.log(`\n🧑 CS (${csName}) KLIK TOMBOL: admin_close_ticket:${ticketId}`);
  await bot.handleUpdate({
    update_id: Math.floor(Math.random() * 1000000),
    callback_query: {
      id: Math.floor(Math.random() * 1000000).toString(),
      from: { id: csTelegramId, is_bot: false, first_name: csName },
      chat_instance: 'cs_instance',
      data: `admin_close_ticket:${ticketId}`,
      message: {
        message_id: Math.floor(Math.random() * 1000000),
        date: Math.floor(Date.now() / 1000),
        chat: { id: csTelegramId, type: 'private', first_name: csName },
      } as any
    } as any
  });
  await new Promise(r => setTimeout(r, 100));

  // Customer memberikan rating 5 bintang
  await sendCallback(`rate_cs:${ticketId}:5`);

  console.log("\n--- SKENARIO 8: ADMIN UTILITY ---");
  await sendText('/admin');
  await sendCallback('admin_dashboard');
  await sendCallback('admin_export_csv');

  console.log("\n=== SIMULASI SELESAI ===");
  process.exit(0);
}

simulate().catch(e => {
  console.error(e);
  process.exit(1);
});

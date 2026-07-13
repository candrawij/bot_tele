import http from 'node:http';
import { webhookCallback, InlineKeyboard } from 'grammy';
import { bot } from '../bot/bot.js';
import { config } from '../config.js';
import { buildAdminDashboardLink, buildCsListLink, buildCustomerSupportLink } from '../services/telegramLink.js';
import { getWebsiteUserByEmail, getWebsiteUserById } from '../services/websiteUserStore.js';
import { prisma } from '../services/prisma.js';

const defaultPort = Number(process.env.WEBSITE_API_PORT ?? 3001);
const webhookHandler = config.webhookDomain
  ? webhookCallback(bot, 'http', {
      secretToken: config.webhookSecretToken || undefined,
    })
  : undefined;

function jsonResponse(res: http.ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });

    req.on('error', reject);
  });
}

function getRoleLink(role: string, userId?: number, ticketId?: string): string {
  if (role === 'customer') {
    if (!userId || !ticketId) {
      throw new Error('customer role requires userId and ticketId');
    }

    return buildCustomerSupportLink(userId, ticketId);
  }

  if (role === 'cs') {
    return buildCsListLink();
  }

  if (role === 'admin') {
    return buildAdminDashboardLink();
  }

  throw new Error('invalid role');
}

function resolveWebsiteUser(payload: Record<string, unknown>): { userId?: number; role?: string; ticketId?: string } {
  const userIdParam = Number(payload.userId ?? 0);
  const emailParam = typeof payload.email === 'string' ? payload.email : undefined;
  const ticketIdParam = typeof payload.ticketId === 'string' ? payload.ticketId : undefined;

  if (userIdParam > 0) {
    const user = getWebsiteUserById(userIdParam);
    if (user) {
      return {
        userId: user.id,
        role: user.role,
        ticketId: user.activeTicketId ?? ticketIdParam,
      };
    }
  }

  if (emailParam) {
    const user = getWebsiteUserByEmail(emailParam);
    if (user) {
      return {
        userId: user.id,
        role: user.role,
        ticketId: user.activeTicketId ?? ticketIdParam,
      };
    }
  }

  return {
    userId: userIdParam || undefined,
    role: typeof payload.role === 'string' ? payload.role : undefined,
    ticketId: ticketIdParam,
  };
}

export function startWebsiteApi(port = defaultPort): http.Server {
  const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const requestUrl = new URL(req.url ?? '/', 'http://localhost');

    if (req.method === 'GET' && requestUrl.pathname === '/health') {
      jsonResponse(res, 200, { status: 'ok', service: 'website-api' });
      return;
    }

    if (req.method === 'POST' && config.webhookDomain && requestUrl.pathname === config.webhookPath) {
      await webhookHandler?.(req, res);
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/telegram-link') {
      try {
        const role = requestUrl.searchParams.get('role') ?? 'customer';
        const userId = Number(requestUrl.searchParams.get('userId') ?? 0);
        const ticketId = requestUrl.searchParams.get('ticketId') ?? undefined;
        const resolved = resolveWebsiteUser({
          role,
          userId,
          ticketId,
        });
        const link = getRoleLink(resolved.role ?? role, resolved.userId || userId || undefined, resolved.ticketId ?? ticketId);

        jsonResponse(res, 200, {
          success: true,
          role: resolved.role ?? role,
          userId: resolved.userId ?? (userId || undefined),
          ticketId: resolved.ticketId ?? ticketId,
          link,
        });
      } catch (error) {
        jsonResponse(res, 400, {
          success: false,
          message: error instanceof Error ? error.message : 'invalid request',
        });
      }

      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/telegram-link') {
      try {
        const bodyText = await readBody(req);
        const payload = bodyText ? JSON.parse(bodyText) : {};
        const resolved = resolveWebsiteUser(payload);
        const role = resolved.role ?? payload.role ?? 'customer';
        const userId = resolved.userId ?? Number(payload.userId ?? 0);
        const ticketId = resolved.ticketId ?? payload.ticketId ?? undefined;
        const link = getRoleLink(role, userId || undefined, ticketId);

        jsonResponse(res, 200, {
          success: true,
          role,
          userId: userId || undefined,
          ticketId,
          link,
        });
      } catch (error) {
        jsonResponse(res, 400, {
          success: false,
          message: error instanceof Error ? error.message : 'invalid request',
        });
      }

      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/create-transaction') {
      try {
        const bodyText = await readBody(req);
        const payload = bodyText ? JSON.parse(bodyText) : {};
        const { userGameId, gameSlug, productName, amount } = payload;

        if (!userGameId || !gameSlug || !productName || !amount) {
          jsonResponse(res, 400, { success: false, message: 'Missing fields' });
          return;
        }

        let game = await prisma.game.findUnique({ where: { slug: gameSlug } });
        if (!game) {
          game = await prisma.game.create({
            data: {
              name: gameSlug === 'mobile-legends' ? 'Mobile Legends' : gameSlug.toUpperCase(),
              slug: gameSlug,
              isActive: true,
            },
          });
        }

        let product = await prisma.product.findFirst({
          where: { gameId: game.id, name: productName },
        });
        if (!product) {
          product = await prisma.product.create({
            data: {
              gameId: game.id,
              name: productName,
              price: Number(amount),
              isActive: true,
            },
          });
        }

        const firstUser = await prisma.user.findFirst();

        const randomTrxId = `TRX-${Math.floor(100 + Math.random() * 900)}`;
        const transaction = await prisma.transaction.create({
          data: {
            trxId: randomTrxId,
            gameId: game.id,
            productId: product.id,
            userId: firstUser ? firstUser.id : null,
            userGameId,
            amount: Number(amount),
            paymentMethod: 'Qris',
            status: 'pending',
          },
          include: {
            game: true,
            product: true,
          },
        });

        const serialized = JSON.parse(
          JSON.stringify(transaction, (key, value) =>
            typeof value === 'bigint' ? Number(value) : value
          )
        );

        if (config.adminGroupChatId) {
          const adminText = [
            '💸 *PESANAN TRANSAKSI BARU*',
            '',
            `🆔 ID: ${randomTrxId}`,
            `🎮 Game: ${game.name}`,
            `📦 Produk: ${product.name}`,
            `👤 ID Game User: ${userGameId}`,
            `💰 Nominal: Rp ${Number(amount).toLocaleString('id-ID')}`,
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

        jsonResponse(res, 200, {
          success: true,
          transaction: serialized,
        });
      } catch (error) {
        jsonResponse(res, 500, {
          success: false,
          message: error instanceof Error ? error.message : 'server error',
        });
      }
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/transactions') {
      try {
        const transactions = await prisma.transaction.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            game: true,
            product: true,
            user: true,
          },
        });

        const serialized = JSON.parse(
          JSON.stringify(transactions, (key, value) =>
            typeof value === 'bigint' ? Number(value) : value
          )
        );

        jsonResponse(res, 200, {
          success: true,
          transactions: serialized,
        });
      } catch (error) {
        jsonResponse(res, 500, {
          success: false,
          message: error instanceof Error ? error.message : 'server error',
        });
      }
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/notify-transaction') {
      try {
        const bodyText = await readBody(req);
        const payload = bodyText ? JSON.parse(bodyText) : {};
        const { trxId, status } = payload;

        if (!trxId || !status) {
          jsonResponse(res, 400, { success: false, message: 'trxId and status are required' });
          return;
        }

        const trx = await prisma.transaction.findUnique({
          where: { trxId },
          include: {
            game: true,
            product: true,
            user: true,
          },
        });

        if (!trx) {
          jsonResponse(res, 404, { success: false, message: 'transaction not found' });
          return;
        }

        await prisma.transaction.update({
          where: { trxId },
          data: { status },
        });

        if (trx.user && trx.user.telegramId) {
          const telegramId = Number(trx.user.telegramId);
          let messageText = '';

          if (status === 'success') {
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
              'Terima kasih sudah berbelanja di TopUpin! 🙏',
            ].join('\n');
          } else if (status === 'failed') {
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
          } else {
            messageText = `🔔 *UPDATE TRANSAKSI*\n\nStatus transaksi Anda dengan ID *${trx.trxId}* berubah menjadi *${status.toUpperCase()}*.`;
          }

          await bot.api.sendMessage(telegramId, messageText, { parse_mode: 'Markdown' });

          jsonResponse(res, 200, {
            success: true,
            message: 'notification sent to telegram user',
            telegramId,
          });
        } else {
          jsonResponse(res, 200, {
            success: true,
            message: 'status updated, but no telegram_id linked to user',
          });
        }
      } catch (error) {
        jsonResponse(res, 500, {
          success: false,
          message: error instanceof Error ? error.message : 'server error',
        });
      }

      return;
    }

    jsonResponse(res, 404, {
      success: false,
      message: 'route not found',
    });
  });

  server.listen(port, () => {
    console.log(`Website API is running on http://localhost:${port}`);
  });

  return server;
}

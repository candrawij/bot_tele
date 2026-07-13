import { config } from '../config.js';
import { type TelegramLaunchPayload, encryptPayload } from './telegramPayload.js';

export interface TelegramDeepLinkOptions extends TelegramLaunchPayload {
  botUsername?: string;
}

export function serializeLaunchPayload(payload: TelegramLaunchPayload): string {
  return encryptPayload(payload);
}

export function buildTelegramDeepLink(options: TelegramDeepLinkOptions): string {
  const botUsername = options.botUsername ?? config.botUsername;
  const payload = serializeLaunchPayload(options);

  return `https://t.me/${botUsername}?start=${encodeURIComponent(payload)}`;
}

export function buildCustomerSupportLink(userId: number, ticketId: string, botUsername?: string): string {
  return buildTelegramDeepLink({
    source: 'website',
    role: 'customer',
    userId,
    ticketId,
    action: 'open_ticket',
    botUsername,
  });
}

export function buildCsListLink(botUsername?: string): string {
  return buildTelegramDeepLink({
    source: 'website',
    role: 'cs',
    action: 'list',
    botUsername,
  });
}

export function buildAdminDashboardLink(botUsername?: string): string {
  return buildTelegramDeepLink({
    source: 'website',
    role: 'admin',
    action: 'dashboard',
    botUsername,
  });
}

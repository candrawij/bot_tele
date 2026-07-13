import { config } from '../config.js';
import type { TelegramLaunchPayload } from './telegramPayload.js';

export interface TelegramDeepLinkOptions extends TelegramLaunchPayload {
  botUsername?: string;
}

export function serializeLaunchPayload(payload: TelegramLaunchPayload): string {
  const segments: string[] = [];

  if (payload.source) {
    segments.push(payload.source);
  }

  if (payload.role) {
    segments.push(payload.role);
  }

  if (payload.userId !== undefined) {
    segments.push('user', String(payload.userId));
  }

  if (payload.ticketId) {
    const compactTicketId = payload.ticketId.replace(/^TCK-/, '');
    segments.push('ticket', compactTicketId);
  }

  if (payload.action) {
    segments.push(payload.action);
  }

  return segments.join('-');
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

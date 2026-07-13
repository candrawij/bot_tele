export interface TelegramLaunchPayload {
  source?: string;
  role?: 'customer' | 'cs' | 'admin';
  userId?: number;
  ticketId?: string;
  action?: string;
  websiteUserId?: number;
}

export function parsePayload(payloadText?: string): TelegramLaunchPayload {
  const normalized = (payloadText ?? '').trim();
  if (!normalized) {
    return {};
  }

  const parts = normalized.split(/[-_]+/).filter(Boolean);
  const payload: TelegramLaunchPayload = {};

  if (parts.includes('website')) {
    payload.source = 'website';
  }

  if (parts.includes('customer')) {
    payload.role = 'customer';
  }

  if (parts.includes('cs')) {
    payload.role = 'cs';
  }

  if (parts.includes('admin')) {
    payload.role = 'admin';
  }

  if (parts.includes('ticket')) {
    const ticketIndex = parts.indexOf('ticket');
    const ticketValue = parts[ticketIndex + 1];
    payload.ticketId = ticketValue ? `TCK-${ticketValue}` : undefined;
  }

  if (parts.includes('user')) {
    const userIndex = parts.indexOf('user');
    const numeric = Number(parts[userIndex + 1]);
    payload.userId = Number.isFinite(numeric) ? numeric : undefined;
  }

  if (parts.includes('list')) {
    payload.action = 'list';
  }

  if (parts.includes('dashboard')) {
    payload.action = 'dashboard';
  }

  if (parts.includes('open_ticket')) {
    payload.action = 'open_ticket';
  }

  return payload;
}

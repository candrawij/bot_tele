import crypto from 'node:crypto';
import { config } from '../config.js';

export interface TelegramLaunchPayload {
  source?: string;
  role?: 'customer' | 'cs' | 'admin';
  userId?: number;
  ticketId?: string;
  action?: string;
  websiteUserId?: number;
}

// Derive a 32-byte key using SHA-256 from the configured secret
function getEncryptionKey(): Buffer {
  return crypto.createHash('sha256').update(config.deepLinkSecret).digest();
}

export function encryptPayload(payload: TelegramLaunchPayload): string {
  const secretKey = getEncryptionKey(); 
  const buf = Buffer.alloc(16);

  // 1. Role
  let roleByte = 0;
  if (payload.role === 'customer') roleByte = 1;
  else if (payload.role === 'cs') roleByte = 2;
  else if (payload.role === 'admin') roleByte = 3;
  buf.writeUInt8(roleByte, 0);

  // 2. UserId
  const userIdVal = payload.userId ?? 0;
  buf.writeUInt32BE(userIdVal, 1);

  // 3. TicketId
  let ticketIdNum = 0;
  if (payload.ticketId) {
    const matched = payload.ticketId.match(/\d+/);
    if (matched) {
      ticketIdNum = parseInt(matched[0], 10);
    }
  }
  buf.writeUInt32BE(ticketIdNum, 5);

  // 4. Action
  let actionByte = 0;
  if (payload.action === 'open_ticket') actionByte = 1;
  else if (payload.action === 'list') actionByte = 2;
  else if (payload.action === 'dashboard') actionByte = 3;
  buf.writeUInt8(actionByte, 9);

  // 5. Source
  let sourceByte = 0;
  if (payload.source === 'website') sourceByte = 1;
  buf.writeUInt8(sourceByte, 10);

  // 6. Padding/salt (5 bytes)
  crypto.randomBytes(5).copy(buf, 11);

  // Encrypt with AES-256-ECB
  const cipher = crypto.createCipheriv('aes-256-ecb', secretKey, null);
  cipher.setAutoPadding(false); 
  const encrypted = Buffer.concat([cipher.update(buf), cipher.final()]);

  return encrypted.toString('base64url');
}

export function decryptPayload(encrypted: string): TelegramLaunchPayload {
  try {
    const secretKey = getEncryptionKey();
    const encryptedBuf = Buffer.from(encrypted, 'base64url');

    if (encryptedBuf.length !== 16) {
      throw new Error('Invalid encrypted payload length');
    }

    const decipher = crypto.createDecipheriv('aes-256-ecb', secretKey, null);
    decipher.setAutoPadding(false);
    const decrypted = Buffer.concat([decipher.update(encryptedBuf), decipher.final()]);

    const roleByte = decrypted.readUInt8(0);
    const userIdVal = decrypted.readUInt32BE(1);
    const ticketIdNum = decrypted.readUInt32BE(5);
    const actionByte = decrypted.readUInt8(9);
    const sourceByte = decrypted.readUInt8(10);

    const payload: TelegramLaunchPayload = {};

    if (roleByte === 1) payload.role = 'customer';
    else if (roleByte === 2) payload.role = 'cs';
    else if (roleByte === 3) payload.role = 'admin';

    if (userIdVal > 0) payload.userId = userIdVal;
    
    if (ticketIdNum > 0) {
      payload.ticketId = `TCK-${String(ticketIdNum).padStart(4, '0')}`;
    }

    if (actionByte === 1) payload.action = 'open_ticket';
    else if (actionByte === 2) payload.action = 'list';
    else if (actionByte === 3) payload.action = 'dashboard';

    if (sourceByte === 1) payload.source = 'website';

    return payload;
  } catch {
    return {};
  }
}

export function parsePayload(payloadText?: string): TelegramLaunchPayload {
  const normalized = (payloadText ?? '').trim();
  if (!normalized) {
    return {};
  }

  // Try decrypting first
  const decrypted = decryptPayload(normalized);
  if (decrypted.role || decrypted.source || decrypted.userId || decrypted.ticketId) {
    return decrypted;
  }

  // Fallback to old plaintext parsing
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

  if (parts.includes('open_ticket') || (parts.includes('open') && parts.includes('ticket'))) {
    payload.action = 'open_ticket';
  }

  return payload;
}

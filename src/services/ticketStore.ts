import fs from 'node:fs';
import path from 'node:path';

export type UserRole = 'customer' | 'cs' | 'admin';
export type TicketStatus = 'open' | 'assigned' | 'pending' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high';
export type MessageSender = 'customer' | 'cs' | 'admin';

export interface TicketMessage {
  sender: MessageSender;
  text: string;
  createdAt: string;
}

export interface TicketRecord {
  id: string;
  customerId: number;
  customerName: string;
  websiteUserId?: number;
  status: TicketStatus;
  priority: TicketPriority;
  assignedCsId?: number;
  createdAt: string;
  updatedAt: string;
  lastMessage: string;
  conversation: TicketMessage[];
}

interface UserSession {
  role: UserRole;
  ticketId?: string;
}

const storagePath = path.resolve(process.cwd(), 'data', 'tickets.json');
const tickets = new Map<string, TicketRecord>();
const sessions = new Map<number, UserSession>();
let ticketCounter = 1;

function nowIso(): string {
  return new Date().toISOString();
}

function ensureStorageFile(): void {
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });

  if (!fs.existsSync(storagePath)) {
    fs.writeFileSync(storagePath, '[]', 'utf8');
  }
}

function readStoredTickets(): TicketRecord[] {
  ensureStorageFile();

  try {
    const fileContent = fs.readFileSync(storagePath, 'utf8');
    if (!fileContent.trim()) {
      return [];
    }

    const parsed = JSON.parse(fileContent) as TicketRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistStoredTickets(): void {
  ensureStorageFile();
  fs.writeFileSync(storagePath, JSON.stringify(Array.from(tickets.values()), null, 2), 'utf8');
}

function hydrateTicketsFromDisk(): void {
  const storedTickets = readStoredTickets();

  for (const ticket of storedTickets) {
    tickets.set(ticket.id, ticket);
  }

  const numericTicketIds = storedTickets
    .map((ticket) => Number(ticket.id.replace(/\D/g, '')))
    .filter((value) => Number.isFinite(value));

  if (numericTicketIds.length > 0) {
    ticketCounter = Math.max(...numericTicketIds) + 1;
  }
}

hydrateTicketsFromDisk();

function getTicketId(): string {
  const nextId = String(ticketCounter).padStart(4, '0');
  ticketCounter += 1;
  return `TCK-${nextId}`;
}

export function setUserSession(telegramId: number, role: UserRole, ticketId?: string): void {
  sessions.set(telegramId, { role, ticketId });
}

export function getUserSession(telegramId: number): UserSession | undefined {
  return sessions.get(telegramId);
}

export function clearUserSession(telegramId: number): void {
  sessions.delete(telegramId);
}

export function createTicket(
  customerId: number,
  customerName: string,
  initialMessage: string,
  websiteUserId?: number,
): TicketRecord {
  const ticket: TicketRecord = {
    id: getTicketId(),
    customerId,
    customerName,
    websiteUserId,
    status: 'open',
    priority: 'normal',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastMessage: initialMessage,
    conversation: [
      {
        sender: 'customer',
        text: initialMessage,
        createdAt: nowIso(),
      },
    ],
  };

  tickets.set(ticket.id, ticket);
  persistStoredTickets();
  return ticket;
}

export function getTicketById(ticketId: string): TicketRecord | undefined {
  return tickets.get(ticketId);
}

export function listOpenTickets(): TicketRecord[] {
  return Array.from(tickets.values())
    .filter((ticket) => ticket.status !== 'closed')
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function listAdminTickets(): TicketRecord[] {
  return Array.from(tickets.values()).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function getCustomerTicket(customerId: number): TicketRecord | undefined {
  return Array.from(tickets.values())
    .filter((ticket) => ticket.customerId === customerId && ticket.status !== 'closed')
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}

export function getOrCreateCustomerTicket(
  customerId: number,
  customerName: string,
  initialMessage: string,
  websiteUserId?: number,
): TicketRecord {
  const existing = getCustomerTicket(customerId);
  if (existing) {
    return existing;
  }

  return createTicket(customerId, customerName, initialMessage, websiteUserId);
}

export function appendMessage(ticketId: string, sender: MessageSender, text: string): TicketRecord | undefined {
  const ticket = tickets.get(ticketId);
  if (!ticket) {
    return undefined;
  }

  ticket.conversation.push({ sender, text, createdAt: nowIso() });
  ticket.lastMessage = text;
  ticket.updatedAt = nowIso();
  persistStoredTickets();
  return ticket;
}

export function assignTicket(ticketId: string, csId: number): TicketRecord | undefined {
  const ticket = tickets.get(ticketId);
  if (!ticket) {
    return undefined;
  }

  ticket.assignedCsId = csId;
  ticket.status = 'assigned';
  ticket.updatedAt = nowIso();
  persistStoredTickets();
  return ticket;
}

export function updateTicketStatus(ticketId: string, status: TicketStatus): TicketRecord | undefined {
  const ticket = tickets.get(ticketId);
  if (!ticket) {
    return undefined;
  }

  ticket.status = status;
  ticket.updatedAt = nowIso();
  persistStoredTickets();
  return ticket;
}

export function ticketSummary(ticket: TicketRecord): string {
  return [
    `#${ticket.id}`,
    `Status: ${ticket.status}`,
    `Prioritas: ${ticket.priority}`,
    `Customer: ${ticket.customerName}`,
    `Pesan terakhir: ${ticket.lastMessage}`,
  ].join('\n');
}

export function ticketListText(ticketsToShow: TicketRecord[]): string {
  if (ticketsToShow.length === 0) {
    return 'Belum ada tiket yang tersedia.';
  }

  return ticketsToShow
    .slice(0, 5)
    .map((ticket) => `• ${ticket.id} | ${ticket.customerName} | ${ticket.status} | ${ticket.lastMessage}`)
    .join('\n');
}

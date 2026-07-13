import fs from 'node:fs';
import path from 'node:path';
import {
  type TicketRecord,
  assignTicket,
  createTicket,
  getCustomerTicket,
  getTicketById,
  listAdminTickets,
  listOpenTickets,
  updateTicketStatus,
  appendMessage,
} from './ticketStore.js';

const storagePath = path.resolve(process.cwd(), 'data', 'tickets.json');

function ensureStorageFile(): void {
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });

  if (!fs.existsSync(storagePath)) {
    fs.writeFileSync(storagePath, '[]', 'utf8');
  }
}

function readStorage(): TicketRecord[] {
  ensureStorageFile();
  const file = fs.readFileSync(storagePath, 'utf8');
  return JSON.parse(file) as TicketRecord[];
}

function writeStorage(tickets: TicketRecord[]): void {
  ensureStorageFile();
  fs.writeFileSync(storagePath, JSON.stringify(tickets, null, 2), 'utf8');
}

export function saveTicket(ticket: TicketRecord): void {
  const tickets = readStorage();
  const existingIndex = tickets.findIndex((item) => item.id === ticket.id);

  if (existingIndex >= 0) {
    tickets[existingIndex] = ticket;
  } else {
    tickets.push(ticket);
  }

  writeStorage(tickets);
}

export function loadAllTickets(): TicketRecord[] {
  return readStorage();
}

export function persistTicketState(): void {
  const tickets = listAdminTickets();
  writeStorage(tickets);
}

export function createPersistedTicket(
  customerId: number,
  customerName: string,
  initialMessage: string,
  websiteUserId?: number,
): TicketRecord {
  const ticket = createTicket(customerId, customerName, initialMessage, websiteUserId);
  saveTicket(ticket);
  return ticket;
}

export function getPersistedCustomerTicket(customerId: number): TicketRecord | undefined {
  return getCustomerTicket(customerId);
}

export function getPersistedTicketById(ticketId: string): TicketRecord | undefined {
  return getTicketById(ticketId);
}

export function persistAssignTicket(ticketId: string, csId: number): TicketRecord | undefined {
  const ticket = assignTicket(ticketId, csId);
  if (ticket) {
    saveTicket(ticket);
  }

  return ticket;
}

export function persistUpdateTicketStatus(ticketId: string, status: 'open' | 'assigned' | 'pending' | 'closed'): TicketRecord | undefined {
  const ticket = updateTicketStatus(ticketId, status);
  if (ticket) {
    saveTicket(ticket);
  }

  return ticket;
}

export function persistAppendMessage(ticketId: string, sender: 'customer' | 'cs' | 'admin', text: string): TicketRecord | undefined {
  const ticket = appendMessage(ticketId, sender, text);
  if (ticket) {
    saveTicket(ticket);
  }

  return ticket;
}

export function getPersistedOpenTickets(): TicketRecord[] {
  return listOpenTickets();
}

export function getPersistedAdminTickets(): TicketRecord[] {
  return listAdminTickets();
}

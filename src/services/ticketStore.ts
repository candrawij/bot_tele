import { prisma } from './prisma.js';
import { Ticket, TicketMessage, Prisma } from '@prisma/client';

export type UserRole = 'customer' | 'cs' | 'admin';
export type TicketStatus = 'open' | 'assigned' | 'pending' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high';
export type MessageSender = 'customer' | 'cs' | 'admin' | 'system';

export type TicketRecord = Ticket & {
  messages: TicketMessage[];
};

// Sessions ephemeral
interface UserSession {
  role: UserRole;
  ticketId?: string;
  orderState?: 'idle' | 'awaiting_game_id';
  orderData?: {
    gameId?: number;
    gameSlug?: string;
    userGameId?: string;
  };
}

const sessions = new Map<number, UserSession>();

export function setUserSession(telegramId: number, role: UserRole, ticketId?: string, orderState?: 'idle' | 'awaiting_game_id', orderData?: any): void {
  sessions.set(telegramId, { role, ticketId, orderState, orderData });
}

export function updateUserSession(telegramId: number, partialSession: Partial<UserSession>): void {
  const current = sessions.get(telegramId) || { role: 'customer' };
  sessions.set(telegramId, { ...current, ...partialSession });
}

export function getUserSession(telegramId: number): UserSession | undefined {
  return sessions.get(telegramId);
}

export function clearUserSession(telegramId: number): void {
  sessions.delete(telegramId);
}

export async function createTicket(
  customerId: number,
  customerName: string,
  initialMessage: string,
  websiteUserId?: number,
): Promise<TicketRecord> {
  let user = await prisma.user.findUnique({ where: { telegramId: customerId } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId: customerId,
        name: customerName,
        email: `${customerId}@telegram.local`, 
        password: 'dummy',
      }
    });
  }

  const count = await prisma.ticket.count();
  const ticketIdStr = `TCK-${String(count + 1).padStart(4, '0')}`;

  const ticket = await prisma.ticket.create({
    data: {
      ticketId: ticketIdStr,
      userId: user.id,
      category: 'general',
      messages: {
        create: {
          senderType: 'customer',
          message: initialMessage
        }
      }
    },
    include: {
      messages: true
    }
  });

  return ticket as unknown as TicketRecord;
}

export async function getTicketById(ticketId: string): Promise<TicketRecord | null> {
  const ticket = await prisma.ticket.findUnique({
    where: { ticketId },
    include: { messages: true }
  });
  return ticket as unknown as TicketRecord | null;
}

export async function listOpenTickets(): Promise<TicketRecord[]> {
  const tickets = await prisma.ticket.findMany({
    where: { status: { not: 'closed' } },
    orderBy: { createdAt: 'desc' },
    include: { messages: true }
  });
  return tickets as unknown as TicketRecord[];
}

export async function listAdminTickets(): Promise<TicketRecord[]> {
  const tickets = await prisma.ticket.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { messages: true }
  });
  return tickets as unknown as TicketRecord[];
}

export async function getCustomerTicket(customerId: number): Promise<TicketRecord | null> {
  const user = await prisma.user.findUnique({ where: { telegramId: customerId } });
  if (!user) return null;

  const ticket = await prisma.ticket.findFirst({
    where: { 
      userId: user.id,
      status: { not: 'closed' } 
    },
    orderBy: { updatedAt: 'desc' },
    include: { messages: true }
  });
  return ticket as unknown as TicketRecord | null;
}

export async function getOrCreateCustomerTicket(
  customerId: number,
  customerName: string,
  initialMessage: string,
  websiteUserId?: number,
): Promise<TicketRecord> {
  const existing = await getCustomerTicket(customerId);
  if (existing) {
    return existing;
  }
  return createTicket(customerId, customerName, initialMessage, websiteUserId);
}

export async function appendMessage(ticketId: string, sender: MessageSender, text: string): Promise<TicketRecord | null> {
  const ticket = await prisma.ticket.findUnique({ where: { ticketId } });
  if (!ticket) return null;

  await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      senderType: sender,
      message: text
    }
  });
  
  const updatedTicket = await prisma.ticket.update({
    where: { ticketId },
    data: { lastMessageAt: new Date(), updatedAt: new Date(), messagesCount: { increment: 1 } },
    include: { messages: true }
  });

  return updatedTicket as unknown as TicketRecord;
}

export async function assignTicket(ticketId: string, csId: number, csName?: string): Promise<TicketRecord | null> {
  let csAgent = await prisma.csAgent.findUnique({ where: { telegramId: csId } });
  if (!csAgent) {
    csAgent = await prisma.csAgent.create({
      data: {
        telegramId: csId,
        name: csName || `CS Agent ${csId}`,
        email: `${csId}@cs.telegram.local`,
        status: 'online',
      }
    });
  }

  const ticket = await prisma.ticket.update({
    where: { ticketId },
    data: {
      csAgentId: csAgent.id,
      status: 'assigned',
      assignedAt: new Date()
    },
    include: { messages: true }
  });
  return ticket as unknown as TicketRecord | null;
}

export async function updateTicketStatus(ticketId: string, status: TicketStatus): Promise<TicketRecord | null> {
  const data: any = { status };
  if (status === 'closed') {
    data.closedAt = new Date();
  }
  const ticket = await prisma.ticket.update({
    where: { ticketId },
    data,
    include: { messages: true }
  });
  return ticket as unknown as TicketRecord | null;
}

export function ticketSummary(ticket: TicketRecord | any): string {
  const lastMessage = ticket.messages?.length > 0 ? ticket.messages[ticket.messages.length - 1].message : '-';
  return [
    `#${ticket.ticketId}`,
    `Status: ${ticket.status}`,
    `Prioritas: ${ticket.priority}`,
    `Pesan terakhir: ${lastMessage}`,
  ].join('\n');
}

export function ticketListText(ticketsToShow: TicketRecord[] | any[]): string {
  if (ticketsToShow.length === 0) {
    return 'Belum ada tiket yang tersedia.';
  }

  return ticketsToShow
    .slice(0, 5)
    .map((ticket) => {
      const lastMsg = ticket.messages?.length > 0 ? ticket.messages[ticket.messages.length - 1].message : '-';
      return `• ${ticket.ticketId} | ${ticket.status} | ${lastMsg}`;
    })
    .join('\n');
}

export async function listCsTickets(telegramId: number): Promise<TicketRecord[]> {
  const csAgent = await prisma.csAgent.findUnique({ where: { telegramId } });
  if (!csAgent) return [];

  const tickets = await prisma.ticket.findMany({
    where: { 
      csAgentId: csAgent.id,
      status: { not: 'closed' } 
    },
    orderBy: { createdAt: 'desc' },
    include: { messages: true }
  });
  return tickets as unknown as TicketRecord[];
}

export async function rateTicket(ticketId: string, rating: number): Promise<void> {
  const ticket = await prisma.ticket.update({
    where: { ticketId },
    data: { rating }
  });

  if (ticket.csAgentId) {
    // Calculate new average rating for the CS agent
    const result = await prisma.ticket.aggregate({
      where: {
        csAgentId: ticket.csAgentId,
        rating: { not: null }
      },
      _avg: { rating: true }
    });

    const avgRating = result._avg.rating || 0;
    
    await prisma.csAgent.update({
      where: { id: ticket.csAgentId },
      data: { rating: avgRating }
    });
  }
}

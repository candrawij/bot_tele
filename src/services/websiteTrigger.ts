import { buildAdminDashboardLink, buildCsListLink, buildCustomerSupportLink } from './telegramLink.js';

export interface WebsiteBotTriggerHelpers {
  customerLink(userId: number, ticketId: string): string;
  csLink(): string;
  adminLink(): string;
}

export function createWebsiteTriggerHelpers(botUsername?: string): WebsiteBotTriggerHelpers {
  return {
    customerLink(userId: number, ticketId: string) {
      return buildCustomerSupportLink(userId, ticketId, botUsername);
    },
    csLink() {
      return buildCsListLink(botUsername);
    },
    adminLink() {
      return buildAdminDashboardLink(botUsername);
    },
  };
}

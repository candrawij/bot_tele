import 'dotenv/config';

export const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  botUsername: process.env.TELEGRAM_BOT_USERNAME ?? 'your_bot_username',
  websiteBaseUrl: process.env.WEBSITE_BASE_URL ?? 'http://localhost:3000',
  adminGroupChatId: Number(process.env.ADMIN_GROUP_CHAT_ID ?? 0),
  csOffline: String(process.env.CS_OFFLINE ?? 'false').toLowerCase() === 'true',
  hermesAgentUrl: process.env.HERMES_AGENT_URL ?? 'http://localhost:3000',
  hermesAgentApiKey: process.env.HERMES_AGENT_API_KEY ?? '',
  hermesAgentModel: process.env.HERMES_AGENT_MODEL ?? 'gpt-4o-mini',
  webhookDomain: process.env.WEBHOOK_DOMAIN ?? '',
  webhookPath: process.env.WEBHOOK_PATH ?? '/telegram-webhook',
  webhookPort: Number(process.env.WEBHOOK_PORT ?? 3002),
  webhookSecretToken: process.env.WEBHOOK_SECRET_TOKEN ?? '',
};

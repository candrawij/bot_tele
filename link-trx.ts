import 'dotenv/config';
import { prisma } from './src/services/prisma.js';

async function main() {
  const user = await prisma.user.findFirst();
  if (user) {
    await prisma.transaction.update({
      where: { trxId: 'TRX-987' },
      data: { userId: user.id }
    });
    console.log(`SUCCESS: Linked TRX-987 to user "${user.name}" (Telegram ID: ${user.telegramId})`);
  } else {
    console.warn('WARNING: No user found in the database. Please start a chat with the bot first, then run this script again.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

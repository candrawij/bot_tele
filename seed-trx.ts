import 'dotenv/config';
import { prisma } from './src/services/prisma.js';

async function main() {
  console.log('Inserting mock transaction data...');

  // 1. Create or Find Game
  let game = await prisma.game.findUnique({
    where: { slug: 'mobile-legends' },
  });

  if (!game) {
    game = await prisma.game.create({
      data: {
        name: 'Mobile Legends',
        slug: 'mobile-legends',
        logoUrl: 'https://placeholder.com/mlbb.png',
        isActive: true,
      },
    });
    console.log('Created Game:', game.name);
  } else {
    console.log('Game already exists:', game.name);
  }

  // 2. Create or Find Product
  let product = await prisma.product.findFirst({
    where: { gameId: game.id, name: '86 Diamonds' },
  });

  if (!product) {
    product = await prisma.product.create({
      data: {
        gameId: game.id,
        name: '86 Diamonds',
        price: 20000,
        stock: 100,
        isActive: true,
      },
    });
    console.log('Created Product:', product.name);
  } else {
    console.log('Product already exists:', product.name);
  }

  // 3. Create or Find Transaction "TRX-987"
  const trxId = 'TRX-987';
  let transaction = await prisma.transaction.findUnique({
    where: { trxId },
  });

  if (!transaction) {
    transaction = await prisma.transaction.create({
      data: {
        trxId,
        gameId: game.id,
        productId: product.id,
        userGameId: '123456789',
        amount: 20000,
        paymentMethod: 'Qris',
        status: 'success',
      },
    });
    console.log(`Created Transaction ${trxId}:`, transaction);
  } else {
    console.log(`Transaction ${trxId} already exists`);
  }

  console.log('Mock seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

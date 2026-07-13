import { prisma } from './prisma.js';
import { Transaction, Game, Product } from '@prisma/client';

export type TransactionWithDetails = Transaction & {
  game: Game;
  product: Product;
};

export async function getTransactionByTrxId(trxId: string): Promise<TransactionWithDetails | null> {
  const transaction = await prisma.transaction.findUnique({
    where: { trxId },
    include: {
      game: true,
      product: true,
    },
  });
  return transaction as TransactionWithDetails | null;
}

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, WalletTransactionType, WagerStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import Stripe from "stripe";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class WalletService {
  private stripe: Stripe | null = null;
  // 100 tokens = $1
  private packTokens: Record<string, number> = {
    small: 100,
    medium: 500,
    large: 1000,
    mega: 2000
  };

  constructor(private readonly prisma: PrismaService, private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>("stripe.secretKey");
    if (secretKey) {
    this.stripe = new Stripe(secretKey);
    }
    // Stripe is optional for local development
  }

  async ensureWallet(userId: string) {
    return this.prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId }
    });
  }

  async getWallet(userId: string) {
    await this.ensureWallet(userId);
    return this.prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 20
        }
      }
    });
  }

  async creditTokens(userId: string, amount: number, metadata?: Prisma.InputJsonValue) {
    if (amount <= 0) throw new BadRequestException("Amount must be positive");
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.update({
        where: { userId },
        data: {
          balanceTokens: { increment: amount },
          transactions: {
            create: {
              type: WalletTransactionType.PURCHASE,
              amountTokens: amount,
              metadata
            }
          }
        },
        include: { transactions: true }
      });
      return wallet;
    });
  }

  async debitTokens(userId: string, amount: number, type: WalletTransactionType, metadata?: Prisma.InputJsonValue, sessionId?: string) {
    if (amount <= 0) throw new BadRequestException("Amount must be positive");
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string; balanceTokens: number }[]>`
        SELECT id, "balanceTokens" FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE
      `;
      
      if (!locked.length) throw new NotFoundException("Wallet not found");
      if (locked[0].balanceTokens < amount) throw new BadRequestException("Insufficient tokens");

      return tx.wallet.update({
        where: { userId },
        data: {
          balanceTokens: { decrement: amount },
          transactions: {
            create: {
              type,
              amountTokens: amount,
              sessionId,
              metadata
            }
          }
        }
      });
    });
  }

  /**
   * Send a gift from one user to another
   * Debits from sender and credits to receiver
   */
  async sendGift(senderUserId: string, receiverUserId: string, amount: number, sessionId?: string) {
    if (amount <= 0) throw new BadRequestException("Amount must be positive");
    if (senderUserId === receiverUserId) throw new BadRequestException("Cannot send a gift to yourself");
    
    await this.ensureWallet(senderUserId);
    await this.ensureWallet(receiverUserId);
    
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string; balanceTokens: number }[]>`
        SELECT id, "balanceTokens" FROM "Wallet" WHERE "userId" = ${senderUserId} FOR UPDATE
      `;
      if (!locked.length) throw new NotFoundException("Sender wallet not found");
      if (locked[0].balanceTokens < amount) throw new BadRequestException("Insufficient tokens");

      // Debit sender
      await tx.wallet.update({
        where: { userId: senderUserId },
        data: {
          balanceTokens: { decrement: amount },
          transactions: {
            create: {
              type: WalletTransactionType.GIFT_SENT,
              amountTokens: amount,
              sessionId,
              metadata: { recipientId: receiverUserId }
            }
          }
        }
      });

      // Credit receiver
      const receiverWallet = await tx.wallet.update({
        where: { userId: receiverUserId },
        data: {
          balanceTokens: { increment: amount },
          transactions: {
            create: {
              type: WalletTransactionType.GIFT_RECEIVED,
              amountTokens: amount,
              sessionId,
              metadata: { senderId: senderUserId }
            }
          }
        },
        select: { balanceTokens: true }
      });

      return { 
        success: true, 
        amount, 
        senderBalance: locked[0].balanceTokens - amount,
        receiverBalance: receiverWallet.balanceTokens
      };
    });
  }

  async lockTokensForWager(userId: string, amount: number) {
    return this.debitTokens(userId, amount, WalletTransactionType.WAGER_LOCK, { reason: "wager_lock" });
  }

  async payoutWager(wagerId: string, winnerUserId: string) {
    const wager = await this.prisma.wager.findUnique({
      where: { id: wagerId },
      include: { participants: true, game: true }
    });
    if (!wager) throw new NotFoundException("Wager not found");
    if (wager.status !== WagerStatus.LOCKED) throw new BadRequestException("Wager not locked");
    const isParticipant = wager.participants.some(p => p.userId === winnerUserId);
    if (!isParticipant) throw new BadRequestException("Winner is not a participant in this wager");
    const totalPot = wager.participants.reduce((sum, p) => sum + p.stakeTokens, 0);
    const rake = Math.floor(totalPot * 0.05);
    const payout = totalPot - rake;

    await this.prisma.$transaction(async (tx) => {
      await tx.wager.update({
        where: { id: wager.id },
        data: { status: WagerStatus.PAID_OUT, totalPotTokens: totalPot, rakeTokens: rake }
      });
      await tx.wallet.update({
        where: { userId: winnerUserId },
        data: {
          balanceTokens: { increment: payout },
          transactions: {
            create: {
              type: WalletTransactionType.WAGER_PAYOUT,
              amountTokens: payout,
              gameId: wager.gameId,
              metadata: { wagerId }
            }
          }
        }
      });
    });
    return { payoutTokens: payout };
  }

  async createTokenPackCheckout(userId: string, packId: string) {
    if (!this.stripe) {
      throw new BadRequestException("Stripe is not configured");
    }
    const tokens = this.packTokens[packId];
    if (!tokens) throw new BadRequestException("Invalid packId");
    const priceIds = this.configService.get<Record<string, string>>("stripe.tokenPackPriceIds");
    const priceId = (priceIds && priceIds[packId]) || this.configService.get<string>("stripe.tokenPackPriceId");
    if (!priceId) throw new BadRequestException("Stripe token pack price not configured");
    const successUrl = `${this.configService.get("urls.webBaseUrl")}/wallet?checkout=success`;
    const cancelUrl = `${this.configService.get("urls.webBaseUrl")}/wallet?checkout=cancel`;

    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId, packId }
    });
    return { checkoutUrl: session.url };
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!this.stripe) {
      throw new BadRequestException("Stripe is not configured");
    }
    const webhookSecret = this.configService.get<string>("stripe.webhookSecret");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET missing");
    if (!signature) throw new BadRequestException("Missing Stripe signature");

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      throw new BadRequestException("Invalid Stripe signature");
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.userId && session.metadata?.packId) {
        const tokens = this.packTokens[session.metadata.packId];
        if (!tokens) return { received: true };

        await this.prisma.$transaction(async (tx) => {
          const existing = await tx.walletTransaction.findFirst({
            where: {
              OR: [
                { metadata: { path: ["stripeEventId"], equals: event.id } },
                { metadata: { path: ["stripeSessionId"], equals: session.id } }
              ]
            }
          });
          if (existing) return;

          await tx.wallet.update({
            where: { userId: session.metadata!.userId! },
            data: {
              balanceTokens: { increment: tokens },
              transactions: {
                create: {
                  type: WalletTransactionType.PURCHASE,
                  amountTokens: tokens,
                  metadata: { 
                    stripeEventId: event.id, 
                    stripeSessionId: session.id,
                    packId: session.metadata!.packId 
                  }
                }
              }
            }
          });
        });
      }
    }

    return { received: true };
  }
}


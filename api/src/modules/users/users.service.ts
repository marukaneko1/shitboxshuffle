import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        username: true,
        avatarUrl: true,
        dateOfBirth: true,
        is18PlusVerified: true,
        kycStatus: true,
        level: true,
        xp: true,
        isBanned: true,
        banReason: true,
        latitude: true,
        longitude: true,
        subscription: true,
        wallet: {
          select: {
            id: true,
            balanceTokens: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    });
  }

  async getUserStats(userId: string) {
    const [matchesPlayed, gamesPlayed, gamesWon] = await Promise.all([
      // Unique sessions (matches) the user participated in
      this.prisma.session.count({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
          status: { in: ['CONNECTED', 'ENDED'] }
        }
      }),
      // Total individual games played
      this.prisma.gamePlayer.count({
        where: { userId }
      }),
      // Games won
      this.prisma.game.count({
        where: { winnerUserId: userId, status: 'COMPLETED' }
      })
    ]);

    const winRate = gamesPlayed > 0
      ? Math.round((gamesWon / gamesPlayed) * 100)
      : 0;

    return { matchesPlayed, gamesPlayed, gamesWon, winRate };
  }

  async updateLocation(userId: string, latitude: number, longitude: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { latitude, longitude },
      select: { id: true, latitude: true, longitude: true }
    });
  }
}



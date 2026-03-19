import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { KycStatus, SubscriptionStatus, ReportStatus } from "@prisma/client";

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllUsers(page = 1, limit = 50) {
    limit = Math.min(Math.max(1, limit), 200);
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
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
          isAdmin: true,
          latitude: true,
          longitude: true,
          createdAt: true,
          updatedAt: true,
          subscription: {
            select: {
              id: true,
              status: true,
              startedAt: true,
              currentPeriodEnd: true
            }
          },
          wallet: {
            select: {
              id: true,
              balanceTokens: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.user.count()
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
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
        isAdmin: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        updatedAt: true,
        subscription: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            currentPeriodEnd: true,
            stripeSubscriptionId: true
          }
        },
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

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  async verifyUser(userId: string, verified: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        is18PlusVerified: verified,
        kycStatus: verified ? KycStatus.VERIFIED : KycStatus.PENDING
      },
      select: {
        id: true,
        is18PlusVerified: true,
        kycStatus: true
      }
    });
  }

  async updateKycStatus(userId: string, status: KycStatus) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { kycStatus: status },
      select: {
        id: true,
        kycStatus: true
      }
    });
  }

  async banUser(userId: string, banReason: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: true,
        banReason
      },
      select: {
        id: true,
        isBanned: true,
        banReason: true
      }
    });
  }

  async unbanUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: false,
        banReason: null
      },
      select: {
        id: true,
        isBanned: true,
        banReason: true
      }
    });
  }

  async updateSubscriptionStatus(userId: string, status: SubscriptionStatus, currentPeriodEnd?: Date) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const subscriptionData: any = {
      status,
      updatedAt: new Date()
    };

    if (!user.subscription) {
      subscriptionData.userId = userId;
    }

    if (status === SubscriptionStatus.ACTIVE) {
      if (!user.subscription) {
        subscriptionData.startedAt = new Date();
        subscriptionData.currentPeriodEnd = currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      } else {
        subscriptionData.startedAt = user.subscription.startedAt || new Date();
        subscriptionData.currentPeriodEnd = currentPeriodEnd || user.subscription.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }
    }

    if (user.subscription) {
      return this.prisma.subscription.update({
        where: { id: user.subscription.id },
        data: subscriptionData,
        select: {
          id: true,
          status: true,
          startedAt: true,
          currentPeriodEnd: true
        }
      });
    } else {
      return this.prisma.subscription.create({
        data: subscriptionData,
        select: {
          id: true,
          status: true,
          startedAt: true,
          currentPeriodEnd: true
        }
      });
    }
  }

  // ==================== REPORTS ====================

  async getAllReports(page = 1, limit = 50, status?: ReportStatus) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};
    
    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          reasonCode: true,
          comment: true,
          status: true,
          createdAt: true,
          reporter: {
            select: {
              id: true,
              displayName: true,
              username: true,
              email: true
            }
          },
          reported: {
            select: {
              id: true,
              displayName: true,
              username: true,
              email: true,
              isBanned: true
            }
          },
          session: {
            select: {
              id: true,
              createdAt: true,
              status: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.report.count({ where })
    ]);

    return {
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getReportById(reportId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: {
        reporter: {
          select: {
            id: true,
            displayName: true,
            username: true,
            email: true
          }
        },
        reported: {
          select: {
            id: true,
            displayName: true,
            username: true,
            email: true,
            isBanned: true,
            banReason: true
          }
        },
        session: {
          select: {
            id: true,
            createdAt: true,
            endedAt: true,
            status: true,
            endReason: true
          }
        }
      }
    });

    if (!report) {
      throw new NotFoundException("Report not found");
    }

    return report;
  }

  async updateReportStatus(reportId: string, status: ReportStatus) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId }
    });

    if (!report) {
      throw new NotFoundException("Report not found");
    }

    return this.prisma.report.update({
      where: { id: reportId },
      data: { status },
      select: {
        id: true,
        status: true
      }
    });
  }

  async resolveReportAndBan(reportId: string, banReason: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId }
    });

    if (!report) {
      throw new NotFoundException("Report not found");
    }

    // Update report status and ban the reported user
    await this.prisma.$transaction([
      this.prisma.report.update({
        where: { id: reportId },
        data: { status: ReportStatus.ACTIONED }
      }),
      this.prisma.user.update({
        where: { id: report.reportedUserId },
        data: {
          isBanned: true,
          banReason
        }
      })
    ]);

    return { success: true, message: "Report resolved and user banned" };
  }

  async dismissReport(reportId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId }
    });

    if (!report) {
      throw new NotFoundException("Report not found");
    }

    return this.prisma.report.update({
      where: { id: reportId },
      data: { status: ReportStatus.REVIEWED },
      select: {
        id: true,
        status: true
      }
    });
  }
}

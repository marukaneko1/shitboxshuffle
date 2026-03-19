import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SessionStatus, SessionEndReason } from "@prisma/client";

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(userAId: string, userBId: string, videoChannelName: string) {
    return this.prisma.session.create({
      data: {
        userAId,
        userBId,
        videoChannelName,
        status: SessionStatus.CONNECTED,
        startedAt: new Date()
      }
    });
  }

  async getSession(sessionId: string) {
    return this.prisma.session.findUnique({
      where: { id: sessionId }
    });
  }

  async endSession(sessionId: string, userId: string, reason: SessionEndReason) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId }
    });
    if (!session) {
      throw new NotFoundException("Session not found");
    }
    if (session.userAId !== userId && session.userBId !== userId) {
      throw new ForbiddenException("Not a participant in this session");
    }
    if (session.status === SessionStatus.ENDED) {
      return session;
    }
    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.ENDED,
        endReason: reason,
        endedAt: new Date()
      }
    });
  }
}



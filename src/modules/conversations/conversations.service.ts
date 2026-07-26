import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Conversation, Customer, Message } from '@prisma/client';

export type MessageRole = 'user' | 'assistant' | 'system';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca o crea el cliente por número de WhatsApp. El wa_id viene sin '+',
   * se normaliza a formato E.164 para que coincida con datos cargados a mano.
   */
  async upsertCustomerByPhone(
    waId: string,
    profileName?: string,
  ): Promise<Customer> {
    const phone = ConversationsService.normalizePhone(waId);

    const existing = await this.prisma.customer.findUnique({
      where: { phone },
    });
    if (existing) {
      // Sólo se actualiza el nombre si aún es el placeholder.
      if (profileName && existing.name !== profileName) {
        return this.prisma.customer.update({
          where: { id: existing.id },
          data: { name: profileName },
        });
      }
      return existing;
    }

    return this.prisma.customer.create({
      data: { name: profileName ?? phone, phone },
    });
  }

  /** Reutiliza la conversación abierta del cliente, o abre una nueva. */
  async getOrCreateOpenConversation(
    customerId: string,
    channel = 'whatsapp',
  ): Promise<Conversation> {
    const open = await this.prisma.conversation.findFirst({
      where: { customerId, channel, status: 'open' },
      orderBy: { createdAt: 'desc' },
    });
    if (open) return open;

    return this.prisma.conversation.create({
      data: { customerId, channel, status: 'open' },
    });
  }

  async addMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
    waMessageId?: string,
  ): Promise<Message> {
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId, role, content, waMessageId },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      }),
    ]);
    return message;
  }

  /**
   * Meta reintenta el webhook si no recibe 200 rápido, y puede duplicar entregas.
   * El wamid es único, así que sirve de candado de idempotencia.
   */
  async isDuplicate(waMessageId: string): Promise<boolean> {
    const found = await this.prisma.message.findUnique({
      where: { waMessageId },
      select: { id: true },
    });
    return found !== null;
  }

  /** Historial reciente en orden cronológico, para dar contexto al agente. */
  async getRecentHistory(
    conversationId: string,
    take = 10,
  ): Promise<Message[]> {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return messages.reverse();
  }

  async closeConversation(conversationId: string): Promise<Conversation> {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'closed' },
    });
  }

  /** Marca la conversación para que la atienda una persona. */
  async escalate(conversationId: string): Promise<Conversation> {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'needs_human' },
    });
  }

  static normalizePhone(waId: string): string {
    const digits = waId.replace(/\D/g, '');
    return `+${digits}`;
  }
}

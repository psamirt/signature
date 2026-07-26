import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { whatsappConfig } from '../../config/whatsapp.config';
import { AgentService } from '../agent/agent.service';
import { ConversationsService } from '../conversations/conversations.service';
import { WhatsappApiService } from './whatsapp-api.service';
import type {
  WhatsappChangeValue,
  WhatsappIncomingMessage,
  WhatsappStatus,
  WhatsappWebhookPayload,
} from './dto/webhook.types';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly api: WhatsappApiService,
    private readonly agent: AgentService,
    private readonly conversations: ConversationsService,
  ) {}

  /**
   * Diagnóstico sin exponer secretos: dice qué variables faltan por nombre.
   * Útil en Render, donde no puedes leer el .env desde fuera.
   */
  getHealth() {
    const missing = Object.entries({
      WHATSAPP_PHONE_NUMBER_ID: whatsappConfig.phoneNumberId,
      WHATSAPP_BUSINESS_ACCOUNT_ID: whatsappConfig.businessAccountId,
      WHATSAPP_ACCESS_TOKEN: whatsappConfig.accessToken,
      WHATSAPP_VERIFY_TOKEN: whatsappConfig.verifyToken,
      WHATSAPP_APP_SECRET: whatsappConfig.appSecret,
    })
      .filter(([, value]) => !value)
      .map(([key]) => key);

    return {
      status: missing.length ? 'incompleto' : 'ok',
      service: 'whatsapp-webhook',
      ready: missing.length === 0,
      missing,
      graphVersion: whatsappConfig.graphVersion,
      phoneNumberId: whatsappConfig.phoneNumberId
        ? `…${whatsappConfig.phoneNumberId.slice(-4)}`
        : null,
      signatureCheck: whatsappConfig.verifySignature,
    };
  }

  /**
   * Handshake del webhook. Meta hace un GET con estos tres parámetros cuando
   * pulsas "Verificar y guardar" y espera el challenge como texto plano.
   */
  verifyWebhook(
    mode?: string,
    token?: string,
    challenge?: string,
  ): string | null {
    if (mode === 'subscribe' && token && token === whatsappConfig.verifyToken) {
      this.logger.log('Webhook verificado por Meta.');
      return challenge ?? '';
    }
    this.logger.warn(
      `Verificación de webhook rechazada (mode=${mode ?? 'none'}).`,
    );
    return null;
  }

  /**
   * Valida la cabecera X-Hub-Signature-256: HMAC-SHA256 del cuerpo CRUDO con el
   * App Secret. Debe usarse el buffer sin parsear; re-serializar el JSON cambia
   * los bytes y la firma nunca coincide.
   */
  isValidSignature(rawBody: Buffer | undefined, header?: string): boolean {
    if (!whatsappConfig.verifySignature) return true;

    if (!whatsappConfig.appSecret) {
      this.logger.warn(
        'WHATSAPP_APP_SECRET vacío: no se puede validar la firma. Configúralo antes de producción.',
      );
      return false;
    }
    if (!rawBody || !header?.startsWith('sha256=')) return false;

    const expected = createHmac('sha256', whatsappConfig.appSecret)
      .update(rawBody)
      .digest('hex');
    const received = header.slice('sha256='.length);

    if (received.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  }

  /**
   * Procesa el payload. Se llama DESPUÉS de responder 200 a Meta: si el bot
   * tarda más de ~5 s en contestar, Meta reintenta y el cliente recibe duplicados.
   */
  async processWebhook(payload: WhatsappWebhookPayload): Promise<void> {
    if (payload.object !== 'whatsapp_business_account') {
      this.logger.debug(`Objeto de webhook ignorado: ${payload.object}`);
      return;
    }

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') {
          this.logger.debug(`Campo de webhook ignorado: ${change.field}`);
          continue;
        }
        await this.handleChangeValue(change.value);
      }
    }
  }

  private async handleChangeValue(value: WhatsappChangeValue): Promise<void> {
    for (const status of value.statuses ?? []) {
      this.logStatus(status);
    }

    for (const message of value.messages ?? []) {
      try {
        await this.handleIncomingMessage(message, value);
      } catch (error) {
        this.logger.error(
          `Error procesando ${message.id}: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }
  }

  private async handleIncomingMessage(
    message: WhatsappIncomingMessage,
    value: WhatsappChangeValue,
  ): Promise<void> {
    if (await this.conversations.isDuplicate(message.id)) {
      this.logger.debug(`Mensaje duplicado descartado: ${message.id}`);
      return;
    }

    const text = WhatsappService.extractText(message);
    const profileName = value.contacts?.find((c) => c.wa_id === message.from)
      ?.profile?.name;

    const customer = await this.conversations.upsertCustomerByPhone(
      message.from,
      profileName,
    );
    const conversation = await this.conversations.getOrCreateOpenConversation(
      customer.id,
    );

    await this.conversations.addMessage(
      conversation.id,
      'user',
      text ?? `[mensaje de tipo ${message.type} no soportado]`,
      message.id,
    );

    await this.api.markAsRead(message.id);

    if (!text) {
      await this.reply(
        conversation.id,
        message.from,
        'Por ahora sólo puedo leer mensajes de texto. ¿Me lo escribes, por favor?',
      );
      return;
    }

    const history = await this.conversations.getRecentHistory(conversation.id);
    const result = await this.agent.handleMessage(text, {
      history,
      customerName: customer.name,
    });

    if (result.escalate) {
      await this.conversations.escalate(conversation.id);
    }

    await this.reply(conversation.id, message.from, result.reply);
  }

  private async reply(
    conversationId: string,
    to: string,
    body: string,
  ): Promise<void> {
    const sent = await this.api.sendText(to, body);
    await this.conversations.addMessage(
      conversationId,
      'assistant',
      body,
      sent?.messages?.[0]?.id,
    );
  }

  private logStatus(status: WhatsappStatus): void {
    if (status.status === 'failed') {
      this.logger.warn(
        `Envío fallido ${status.id} → ${status.recipient_id}: ${JSON.stringify(status.errors ?? [])}`,
      );
      return;
    }
    this.logger.debug(`Estado ${status.status} para ${status.id}`);
  }

  /** Extrae texto de mensajes de texto, botones y listas interactivas. */
  private static extractText(message: WhatsappIncomingMessage): string | null {
    if (message.type === 'text') return message.text?.body?.trim() || null;
    if (message.type === 'button') return message.button?.text?.trim() || null;
    if (message.type === 'interactive') {
      const reply =
        message.interactive?.button_reply ?? message.interactive?.list_reply;
      return reply?.title?.trim() || reply?.id || null;
    }
    return null;
  }
}

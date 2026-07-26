import { Injectable, Logger } from '@nestjs/common';
import { whatsappConfig } from '../../config/whatsapp.config';
import type { WhatsappSendResponse } from './dto/webhook.types';

/**
 * Cliente HTTP hacia el Graph API de Meta. Equivale al curl que muestra
 * el Paso 1 del panel, pero con manejo de errores y logging.
 */
@Injectable()
export class WhatsappApiService {
  private readonly logger = new Logger(WhatsappApiService.name);

  async sendText(
    to: string,
    body: string,
    previewUrl = false,
  ): Promise<WhatsappSendResponse | null> {
    return this.post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: previewUrl, body: this.truncate(body, 4096) },
    });
  }

  /**
   * Plantilla aprobada. Es la ÚNICA forma de iniciar una conversación fuera de
   * la ventana de 24 h de atención al cliente.
   */
  async sendTemplate(
    to: string,
    templateName: string,
    languageCode = 'es',
    bodyParameters: string[] = [],
  ): Promise<WhatsappSendResponse | null> {
    return this.post({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(bodyParameters.length
          ? {
              components: [
                {
                  type: 'body',
                  parameters: bodyParameters.map((text) => ({
                    type: 'text',
                    text,
                  })),
                },
              ],
            }
          : {}),
      },
    });
  }

  /** Botones de respuesta rápida (máx. 3, títulos de máx. 20 caracteres). */
  async sendButtons(
    to: string,
    body: string,
    buttons: { id: string; title: string }[],
  ): Promise<WhatsappSendResponse | null> {
    return this.post({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: this.truncate(body, 1024) },
        action: {
          buttons: buttons.slice(0, 3).map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: this.truncate(b.title, 20) },
          })),
        },
      },
    });
  }

  /** Marca el mensaje como leído (los dos checks azules en el chat del cliente). */
  async markAsRead(messageId: string): Promise<void> {
    await this.post({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  }

  /**
   * Registra el número en la Cloud API. Es el paso que falta cuando el panel
   * muestra "No registrado": verificar la propiedad del número no lo registra.
   * El PIN son 6 dígitos que tú eliges (o el de la verificación en dos pasos si
   * ya lo tenías). Máx. 10 intentos por número cada 72 h (error 133016).
   */
  async registerPhoneNumber(pin: string): Promise<{
    ok: boolean;
    status: number;
    body: unknown;
  }> {
    return this.rawPost(
      `${whatsappConfig.graphUrl}/${whatsappConfig.phoneNumberId}/register`,
      { messaging_product: 'whatsapp', pin },
    );
  }

  /**
   * Suscribe esta app a la WABA para que Meta le entregue los webhooks.
   * Equivale al botón "Suscribir webhooks" del Paso 2. Es independiente de
   * configurar la URL de devolución de llamada: hacen falta las dos cosas.
   */
  async subscribeApp(): Promise<{
    ok: boolean;
    status: number;
    body: unknown;
  }> {
    return this.rawPost(
      `${whatsappConfig.graphUrl}/${whatsappConfig.businessAccountId}/subscribed_apps`,
      {},
    );
  }

  /** Diagnóstico: estado de verificación y registro del número. */
  async getPhoneNumberStatus(): Promise<unknown> {
    const url =
      `${whatsappConfig.graphUrl}/${whatsappConfig.phoneNumberId}` +
      '?fields=display_phone_number,verified_name,code_verification_status,platform_type,quality_rating,status';

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${whatsappConfig.accessToken}` },
      });
      return await response.json();
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  private async rawPost(
    url: string,
    payload: Record<string, unknown>,
  ): Promise<{ ok: boolean; status: number; body: unknown }> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${whatsappConfig.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      if (!response.ok) {
        this.logger.error(`${url} → ${response.status}: ${text.slice(0, 800)}`);
      }

      return {
        ok: response.ok,
        status: response.status,
        body: JSON.parse(text || '{}') as unknown,
      };
    } catch (error) {
      this.logger.error(`Error de red en ${url}: ${(error as Error).message}`);
      return {
        ok: false,
        status: 0,
        body: { error: (error as Error).message },
      };
    }
  }

  private async post(
    payload: Record<string, unknown>,
  ): Promise<WhatsappSendResponse | null> {
    if (!whatsappConfig.isConfigured) {
      this.logger.warn(
        'WhatsApp no configurado (falta WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN). Payload no enviado.',
      );
      return null;
    }

    try {
      const response = await fetch(whatsappConfig.messagesUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${whatsappConfig.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();

      if (!response.ok) {
        // Errores típicos: 190 token expirado, 131030 número no en la lista de
        // destinatarios permitidos, 131047 fuera de la ventana de 24 h.
        this.logger.error(
          `Graph API ${response.status}: ${text.slice(0, 800)}`,
        );
        return null;
      }

      return JSON.parse(text) as WhatsappSendResponse;
    } catch (error) {
      this.logger.error(
        `Error de red al llamar al Graph API: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private truncate(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  }
}

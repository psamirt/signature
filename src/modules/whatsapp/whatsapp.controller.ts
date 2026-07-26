import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { WhatsappService } from './whatsapp.service';
import { WhatsappApiService } from './whatsapp-api.service';
import type { WhatsappWebhookPayload } from './dto/webhook.types';
import {
  RegisterPhoneNumberDto,
  SendWhatsappMessageDto,
} from './dto/send-message.dto';

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly api: WhatsappApiService,
  ) {}

  @Get('health')
  getHealth() {
    return this.whatsappService.getHealth();
  }

  /**
   * Handshake de verificación. Meta espera el challenge como texto plano.
   * URL a pegar en el panel: https://<tu-dominio>/whatsapp/webhook
   */
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    const result = this.whatsappService.verifyWebhook(mode, token, challenge);
    if (result === null) {
      throw new ForbiddenException('Verificación de webhook fallida');
    }
    return result;
  }

  /**
   * Recepción de eventos. Se responde 200 de inmediato y el procesamiento sigue
   * en background: Meta corta a los ~5 s y reintenta, generando duplicados.
   */
  @Post('webhook')
  @HttpCode(200)
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: WhatsappWebhookPayload,
    @Headers('x-hub-signature-256') signature?: string,
  ): { received: true } {
    if (!this.whatsappService.isValidSignature(req.rawBody, signature)) {
      // 200 a propósito: un 4xx hace que Meta reintente y acabe deshabilitando
      // el webhook. Se descarta el evento y se registra.
      this.logger.warn('Webhook con firma inválida descartado.');
      return { received: true };
    }

    void this.whatsappService.processWebhook(payload).catch((error: Error) => {
      this.logger.error(
        `Fallo procesando webhook: ${error.message}`,
        error.stack,
      );
    });

    return { received: true };
  }

  /** Estado real del número según Meta: verificado, registrado, calidad. */
  @Get('status')
  status() {
    return this.api.getPhoneNumberStatus();
  }

  /**
   * Registra el número en la Cloud API (el paso que falta cuando el panel dice
   * "No registrado"). Body: { "pin": "123456" }
   */
  @Post('register')
  register(@Body() body: RegisterPhoneNumberDto) {
    return this.api.registerPhoneNumber(body.pin);
  }

  /** Suscribe la app a la WABA. Equivale a "Suscribir webhooks" del panel. */
  @Post('subscribe')
  subscribe() {
    return this.api.subscribeApp();
  }

  /** Envío manual, para probar sin esperar a que el cliente escriba primero. */
  @Post('send')
  async send(@Body() body: SendWhatsappMessageDto) {
    const result = body.template
      ? await this.api.sendTemplate(body.to, body.template, body.language)
      : await this.api.sendText(body.to, body.message ?? '');

    return { ok: result !== null, result };
  }
}

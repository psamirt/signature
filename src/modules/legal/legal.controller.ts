import { Controller, Get, Header } from '@nestjs/common';
import { LegalService } from './legal.service';

/**
 * Meta exige una URL de política de privacidad pública para poder publicar la
 * app (sin ella el switch de modo Live no se activa). Se sirve desde la propia
 * API para no depender de un sitio aparte.
 */
@Controller()
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get('privacy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  privacy(): string {
    return this.legalService.privacyPolicyHtml();
  }

  @Get('terms')
  @Header('Content-Type', 'text/html; charset=utf-8')
  terms(): string {
    return this.legalService.termsHtml();
  }
}

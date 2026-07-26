import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class RegisterPhoneNumberDto {
  /** 6 dígitos que tú eliges, o el PIN de verificación en dos pasos si ya existe. */
  @IsString()
  @Matches(/^\d{6}$/, { message: 'pin debe ser exactamente 6 dígitos' })
  pin: string;
}

export class SendWhatsappMessageDto {
  /** Número destino en E.164, con o sin '+' (ej. +51982254431). */
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: 'to debe ser un número en formato E.164, ej. +51982254431',
  })
  to: string;

  /** Texto libre. Sólo funciona dentro de la ventana de 24 h. */
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  message?: string;

  /** Nombre de una plantilla aprobada (ej. hello_world). Tiene prioridad sobre message. */
  @IsOptional()
  @IsString()
  template?: string;

  /** Código de idioma de la plantilla (ej. es, es_ES, en_US). */
  @IsOptional()
  @IsString()
  language?: string;
}

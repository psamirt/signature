/**
 * Tipos del payload que Meta envía al webhook.
 * Referencia: developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
 *
 * No se usan clases con class-validator a propósito: el ValidationPipe global tiene
 * forbidNonWhitelisted y Meta agrega campos nuevos sin avisar. Rechazar el payload
 * haría que Meta reintente y termine deshabilitando el webhook.
 */

export interface WhatsappTextMessage {
  body: string;
}

export interface WhatsappInteractiveReply {
  id: string;
  title: string;
  description?: string;
}

export interface WhatsappIncomingMessage {
  /** Número del cliente en formato wa_id (sin '+'), ej. 51982254431 */
  from: string;
  /** ID único del mensaje (wamid.*). Sirve para deduplicar reintentos. */
  id: string;
  timestamp: string;
  type:
    | 'text'
    | 'image'
    | 'audio'
    | 'video'
    | 'document'
    | 'sticker'
    | 'location'
    | 'contacts'
    | 'interactive'
    | 'button'
    | 'reaction'
    | 'order'
    | 'system'
    | 'unsupported';
  text?: WhatsappTextMessage;
  button?: { text?: string; payload?: string };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: WhatsappInteractiveReply;
    list_reply?: WhatsappInteractiveReply;
  };
  errors?: { code: number; title: string; message?: string }[];
}

export interface WhatsappContact {
  profile?: { name?: string };
  wa_id: string;
}

export interface WhatsappStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: { code: number; title: string; message?: string }[];
}

export interface WhatsappChangeValue {
  messaging_product: 'whatsapp';
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  contacts?: WhatsappContact[];
  messages?: WhatsappIncomingMessage[];
  statuses?: WhatsappStatus[];
}

export interface WhatsappChange {
  field: string;
  value: WhatsappChangeValue;
}

export interface WhatsappWebhookPayload {
  object?: string;
  entry?: {
    id: string;
    changes?: WhatsappChange[];
  }[];
}

/** Respuesta de POST /{phone-number-id}/messages */
export interface WhatsappSendResponse {
  messaging_product: string;
  contacts?: { input: string; wa_id: string }[];
  messages?: { id: string; message_status?: string }[];
}

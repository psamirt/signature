export const whatsappConfig = {
  /** Versión del Graph API. La interfaz nueva de Meta muestra v25.0 en el curl de ejemplo. */
  graphVersion: process.env.WHATSAPP_GRAPH_VERSION ?? 'v25.0',

  /** "Phone Number ID" del panel (NO el número de teléfono). Es el que va en la URL. */
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',

  /** "WhatsApp Business Account ID" (WABA). Se usa para plantillas, no para enviar. */
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? '',

  /** Token de acceso. El del Paso 1 es temporal (24 h); en producción usa uno de usuario del sistema. */
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',

  /** Cadena que tú inventas y pegas en "Token de verificación" al configurar el webhook. */
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? '',

  /** App Secret (Configuración de la app > Básica). Valida la firma X-Hub-Signature-256. */
  appSecret: process.env.WHATSAPP_APP_SECRET ?? '',

  /** Si es false, se aceptan webhooks sin firma válida (útil sólo en local). */
  get verifySignature(): boolean {
    return process.env.WHATSAPP_VERIFY_SIGNATURE !== 'false';
  },

  get graphUrl(): string {
    return `https://graph.facebook.com/${whatsappConfig.graphVersion}`;
  },

  get messagesUrl(): string {
    return `${whatsappConfig.graphUrl}/${whatsappConfig.phoneNumberId}/messages`;
  },

  get isConfigured(): boolean {
    return Boolean(whatsappConfig.phoneNumberId && whatsappConfig.accessToken);
  },
};

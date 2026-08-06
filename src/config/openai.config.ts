export const openaiConfig = {
  /** Clave de tu cuenta de OpenAI (platform.openai.com > API keys). */
  apiKey: process.env.OPENAI_API_KEY ?? '',

  /** Modelo a usar. gpt-4o-mini es barato y suficiente para atención al cliente. */
  model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',

  /** Endpoint de chat. Se deja configurable por si usas un proxy compatible. */
  baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',

  /** Creatividad. Bajo = respuestas más consistentes y pegadas al catálogo. */
  temperature: Number(process.env.OPENAI_TEMPERATURE ?? 0.4),

  /** Tope de tokens de la respuesta. Un mensaje de WhatsApp no necesita más. */
  maxTokens: Number(process.env.OPENAI_MAX_TOKENS ?? 500),

  get isConfigured(): boolean {
    return Boolean(openaiConfig.apiKey);
  },
};

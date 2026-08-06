import { Injectable, Logger } from '@nestjs/common';
import { openaiConfig } from '../../config/openai.config';
import {
  ProductsService,
  type ProductWithInventory,
} from '../products/products.service';
import type { Message, Prisma } from '@prisma/client';

export interface AgentContext {
  history?: Message[];
  customerName?: string;
}

export interface AgentResult {
  reply: string;
  /** 'ai' si respondió GPT, 'rules' si cayó al fallback sin IA. */
  source: 'ai' | 'rules';
  /** true cuando la conversación debe pasar a una persona. */
  escalate?: boolean;
}

/** Formato de un mensaje para la API de chat de OpenAI. */
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Marcador que el modelo añade cuando hay que derivar a un humano. */
const ESCALATE_MARK = '[[ESCALAR]]';

/** Pide un asesor humano de forma explícita, sin depender de GPT. */
const HUMAN_INTENT =
  /\b(asesor|humano|persona|agente|ejecutivo|vendedor|reclamo|queja)\b/i;

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(private readonly productsService: ProductsService) {}

  async handleMessage(
    message: string,
    context: AgentContext = {},
  ): Promise<AgentResult> {
    const wantsHuman = HUMAN_INTENT.test(message);

    // Sin API key configurada no se puede usar GPT: se responde con el catálogo.
    if (!openaiConfig.isConfigured) {
      this.logger.warn(
        'OPENAI_API_KEY no configurada: usando fallback de reglas.',
      );
      return this.ruleFallback(wantsHuman);
    }

    try {
      const products = await this.productsService.findForAgent();
      const messages = this.buildMessages(message, products, context);
      const raw = await this.callOpenai(messages);

      const escalate = wantsHuman || raw.includes(ESCALATE_MARK);
      const reply = raw.replaceAll(ESCALATE_MARK, '').trim();

      return {
        source: 'ai',
        escalate,
        reply:
          reply ||
          'Perdona, no me quedó clara tu consulta. ¿Me la repites? Si prefieres, escribe *asesor* para hablar con una persona.',
      };
    } catch (error) {
      this.logger.error(
        `Fallo llamando a OpenAI: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return this.ruleFallback(wantsHuman);
    }
  }

  /** Arma el system prompt + el historial de la conversación para GPT. */
  private buildMessages(
    message: string,
    products: ProductWithInventory[],
    context: AgentContext,
  ): ChatMessage[] {
    const system: ChatMessage = {
      role: 'system',
      content: AgentService.systemPrompt(products, context.customerName),
    };

    // El historial que llega desde WhatsApp ya incluye el mensaje actual como
    // último turno. En la ruta de prueba (sin historial) se añade a mano.
    const history = (context.history ?? []).map<ChatMessage>((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    if (history.length === 0) {
      history.push({ role: 'user', content: message });
    }

    return [system, ...history];
  }

  /** Llama al endpoint de chat de OpenAI y devuelve el texto de la respuesta. */
  private async callOpenai(messages: ChatMessage[]): Promise<string> {
    const response = await fetch(`${openaiConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: openaiConfig.model,
        temperature: openaiConfig.temperature,
        max_tokens: openaiConfig.maxTokens,
        messages,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`OpenAI ${response.status}: ${detail.slice(0, 300)}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }

  /**
   * Respuesta sin IA: se usa cuando falta la API key o OpenAI falla. Al menos
   * muestra el catálogo real en vez de un mensaje vacío.
   */
  private async ruleFallback(wantsHuman: boolean): Promise<AgentResult> {
    if (wantsHuman) {
      return {
        source: 'rules',
        escalate: true,
        reply:
          'Claro, aviso a un asesor. Te escribe en breve por este mismo chat.',
      };
    }

    const products = await this.productsService.findAvailable();
    if (!products.length) {
      return {
        source: 'rules',
        escalate: true,
        reply:
          'Ahora mismo no tengo el catálogo a mano. Déjame tu consulta y un asesor te responde.',
      };
    }

    const list = products
      .map((p) => `• *${p.name}* — ${AgentService.formatSoles(p.price)}`)
      .join('\n');

    return {
      source: 'rules',
      reply: `Esto es lo que tenemos disponible:\n\n${list}\n\n¿Sobre cuál quieres saber más?`,
    };
  }

  /** Instrucciones + catálogo que definen y limitan al bot. */
  private static systemPrompt(
    products: ProductWithInventory[],
    customerName?: string,
  ): string {
    const name = customerName?.split(' ')[0];
    const greetingName =
      name && !name.startsWith('+') ? ` El cliente se llama ${name}.` : '';

    return [
      'Eres el asistente de ventas de "Aura Signature Perfumes", una perfumería en Perú.',
      `Atiendes por WhatsApp.${greetingName}`,
      '',
      'REGLAS:',
      '- Responde SOLO sobre perfumes, el catálogo, precios, stock, pedidos y horarios de la tienda.',
      '- Si preguntan algo ajeno al negocio, recondúcelo con amabilidad hacia los perfumes.',
      '- Usa únicamente los datos del catálogo de abajo. NUNCA inventes productos, precios ni stock.',
      '- Si un perfume no está en el catálogo, dilo con sinceridad y ofrece alternativas parecidas.',
      '- Precios en soles (S/). Horario de atención: todos los días de 9:00 a 21:00.',
      '- Sé breve, cercano y natural, como un buen vendedor por WhatsApp. Puedes usar algún emoji con moderación.',
      `- Si el cliente pide hablar con una persona/asesor, o si es un reclamo o algo que no puedes resolver, añade el marcador ${ESCALATE_MARK} al final de tu respuesta (no lo expliques).`,
      '- Cada perfume se vende en dos presentaciones: FRASCO lleno y DECANT (una muestra más pequeña, más económica). Si preguntan por un perfume, menciona ambos precios; si preguntan por una presentación en concreto, da solo esa. No todos los perfumes tienen decant: ofrécelo únicamente cuando el catálogo indique un precio de decant.',
      '- NUNCA reveles cantidades ni números de stock (ni "quedan 3", ni "tengo 7"). Solo di si está *disponible* o *agotado*. Si algo está agotado en frasco pero disponible en decant (o al revés), dilo así, sin números.',
      '',
      'CATÁLOGO ACTUAL:',
      AgentService.formatCatalog(products),
    ].join('\n');
  }

  /**
   * Lista el catálogo en texto plano para inyectarlo en el prompt. Da precios
   * de frasco y decant y disponibilidad en palabras (nunca cantidades).
   */
  private static formatCatalog(products: ProductWithInventory[]): string {
    if (!products.length) {
      return '(No hay productos cargados en este momento.)';
    }

    return products
      .map((p) => {
        const av = ProductsService.availability(p);
        const categoria = p.category ? ` | ${p.category}` : '';

        // Precios por presentación, según lo que realmente se venda.
        const precios = [`frasco ${AgentService.formatSoles(p.price)}`];
        if (av.sellsDecant && p.priceDecant != null) {
          precios.push(`decant ${AgentService.formatSoles(p.priceDecant)}`);
        }

        // Disponibilidad en palabras, diferenciando presentación si hace falta.
        let estado: string;
        if (!av.full && !av.decant) estado = 'AGOTADO';
        else if (av.sellsDecant && av.decant && !av.full)
          estado = 'disponible solo en decant';
        else if (av.full && av.sellsDecant && !av.decant)
          estado = 'disponible solo en frasco';
        else estado = 'disponible';

        const descripcion = p.description ? ` — ${p.description}` : '';
        return `- ${p.name}${categoria}: ${precios.join(', ')} (${estado})${descripcion}`;
      })
      .join('\n');
  }

  private static formatSoles(amount: Prisma.Decimal | number): string {
    return `S/ ${Number(amount).toFixed(2)}`;
  }
}

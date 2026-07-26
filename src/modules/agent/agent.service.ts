import { Injectable, Logger } from '@nestjs/common';
import {
  ProductsService,
  type ProductWithInventory,
} from '../products/products.service';
import type { Message } from '@prisma/client';

export type AgentIntent =
  | 'greeting'
  | 'catalog'
  | 'stock'
  | 'price'
  | 'hours'
  | 'human'
  | 'thanks'
  | 'unknown';

export interface AgentContext {
  history?: Message[];
  customerName?: string;
}

export interface AgentResult {
  reply: string;
  intent: AgentIntent;
  /** true cuando la conversación debe pasar a una persona. */
  escalate?: boolean;
  products?: ProductWithInventory[];
  product?: ProductWithInventory | null;
}

/** Palabras que no aportan nada al buscar un producto en la frase del cliente. */
const STOP_WORDS = new Set([
  'hola',
  'buenas',
  'quiero',
  'quisiera',
  'saber',
  'tienen',
  'tienes',
  'hay',
  'cuanto',
  'cuesta',
  'cuestan',
  'vale',
  'precio',
  'precios',
  'stock',
  'disponible',
  'disponibles',
  'para',
  'porfa',
  'favor',
  'gracias',
  'del',
  'las',
  'los',
  'una',
  'uno',
  'que',
  'con',
  'por',
  'sobre',
  'perfume',
  'perfumes',
  'catalogo',
  'lista',
  'productos',
]);

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(private readonly productsService: ProductsService) {}

  async handleMessage(
    message: string,
    context: AgentContext = {},
  ): Promise<AgentResult> {
    const intent = AgentService.detectIntent(message);
    this.logger.debug(`intent=${intent} :: "${message.slice(0, 80)}"`);

    switch (intent) {
      case 'greeting':
        return {
          intent,
          reply: AgentService.greeting(
            context,
            AgentService.isFirstMessage(context),
          ),
        };

      case 'catalog':
        return this.catalog(intent);

      case 'stock':
        return this.stock(intent, message);

      case 'price':
        return this.price(intent, message);

      case 'hours':
        return {
          intent,
          reply:
            'Atendemos por WhatsApp todos los días de 9:00 a 21:00. Fuera de ese horario te respondo yo y un asesor retoma al día siguiente.',
        };

      case 'human':
        return {
          intent,
          escalate: true,
          reply:
            'Claro, aviso a un asesor. Te escribe en breve por este mismo chat. ¿Quieres dejarle algo anotado?',
        };

      case 'thanks':
        return {
          intent,
          reply: '¡Con gusto! Si necesitas algo más, escríbeme por aquí.',
        };

      default:
        return this.fallback(intent, message);
    }
  }

  private async catalog(intent: AgentIntent): Promise<AgentResult> {
    const products = await this.productsService.findAvailable();

    if (!products.length) {
      return {
        intent,
        products,
        escalate: true,
        reply:
          'Justo ahora no tengo productos disponibles cargados. Déjame tu consulta y un asesor te confirma existencias.',
      };
    }

    const list = products
      .map((p) => `• *${p.name}* — ${AgentService.formatPrice(p)}`)
      .join('\n');

    return {
      intent,
      products,
      reply: `Esto es lo que tenemos disponible:\n\n${list}\n\n¿Sobre cuál quieres saber más?`,
    };
  }

  private async stock(
    intent: AgentIntent,
    message: string,
  ): Promise<AgentResult> {
    const term = AgentService.extractSearchTerm(message);
    const products = term ? await this.productsService.search(term) : [];

    // Sin producto identificable, se muestra el catálogo completo.
    if (!products.length) {
      const result = await this.catalog(intent);
      return { ...result, intent };
    }

    const lines = products.map((p) => {
      const stock = p.inventory?.stock ?? 0;
      return stock > 0
        ? `• *${p.name}*: ${stock} ${stock === 1 ? 'unidad' : 'unidades'} — ${AgentService.formatPrice(p)}`
        : `• *${p.name}*: agotado por ahora`;
    });

    return {
      intent,
      products,
      product: products[0],
      reply: `${lines.join('\n')}\n\n¿Te reservo alguno?`,
    };
  }

  private async price(
    intent: AgentIntent,
    message: string,
  ): Promise<AgentResult> {
    const term = AgentService.extractSearchTerm(message);
    const products = term ? await this.productsService.search(term) : [];

    if (!products.length) {
      return {
        intent,
        products,
        reply: term
          ? `No encontré "${term}" en el catálogo. ¿Me confirmas el nombre? También puedes escribir *catálogo* para ver todo.`
          : '¿De qué perfume quieres el precio? Escribe *catálogo* si quieres ver la lista completa.',
      };
    }

    if (products.length === 1) {
      const product = products[0];
      const stock = product.inventory?.stock ?? 0;
      return {
        intent,
        products,
        product,
        reply:
          `*${product.name}* cuesta ${AgentService.formatPrice(product)}.` +
          (stock > 0
            ? ` Tenemos ${stock} en stock. ¿Te lo aparto?`
            : ' Ahora está agotado, ¿quieres que te avise cuando llegue?'),
      };
    }

    const list = products
      .map((p) => `• *${p.name}* — ${AgentService.formatPrice(p)}`)
      .join('\n');

    return {
      intent,
      products,
      product: products[0],
      reply: `Encontré varios que coinciden con "${term}":\n\n${list}\n\n¿Cuál te interesa?`,
    };
  }

  private async fallback(
    intent: AgentIntent,
    message: string,
  ): Promise<AgentResult> {
    // Antes de rendirse, se interpreta el mensaje como posible nombre de producto.
    const term = AgentService.extractSearchTerm(message);
    if (term.length >= 3) {
      const products = await this.productsService.search(term);
      if (products.length) return this.price('price', message);
    }

    return {
      intent,
      reply:
        'No estoy seguro de haber entendido. Puedo ayudarte con *catálogo*, *precio* o *stock*, ' +
        'o escribe *asesor* si prefieres hablar con una persona.',
    };
  }

  static detectIntent(message: string): AgentIntent {
    const text = AgentService.normalize(message);

    if (/\b(asesor|humano|persona|agente|ejecutivo|vendedor)\b/.test(text)) {
      return 'human';
    }
    if (/\b(horario|horarios|atienden|abren|cierran)\b/.test(text)) {
      return 'hours';
    }
    if (/\b(catalogo|catalogos|lista|productos|venden|opciones)\b/.test(text)) {
      return 'catalog';
    }
    if (
      /\b(stock|disponible|disponibles|disponibilidad|queda|quedan)\b/.test(
        text,
      )
    ) {
      return 'stock';
    }
    if (/\b(precio|precios|cuesta|cuestan|vale|valen|cuanto)\b/.test(text)) {
      return 'price';
    }
    if (/\b(gracias|genial|perfecto|listo)\b/.test(text)) {
      return 'thanks';
    }
    if (/\b(hola|buenas|hey|alo|saludos)\b/.test(text)) {
      return 'greeting';
    }
    return 'unknown';
  }

  /** Minúsculas y sin acentos, para que las regex no dependan de la tildación. */
  private static normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Deja sólo las palabras que pueden ser nombre de producto. */
  private static extractSearchTerm(message: string): string {
    return AgentService.normalize(message)
      .split(' ')
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
      .join(' ')
      .trim();
  }

  private static greeting(context: AgentContext, isFirst: boolean): string {
    const name = context.customerName?.split(' ')[0];
    const hello = name && !name.startsWith('+') ? `¡Hola, ${name}!` : '¡Hola!';

    if (!isFirst) return `${hello} ¿En qué más te ayudo?`;

    return (
      `${hello} Soy el asistente de Signature Perfumes. Puedo ayudarte con:\n\n` +
      '• *Catálogo* — ver qué tenemos disponible\n' +
      '• *Precio* — el precio de un perfume\n' +
      '• *Stock* — si algo está disponible\n' +
      '• *Asesor* — hablar con una persona\n\n' +
      'Escríbeme lo que necesitas.'
    );
  }

  private static isFirstMessage(context: AgentContext): boolean {
    // El historial ya incluye el mensaje actual del cliente.
    return (context.history?.length ?? 0) <= 1;
  }

  private static formatPrice(product: ProductWithInventory): string {
    return `S/ ${Number(product.price).toFixed(2)}`;
  }
}

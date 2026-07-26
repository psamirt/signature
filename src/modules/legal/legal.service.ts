import { Injectable } from '@nestjs/common';
import { legalConfig } from '../../config/legal.config';

@Injectable()
export class LegalService {
  privacyPolicyHtml(): string {
    return LegalService.page(
      'Política de privacidad',
      `
      <h1>Política de privacidad</h1>
      <p class="meta">${legalConfig.businessName} · Última actualización: ${legalConfig.lastUpdated}</p>

      <h2>1. Quiénes somos</h2>
      <p>
        ${legalConfig.businessName} atiende consultas comerciales por WhatsApp
        mediante un asistente automatizado. Para cualquier asunto sobre tus datos
        personales, escríbenos a
        <a href="mailto:${legalConfig.contactEmail}">${legalConfig.contactEmail}</a>.
      </p>

      <h2>2. Qué datos recogemos</h2>
      <p>Cuando nos escribes por WhatsApp tratamos únicamente:</p>
      <ul>
        <li>Tu número de teléfono de WhatsApp.</li>
        <li>El nombre de perfil que tú mismo tienes configurado en WhatsApp.</li>
        <li>El contenido de los mensajes que nos envías y de las respuestas que te damos.</li>
        <li>La fecha y hora de cada mensaje.</li>
      </ul>
      <p>
        No solicitamos ni almacenamos contraseñas, números de tarjeta ni
        documentos de identidad a través de este canal.
      </p>

      <h2>3. Para qué los usamos</h2>
      <ul>
        <li>Responder tus consultas sobre productos, precios y disponibilidad.</li>
        <li>Dar continuidad a la conversación y derivarte a una persona cuando lo pidas.</li>
        <li>Mejorar la calidad de las respuestas del asistente.</li>
      </ul>
      <p>No usamos tus datos para publicidad ni los vendemos a terceros.</p>

      <h2>4. Con quién los compartimos</h2>
      <p>
        El canal de mensajería lo provee Meta Platforms a través de la
        WhatsApp Business Platform, por lo que los mensajes pasan por su
        infraestructura y se rigen además por sus propias políticas. Fuera de eso,
        sólo acceden a la información las personas de nuestro equipo que atienden
        las consultas.
      </p>

      <h2>5. Cuánto tiempo los conservamos</h2>
      <p>
        Conservamos el historial de conversación por ${legalConfig.retentionMonths}
        meses, plazo tras el cual se elimina, salvo que una obligación legal exija
        conservarlo más tiempo.
      </p>

      <h2>6. Tus derechos</h2>
      <p>
        Puedes solicitar acceso, rectificación, actualización o supresión de tus
        datos, así como oponerte a su tratamiento, escribiendo a
        <a href="mailto:${legalConfig.contactEmail}">${legalConfig.contactEmail}</a>.
        Atendemos la solicitud en un plazo máximo de 20 días hábiles.
      </p>
      <p>
        Si consideras que no hemos atendido tu solicitud correctamente, puedes
        acudir a la Autoridad Nacional de Protección de Datos Personales del Perú.
      </p>

      <h2>7. Seguridad</h2>
      <p>
        La comunicación con nuestros servidores va cifrada mediante HTTPS y
        validamos criptográficamente que cada notificación provenga realmente de
        Meta antes de procesarla. El acceso a la base de datos está restringido al
        personal autorizado.
      </p>

      <h2>8. Cambios</h2>
      <p>
        Si modificamos esta política, publicaremos la versión actualizada en esta
        misma dirección con una nueva fecha de actualización.
      </p>
    `,
    );
  }

  termsHtml(): string {
    return LegalService.page(
      'Términos del servicio',
      `
      <h1>Términos del servicio</h1>
      <p class="meta">${legalConfig.businessName} · Última actualización: ${legalConfig.lastUpdated}</p>

      <h2>1. Qué es este servicio</h2>
      <p>
        Un canal de atención por WhatsApp operado por un asistente automatizado
        que informa sobre productos, precios y disponibilidad de
        ${legalConfig.businessName}.
      </p>

      <h2>2. Uso aceptable</h2>
      <p>
        El canal es para consultas comerciales. No lo uses para enviar contenido
        ilícito, ofensivo o mensajes masivos no solicitados. Podemos suspender la
        atención a quien haga un uso indebido.
      </p>

      <h2>3. Información de productos y precios</h2>
      <p>
        Los precios y el stock que informa el asistente son de referencia y pueden
        variar. Ninguna respuesta automatizada constituye por sí misma una oferta
        en firme ni una reserva confirmada: la confirmación se hace con un asesor.
      </p>

      <h2>4. Disponibilidad</h2>
      <p>
        Procuramos mantener el servicio disponible de forma continua, pero puede
        interrumpirse por mantenimiento o por causas ajenas a nosotros, incluidas
        incidencias en la plataforma de WhatsApp.
      </p>

      <h2>5. Contacto</h2>
      <p>
        <a href="mailto:${legalConfig.contactEmail}">${legalConfig.contactEmail}</a>
      </p>
    `,
    );
  }

  private static page(title: string, body: string): string {
    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — ${legalConfig.businessName}</title>
<style>
  :root { color-scheme: light dark; }
  body {
    max-width: 44rem; margin: 0 auto; padding: 2.5rem 1.25rem 5rem;
    font: 16px/1.65 system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  h1 { font-size: 1.75rem; margin-bottom: .25rem; }
  h2 { font-size: 1.1rem; margin-top: 2.25rem; }
  .meta { opacity: .65; font-size: .9rem; margin-top: 0; }
  ul { padding-left: 1.25rem; }
  li { margin: .35rem 0; }
  a { color: inherit; }
</style>
</head>
<body>
${body}
</body>
</html>`;
  }
}

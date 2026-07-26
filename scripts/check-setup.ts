import 'dotenv/config';
import { whatsappConfig } from '../src/config/whatsapp.config';

/**
 * Diagnóstico de la configuración de WhatsApp contra el Graph API.
 * Uso: pnpm wa:check
 *
 * Comprueba lo que el panel de Meta no te dice de forma clara: si el token
 * sirve, si el número está registrado y si la app está suscrita a la WABA.
 */

const ok = (m: string) => console.log(`  \x1b[32m✔\x1b[0m ${m}`);
const bad = (m: string) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const warn = (m: string) => console.log(`  \x1b[33m!\x1b[0m ${m}`);

async function get(path: string): Promise<{ status: number; body: any }> {
  const response = await fetch(`${whatsappConfig.graphUrl}/${path}`, {
    headers: { Authorization: `Bearer ${whatsappConfig.accessToken}` },
  });
  const text = await response.text();
  return { status: response.status, body: JSON.parse(text || '{}') };
}

async function main() {
  console.log('\n\x1b[1m1. Variables de entorno\x1b[0m');

  const required = {
    WHATSAPP_PHONE_NUMBER_ID: whatsappConfig.phoneNumberId,
    WHATSAPP_BUSINESS_ACCOUNT_ID: whatsappConfig.businessAccountId,
    WHATSAPP_ACCESS_TOKEN: whatsappConfig.accessToken,
    WHATSAPP_VERIFY_TOKEN: whatsappConfig.verifyToken,
    WHATSAPP_APP_SECRET: whatsappConfig.appSecret,
  };

  let missing = false;
  for (const [key, value] of Object.entries(required)) {
    if (value) ok(`${key} = ${key.includes('TOKEN') || key.includes('SECRET') ? `…${value.slice(-6)}` : value}`);
    else {
      bad(`${key} está vacío`);
      missing = true;
    }
  }

  if (!whatsappConfig.accessToken) {
    console.log(
      '\nSin token no puedo consultar nada más. Genera el token permanente en el Paso 2 del panel.\n',
    );
    return;
  }

  console.log('\n\x1b[1m2. Token de acceso\x1b[0m');
  const me = await get('me');
  if (me.status === 200) ok(`token válido (app/usuario: ${me.body.name ?? me.body.id})`);
  else {
    bad(`token rechazado (${me.status}): ${me.body?.error?.message ?? 'sin detalle'}`);
    if (me.body?.error?.code === 190) {
      warn('código 190 = token expirado o revocado. Genera uno permanente.');
    }
    return;
  }

  console.log('\n\x1b[1m3. Número de teléfono\x1b[0m');
  const phone = await get(
    `${whatsappConfig.phoneNumberId}?fields=display_phone_number,verified_name,code_verification_status,quality_rating,platform_type,status`,
  );
  if (phone.status === 200) {
    ok(`número: ${phone.body.display_phone_number} (${phone.body.verified_name ?? 'sin nombre'})`);

    if (phone.body.code_verification_status === 'VERIFIED') ok('propiedad del número verificada');
    else warn(`verificación: ${phone.body.code_verification_status ?? 'desconocida'}`);

    // platform_type CLOUD_API sólo aparece cuando el número está registrado.
    if (phone.body.platform_type === 'CLOUD_API') ok('registrado en la Cloud API');
    else {
      bad(`no registrado en la Cloud API (platform_type=${phone.body.platform_type ?? 'null'})`);
      warn('regístralo: POST /whatsapp/register con {"pin":"123456"}');
    }

    if (phone.body.quality_rating) ok(`calidad: ${phone.body.quality_rating}`);
  } else {
    bad(`no pude leer el número (${phone.status}): ${phone.body?.error?.message ?? ''}`);
  }

  console.log('\n\x1b[1m4. Suscripción de la app a la WABA\x1b[0m');
  const subs = await get(`${whatsappConfig.businessAccountId}/subscribed_apps`);
  if (subs.status === 200) {
    const apps = subs.body.data ?? [];
    if (apps.length) {
      for (const app of apps) {
        ok(`suscrita: ${app.whatsapp_business_api_data?.name ?? app.whatsapp_business_api_data?.id}`);
      }
    } else {
      bad('ninguna app suscrita a esta WABA');
      warn('suscríbela: POST /whatsapp/subscribe, o el botón "Suscribir webhooks" del panel');
    }
  } else {
    bad(`no pude leer las suscripciones (${subs.status}): ${subs.body?.error?.message ?? ''}`);
  }

  console.log('\n\x1b[1m5. Lo que este script NO puede comprobar\x1b[0m');
  warn('Si la app está publicada (modo Live). Sin publicar, los mensajes reales no llegan.');
  warn('Si la URL de devolución de llamada apunta a tu túnel activo.');
  console.log('  Las dos cosas se revisan a mano en el panel.\n');

  if (missing) {
    console.log('\x1b[33mHay variables sin llenar: revisa el .env antes de seguir.\x1b[0m\n');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

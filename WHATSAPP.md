# Bot de WhatsApp — guía de conexión

## Cómo se traduce la interfaz nueva de Meta

El panel nuevo agrupa todo en **Paso 1. Pruébalo** y **Paso 2. Configuración de
producción**, y eso confunde porque el webhook (lo que necesitas para el bot)
**no aparece en el Paso 1**. Traducción de cada campo:

| Lo que dice el panel | Qué es en realidad | Dónde va en este proyecto |
|---|---|---|
| `Número de prueba +1 (555) 146-5459` | Número que Meta te presta. Sólo puede escribirle a números que registres como destinatarios. | No se usa en código |
| `Phone Number ID: 1160834913789942` | El ID que va en la **URL** del envío. **Esto es lo que el código usa, no el número.** | `WHATSAPP_PHONE_NUMBER_ID` |
| `WhatsApp Business Account ID: 919440521202425` | La WABA. Sirve para gestionar plantillas, no para enviar. | `WHATSAPP_BUSINESS_ACCOUNT_ID` |
| `Cadena de token de acceso` | Token **temporal de 24 h**. Se muere cada día. | `WHATSAPP_ACCESS_TOKEN` |
| `Revisa los webhooks de prueba` + "Esperando a que los webhooks empiecen a mostrar los mensajes enviados…" | Un visor de eventos dentro del panel. Se queda esperando para siempre hasta que configures un webhook real que apunte a tu servidor. | `POST /whatsapp/webhook` |
| `Siguiente: Paso 2. Configuración de producción` | Ahí están: número propio, verificación del negocio y token permanente. | — |

Dos cosas que el Paso 1 **no** te dice y son las que bloquean el bot:

1. **El Paso 1 es de ida, no de vuelta.** El `curl` que te muestra sólo *envía*.
   Para *recibir* lo que el cliente responde necesitas un webhook público, y eso
   se configura en **WhatsApp → Configuración → Webhooks**, en el menú lateral
   izquierdo (no dentro del flujo de pasos).
2. **La ventana de 24 horas.** Sólo puedes enviar texto libre dentro de las 24 h
   siguientes al último mensaje del cliente. Fuera de esa ventana, únicamente
   plantillas aprobadas. Por eso el ejemplo del panel usa `hello_world`.

## Puesta en marcha

### 1. Variables de entorno

Copia `.env.example` a `.env` y llena:

- `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_BUSINESS_ACCOUNT_ID` — ya están puestos
  con los valores de tu panel.
- `WHATSAPP_ACCESS_TOKEN` — pega el token del Paso 1. Caduca en 24 h.
- `WHATSAPP_VERIFY_TOKEN` — una cadena que **tú inventas**. No la da Meta.
- `WHATSAPP_APP_SECRET` — **Configuración de la app → Básica → Clave secreta de
  la app**. Sin esto, cualquiera que conozca tu URL puede inyectar mensajes falsos.

### 2. Base de datos

En local, con tu Postgres corriendo:

```bash
pnpm db:migrate   # aplica migraciones
pnpm db:seed      # 4 perfumes de ejemplo, uno agotado a propósito
```

Para producción, ver "Dónde alojar la base de datos" más abajo.

### 3. Levantar y exponer

Meta exige una URL **pública y con HTTPS**: no acepta `localhost` ni HTTP.
Hay dos caminos.

**Local, para desarrollo.** Un túnel encima de tu API:

```bash
pnpm start:dev
npx localtunnel --port 3000   # o: ngrok http 3000, o: cloudflared tunnel --url http://localhost:3000
```

La URL del túnel cambia cada vez que lo reinicias, y hay que reconfigurar el
webhook en el panel cada vez. Sirve para probar, no para dejarlo andando.

**Render, para que quede fijo.** Ver "Despliegue en Render" más abajo. Da un
dominio estable tipo `https://signature-api.onrender.com`, que es lo que
conviene tanto para el webhook como para la política de privacidad.

No necesitas comprar un dominio propio: el subdominio que da Render cumple el
requisito de Meta. Un dominio propio es sólo cosmético.

### Despliegue en Render

El repo ya trae [`render.yaml`](render.yaml). En Render: **New → Blueprint** y
apunta al repositorio.

Tres detalles del blueprint que no son obvios y que hacen fallar el build:

- **Sin `rootDir`.** La raíz de este repositorio de Git es la carpeta `api/`, así
  que en GitHub el `package.json` ya está en la raíz. Poner `rootDir: api`
  falla con "directory not found".
- **Sin `corepack enable`.** Render trae `pnpm` en `/usr/bin/pnpm` y corepack
  intenta reemplazarlo, pero ese directorio es de sólo lectura: el build muere
  con `EROFS: read-only file system, unlink '/usr/bin/pnpm'`. Se invoca la
  versión exacta de pnpm con `npx --yes pnpm@10.33.4`, que se descarga a la caché
  del usuario.
- **Sin `preDeployCommand`.** No está disponible en el plan gratuito
  (`pre-deploy command is not supported for free tier services`), y mientras el
  archivo lo incluya Render no deja crear el servicio. Por eso
  `prisma migrate deploy` va al final del `buildCommand`.

La versión de Node está fijada en [`.node-version`](.node-version) a la 22.16.0.
Sin ese archivo Render usa la 24, que no es la que se probó.

Los secretos están marcados `sync: false` a propósito: se llenan a mano en
*Environment* del panel de Render, no en el archivo. Rellena
`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID` y
`LEGAL_CONTACT_EMAIL`.

Con el servicio arriba, tus URLs quedan:

- Webhook: `https://TU-APP.onrender.com/whatsapp/webhook`
- Política de privacidad: `https://TU-APP.onrender.com/privacy`
- Diagnóstico: `https://TU-APP.onrender.com/whatsapp/health`

**Advertencia del plan gratuito:** Render duerme el servicio tras ~15 min sin
tráfico y despertarlo tarda cerca de un minuto. Si un cliente escribe cuando
está dormido, ese primer webhook puede fallar; Meta reintenta, así que el
mensaje suele llegar, pero con retraso. El plan gratuito también da 750 horas de
instancia al mes por espacio de trabajo. Para uso real conviene el plan de pago o
un ping periódico a `/health`.

### Dónde alojar la base de datos

El `render.yaml` **no** crea la base de datos, y es deliberado: el Postgres
gratuito de Render **caduca 30 días después de crearse**, da 14 días de gracia y
después Render lo elimina con todos los datos dentro. Para un bot que acumula
conversaciones de clientes, eso es una pérdida de datos programada.

La recomendación es separar las dos cosas: **API en Render, base de datos en
Neon.** El plan gratuito de Neon no caduca (0.5 GB de almacenamiento, 100 horas
de cómputo al mes). Suspende el cómputo tras ~5 min de inactividad, pero reanuda
solo en la siguiente consulta, sin intervención manual.

Pasos:

1. Crea un proyecto en [neon.com](https://neon.com) y copia la cadena de
   conexión. Termina en `?sslmode=require`.
2. Pégala en `DATABASE_URL` en *Environment* del panel de Render.
3. El `preDeployCommand` del blueprint corre `prisma migrate deploy` en cada
   despliegue, así que las tablas se crean solas en el primer deploy.
4. Para cargar los productos de ejemplo una vez:
   `DATABASE_URL="<cadena-de-neon>" pnpm db:seed`

[`PrismaService`](src/prisma/prisma.service.ts) activa TLS automáticamente cuando
la cadena de conexión lleva `sslmode=require`, y en local no, donde no hay TLS.
El timeout de conexión está en 15 s porque la primera consulta tras la suspensión
de Neon tarda en despertar la instancia.

Otras opciones válidas, por si prefieres:

| Servicio | Plan gratuito | Ojo con |
|---|---|---|
| **Neon** | Sin caducidad, 0.5 GB | 100 h de cómputo al mes |
| Supabase | Sin caducidad, 500 MB | **Pausa el proyecto tras 1 semana sin actividad** y hay que reactivarlo a mano desde el panel |
| Render | 1 GB | **Se elimina a los 30 días** |
| Postgres administrado de pago | — | Desde unos pocos dólares al mes; es lo sensato en cuanto el bot atienda clientes de verdad |

### 4. Registrar el webhook

En **WhatsApp → Configuración → Webhooks → Editar**:

- **URL de devolución de llamada**: `https://TU-TUNEL/whatsapp/webhook`
- **Token de verificación**: exactamente el mismo valor de `WHATSAPP_VERIFY_TOKEN`

Pulsa *Verificar y guardar*. Meta hace un `GET` con `hub.mode`,
`hub.verify_token` y `hub.challenge`; la API devuelve el challenge en texto plano
y el panel muestra el webhook como verificado.

Después, en **Campos de webhook**, suscríbete a **`messages`**. Ese es el único
imprescindible; sin él no llega nada aunque la URL esté verificada.

### 5. Registrar tu número como destinatario

En el Paso 1, en **Para**, agrega tu número (`+51 982 254 431`) y confirma el
código que te llega por WhatsApp. El número de prueba sólo puede escribir a
números de esa lista.

### 6. Probar

Escribe "hola" desde tu WhatsApp al número de prueba. Deberías recibir el menú
del bot. En los logs verás `intent=greeting`.

## Endpoints

| Método | Ruta | Para qué |
|---|---|---|
| `GET` | `/whatsapp/health` | Comprueba qué variables faltan sin exponer secretos |
| `GET` | `/whatsapp/status` | Estado del número según Meta: verificado, registrado, calidad |
| `POST` | `/whatsapp/register` | Registra el número: `{"pin":"123456"}` |
| `POST` | `/whatsapp/subscribe` | Suscribe la app a la WABA (= "Suscribir webhooks") |
| `GET` | `/whatsapp/webhook` | Handshake de verificación de Meta |
| `POST` | `/whatsapp/webhook` | Recepción de mensajes y estados |
| `POST` | `/whatsapp/send` | Envío manual: `{"to":"+51982254431","message":"hola"}` o `{"to":"...","template":"hello_world","language":"en_US"}` |
| `POST` | `/agent/message` | Prueba el bot sin WhatsApp: `{"message":"cuanto cuesta el oud royale"}` |

## Decisiones de implementación

- **`rawBody: true` en `main.ts`** — la firma `X-Hub-Signature-256` es un HMAC
  sobre los bytes exactos del cuerpo. Si se valida contra el JSON re-serializado,
  nunca coincide.
- **Se responde `200` antes de procesar.** Meta corta a los ~5 s y reintenta; con
  procesamiento síncrono el cliente recibe respuestas duplicadas.
- **Firma inválida → `200`, no `403`.** Un `4xx` hace que Meta reintente y acabe
  deshabilitando el webhook. El evento se descarta y queda en el log.
- **`waMessageId` único en `messages`** — los reintentos de Meta traen el mismo
  `wamid`, así que la unicidad en base de datos actúa como candado de idempotencia.
- **El webhook no usa DTOs con `class-validator`.** El `ValidationPipe` global
  tiene `forbidNonWhitelisted: true` y Meta agrega campos nuevos sin avisar;
  rechazar el payload rompería el webhook en cualquier cambio suyo.

## Paso 2 — Configuración de producción

Cuenta real de este proyecto:

- **Negocio**: Aura Signature
- **WABA**: `2313409299064968` → `WHATSAPP_BUSINESS_ACCOUNT_ID`
- **Número**: +51 937 321 347
- **Phone Number ID**: `1143171158890623` → `WHATSAPP_PHONE_NUMBER_ID`

Ojo: **estos IDs son distintos a los del número de prueba del Paso 1.** Si dejas
los del Paso 1 en el `.env`, la app responde desde el número de prueba y nunca
desde el real.

Orden correcto de las tareas. Cada una depende de la anterior, así que conviene
no saltarse ninguna:

1. **Tener la API en una URL pública con HTTPS.** Sin esto no puedes ni
   configurar el webhook ni publicar la app, porque los dos pasos piden una URL
   que Meta debe poder abrir. Ver "Despliegue en Render".
2. **Token permanente.** Genéralo en el Paso 2 del panel, o a mano en
   *Business Settings → Usuarios del sistema*: usuario con rol de administrador,
   asígnale la app y genera token con `whatsapp_business_messaging`,
   `whatsapp_business_management` y `business_management`. El de 24 h no sirve.
3. **Registrar el número.** Verificar la propiedad no lo registra; por eso el
   panel muestra "No registrado" incluso tras verificar. Se resuelve con
   `POST /whatsapp/register` y un PIN de 6 dígitos que tú eliges. Máx. 10
   intentos por número cada 72 h (error `133016`).
4. **Suscribir la app a la WABA.** El botón "Suscribir webhooks" del panel, o
   `POST /whatsapp/subscribe`. Es independiente de configurar la URL de
   devolución de llamada: hacen falta **las dos**.
5. **Configurar el webhook.** URL de devolución de llamada
   `https://TU-APP.onrender.com/whatsapp/webhook` y como token de verificación el
   mismo valor de `WHATSAPP_VERIFY_TOKEN`. La API debe estar corriendo cuando
   pulses *Verificar y guardar*, porque Meta llama en ese instante. Luego
   suscríbete al campo **`messages`**.
6. **Política de privacidad y publicación de la app.** En
   *Configuración → Básica*, pon `https://TU-APP.onrender.com/privacy` en
   *URL de la política de privacidad*. Sin ese campo, el switch de modo Live no
   se activa. Después pulsa **Publicar**. Mientras la app esté sin publicar, Meta
   sólo entrega los webhooks de prueba del panel: los mensajes reales de clientes
   **no llegan**, ni los tuyos como administrador.
7. **Método de pago.** Ya está agregado. Cubre los mensajes iniciados por el
   negocio (marketing, utilidad, autenticación). Las respuestas a clientes van
   contra las **1000 conversaciones de servicio gratuitas al mes**, que es lo que
   consume este bot.
8. **Verificación del negocio.** El paso lento (2–4 días). Sin ella el número
   tiene límites bajos de mensajería.
9. **Plantillas** para poder iniciar conversaciones fuera de la ventana de 24 h.

Para saber en qué paso estás sin adivinar:

```bash
pnpm wa:check
```

Consulta el Graph API y te dice si el token sirve, si el número quedó registrado
y si la app está suscrita a la WABA. Lo único que no puede comprobar es si la app
está publicada y si la URL del webhook apunta a donde crees: eso se ve a mano.

### Política de privacidad

La API la sirve en `/privacy` (y los términos en `/terms`), así no dependes de
montar un sitio aparte. El contenido está en
[`legal.service.ts`](src/modules/legal/legal.service.ts) y los datos del negocio
en [`legal.config.ts`](src/config/legal.config.ts).

Es un texto redactado para este caso concreto —qué datos recoge el bot de
WhatsApp, para qué y por cuánto tiempo— pero **revísalo antes de publicarlo**:
es un documento legal que compromete a tu negocio, y los plazos de conservación
y el correo de contacto deben coincidir con lo que realmente haces.

**Rota cualquier token que se haya filtrado.** El que aparece en un chat, una
captura o un commit está comprometido: regenéralo desde el panel.

## Cómo pasar el bot a un LLM

El router de intenciones vive en `AgentService.handleMessage`. Para cambiarlo por
un modelo, sustituye ese método por una llamada al LLM pasando
`context.history` como historial y `ProductsService.search` / `findAvailable`
como herramientas. El resto de la cadena (webhook, persistencia, envío) no cambia:
sólo consume `AgentResult`.

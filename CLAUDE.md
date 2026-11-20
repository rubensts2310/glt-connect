# GLT Connect

CRM de ventas y app de eventos de Grupo Los Tres (marca piloto: Jetour). Lo desarrolla Madame Group. Los pedidos llegan
como tickets de soporte del Sistema Madame (`sistema = glt`) y se citan como `#NNNN`; el ticket vive allá, el código aquí.

Tiene **dos partes que no comparten datos ni acceso**:

| | Autoshow (producción, datos reales) | CRM (demo, datos de prueba) |
|---|---|---|
| Rutas | `/autoshow` (tablet), `/autoshow/c/:token` (cotización del cliente), `/panel` (gerencia) | `/`, `/pipeline`, `/lead/:id`, `/direccion`, `/catalogo`, `/cotizaciones`, `/demo`, `/integraciones`, `/c/:token`, `/chat` |
| Código | `src/autoshow`, `public/as-panel.html`, `api/cotizacion.js` | `src/pages`, `src/lib/store.jsx`, `src/components` |
| Tablas | `as_*` | `leads`, `messages`, `quotes`, `test_drives`, `lead_events`, `settings`, `sellers`… |
| Acceso | Sin sesión de Supabase: la tablet se activa con un código y cada asesor entra con PIN; sesiones firmadas con HMAC (secreto en `as_settings`). Todo pasa por las edge functions `autoshow`, `autoshow-cotizacion` y `autoshow-panel` con service role | Usuario de Supabase Auth (#4281: antes entraba solo con un usuario demo) |

`docs/autoshow.md` explica el autoshow para gente no técnica.

## Stack

- **Front**: Vite + React 18 + react-router (`BrowserRouter`, rutas en `src/main.jsx`). JavaScript, no TypeScript.
  Estilos propios en `src/styles.css` (clases `card`, `btn`, `inp`, `field`, `chip`; colores en variables `--ink`,
  `--bad`, `--good`…). No hay Tailwind ni shadcn.
- **Base y auth**: Supabase **GLT-CONNECT** (`sqcsjcdtahptpxwczoyy`). **No es** el proyecto del Sistema Madame
  (CocinaAbierta): no confundir el `project_id` al consultar o aplicar migraciones.
- **Edge functions** (`supabase/functions`): `bot` (asistente con OpenAI), `ingest` (entrada de leads con header
  `x-glt-key`), `followup` (seguimientos con IA), `quote` (cotización pública del CRM), y las tres del autoshow.
  Los `_shared.ts` están copiados en cada función: si se cambia uno, cambiar todos.
- **Cron** (pg_cron): `glt-sla-reassign` cada 5 min y `glt-bot-tick` cada 2 min.
- **Deploy**: Vercel. `vercel.json` reescribe `/panel` a `public/as-panel.html` y `/autoshow/c/:token` a `api/cotizacion`.
  Lo que entra a `main` sale a producción; cada PR tiene preview.

## Comandos

- `npm run dev`: app local.
- `npm run build`: no hay `tsc` ni tests ni CI. **Correrlo antes de cada commit**; es la única verificación.

## Base de datos

- Migraciones: SQL a mano en `supabase/migrations/` (nombre descriptivo, más el número de ticket si hay uno) y se
  aplican en el proyecto GLT-CONNECT. Antes de cambiar algo, mirar las tablas y políticas en la base, no solo en el repo.
- Las tablas `as_*` no tienen políticas y tienen los permisos revocados: solo el service role las toca. No agregarles
  políticas para el navegador.
- En el CRM, `authenticated` puede leer y escribir todo (políticas `using true`). Eso solo es aceptable mientras el
  CRM sea demo y sus usuarios sean del equipo; no meter ahí datos reales sin cambiarlo antes.
- `leads.is_demo_seed` marca los leads de prueba.

## Seguridad (revisión del 16 nov, tickets #4281–#4284)

- **Nada de secretos en el código ni en `VITE_*`**: todo lo que empieza con `VITE_` termina en el JavaScript que baja
  el navegador. Las llaves (OpenAI, `ingest_key`, secreto de sesiones) viven en secretos de Supabase o en tablas que
  solo lee el service role.
- La llave publicable de Supabase en `src/lib/supabase.js` es pública por diseño.
- Lo que se arma como HTML a mano (`public/as-panel.html`) pasa siempre por `esc()`.
- Las funciones públicas que gastan IA (`bot`, `followup`) necesitan límite de uso.

## Convenciones

- Interfaz, comentarios y commits en español.
- **Tono: usted**, en toda la app (equipo y clientes): "Cambie a un rol", "Escriba su número". Es distinto del
  Sistema Madame.
- Commits en lenguaje de usuario: `Área: qué cambia para quien lo usa (#ticket)`. Áreas habituales: `Autoshow`,
  `Panel`, `CRM`, `Bot`, `App`.
- No poner datos reales de clientes (nombres, teléfonos, montos) en commits, PRs ni tickets.
- Variables de entorno: aplicar `.trim()`.
- Hora: el equipo y el cliente están en Guatemala (UTC-6). En Git Bash usar `TZ=UTC+6`.

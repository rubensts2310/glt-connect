# GLT Connect

CRM de ventas de Grupo Los Tres (piloto Jetour). Desarrollado por Madame Group.

- **Frontend:** Vite + React (`src/`). Se publica en Vercel sin configuración extra.
- **Backend:** Supabase proyecto `GLT-CONNECT` (`sqcsjcdtahptpxwczoyy`): base de datos, auth, storage de imágenes y edge functions en `supabase/functions/`:
  - `bot` — asistente virtual con OpenAI (secreto `OPEN`): califica con 7 preguntas, calcula puntaje y asigna asesor.
  - `ingest` — API de entrada de leads (Meta, WhatsApp, web, Google, HubSpot). Header `x-glt-key`.
  - `followup` — seguimientos automáticos redactados con IA.
  - `quote` — página pública de cotización con registro de aperturas y acciones del cliente.

## Rutas
`/` inicio por rol · `/pipeline` · `/lead/:id` · `/direccion` · `/catalogo` · `/cotizaciones` · `/demo` · `/integraciones` · `/c/:token` cotización del cliente · `/chat` chat con el bot.

## Desarrollo
```
npm install
npm run dev
```

## /autoshow (producción)

App de tablet para el stand: catálogo con info rápida, registro express de clientes, cotización con QR + WhatsApp y cola de seguimiento post-evento.

- Ruta: `/autoshow` (tablet) y `/autoshow/c/:token` (cotización que abre el cliente).
- Datos: tablas `as_*` en Supabase, sin acceso público (RLS sin políticas, permisos revocados). Todo pasa por las Edge Functions `autoshow` y `autoshow-cotizacion` con service role.
- Acceso: la tablet se activa una vez con el código del evento; cada asesor entra con PIN (bloqueo de 10 min tras 5 intentos). Sesiones firmadas con HMAC, 14 h.
- Sin señal: los registros y cotizaciones se guardan en la tablet y se suben solos al volver la conexión. El QR es definitivo desde el primer momento.
- Gerencia: avance por asesor, interés por modelo, alta de asesores y PIN, bono por modelo, código de activación y exportación a CSV.

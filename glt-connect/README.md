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

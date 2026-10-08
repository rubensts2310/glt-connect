-- Foto del asesor (ruta dentro del bucket público `assets`, p. ej. sellers/<id>-<ts>.jpg).
-- Se muestra en la cotización del cliente y en la vista previa del enlace de WhatsApp.
alter table as_sellers add column if not exists photo text;

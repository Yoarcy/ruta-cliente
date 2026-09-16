-- MessPro/Ruta Cliente v19 - campos mínimos requeridos por Yoa
-- Ejecutar en Supabase SQL Editor si la tabla clientes todavía tiene identidad/actualizado_en.

alter table public.clientes
  add column if not exists telefono text;

update public.clientes
set telefono = coalesce(telefono, identidad)
where telefono is null and exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'clientes'
    and column_name = 'identidad'
);

-- Opcional: ejecutar estos DROP solo después de confirmar que la app v19 funciona.
-- alter table public.clientes drop column if exists identidad;
-- alter table public.clientes drop column if exists actualizado_en;
-- alter table public.clientes drop column if exists creado_en;

-- Estructura final deseada:
-- id
-- nombre_completo
-- telefono
-- descripcion
-- latitud
-- longitud

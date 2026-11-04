-- Ruta Cliente v34: el dato es un teléfono, no una identidad.
-- Ejecutar una vez en Supabase > SQL Editor antes de enviar desde v34.

begin;

alter table public.clientes
  add column if not exists telefono text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clientes'
      and column_name = 'identidad'
  ) then
    execute $sql$
      update public.clientes
      set telefono = coalesce(nullif(telefono, ''), identidad)
      where telefono is null or telefono = ''
    $sql$;
  end if;
end $$;

alter table public.clientes
  alter column telefono set default '';

alter table public.clientes
  drop column if exists identidad;

comment on column public.clientes.telefono is 'Número de teléfono del cliente';

notify pgrst, 'reload schema';

commit;

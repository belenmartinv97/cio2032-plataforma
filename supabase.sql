-- Plataforma CIO 2032 · Script de base de datos
-- Pégalo entero en Supabase → SQL Editor → Run. Se puede ejecutar más de una vez.

create extension if not exists pgcrypto with schema extensions;

-- Respuestas: una fila por participante (token personal)
create table if not exists public.responses (
  token      text primary key check (token ~ '^[A-Za-z0-9_-]{8,64}$'),
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Clave de administración (guardada cifrada)
create table if not exists public.admin_secret (
  id       int primary key default 1 check (id = 1),
  key_hash text not null
);

-- Nadie puede leer ni escribir las tablas directamente desde la web.
alter table public.responses    enable row level security;
alter table public.admin_secret enable row level security;
revoke all on public.responses    from anon, authenticated;
revoke all on public.admin_secret from anon, authenticated;

-- Clave de administración inicial: sustituye CAMBIA-ESTA-CLAVE por una clave larga que solo conozcas tú (y no la subas a GitHub)
insert into public.admin_secret (id, key_hash)
values (1, extensions.crypt('CAMBIA-ESTA-CLAVE', extensions.gen_salt('bf')))
on conflict (id) do nothing;

-- Un participante lee su propia fila (solo si conoce su token)
create or replace function public.get_response(p_token text)
returns jsonb language sql security definer set search_path = public as $$
  select data from public.responses where token = p_token;
$$;

-- Un participante guarda su propia fila
create or replace function public.save_response(p_token text, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{8,64}$' then
    raise exception 'token no valido';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or length(p_data::text) > 200000 then
    raise exception 'datos no validos';
  end if;
  insert into public.responses (token, data, updated_at) values (p_token, p_data, now())
  on conflict (token) do update set data = excluded.data, updated_at = now();
end;
$$;

-- Comprobar la clave de administración
create or replace function public.admin_check(p_key text)
returns boolean language sql security definer set search_path = public, extensions as $$
  select exists (select 1 from public.admin_secret where key_hash = extensions.crypt(coalesce(p_key,''), key_hash));
$$;

-- Leer todas las respuestas (solo con la clave de administración)
create or replace function public.admin_list(p_key text)
returns table (token text, data jsonb, updated_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.admin_check(p_key) then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  return query select r.token, r.data, r.updated_at from public.responses r order by r.updated_at desc;
end;
$$;

revoke all on function public.get_response(text)        from public;
revoke all on function public.save_response(text,jsonb) from public;
revoke all on function public.admin_check(text)         from public;
revoke all on function public.admin_list(text)          from public;
grant execute on function public.get_response(text)        to anon, authenticated;
grant execute on function public.save_response(text,jsonb) to anon, authenticated;
grant execute on function public.admin_check(text)         to anon, authenticated;
grant execute on function public.admin_list(text)          to anon, authenticated;

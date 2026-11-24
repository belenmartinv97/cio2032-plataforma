-- Permite al administrador eliminar participantes (solo con la clave de administración)
create or replace function public.admin_delete(p_key text, p_tokens text[])
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare n integer;
begin
  if not public.admin_check(p_key) then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  delete from public.responses where token = any(p_tokens);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.admin_delete(text,text[]) from public;
grant execute on function public.admin_delete(text,text[]) to anon, authenticated;

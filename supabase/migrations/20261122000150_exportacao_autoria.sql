-- Dmanda: autoria e situação dos acessos para a cópia dos dados (decisão 92). Aditiva: uma função nova, só da conta administradora (verificado no banco).
-- A cópia versão 5 leva, para a administradora, o mapa "registro -> e-mail do autor" (o restaurador mapeia os autores pelo e-mail para as contas do projeto de destino) e a situação dos acessos
-- (informativa: a restauração NUNCA concede nem restabelece um acesso). Nenhuma senha, token ou chave entra; o conteúdo dos rascunhos de outras contas nunca sai por aqui (cada conta só exporta os próprios).
create or replace function public.exportar_autoria() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not dmanda_privado.e_admin() then perform public.erro_acesso('Somente a conta administradora gera a cópia com a autoria.'); end if;
  return jsonb_build_object(
    'demandas', coalesce((select jsonb_object_agg(r.id::text, lower(u.email)) from public.demandas r join auth.users u on u.id = r.user_id), '{}'::jsonb),
    'tarefas', coalesce((select jsonb_object_agg(r.id::text, lower(u.email)) from public.tarefas r join auth.users u on u.id = r.user_id), '{}'::jsonb),
    'entradas', coalesce((select jsonb_object_agg(r.id::text, lower(u.email)) from public.entradas r join auth.users u on u.id = r.user_id), '{}'::jsonb),
    'eventos', coalesce((select jsonb_object_agg(r.id::text, lower(u.email)) from public.eventos r join auth.users u on u.id = r.user_id), '{}'::jsonb),
    'dias_indisponiveis', coalesce((select jsonb_object_agg(r.id::text, lower(u.email)) from public.dias_indisponiveis r join auth.users u on u.id = r.user_id), '{}'::jsonb),
    'acessos', public.listar_acessos());
end $$;
revoke all on function public.exportar_autoria() from public, anon, authenticated;
grant execute on function public.exportar_autoria() to authenticated;

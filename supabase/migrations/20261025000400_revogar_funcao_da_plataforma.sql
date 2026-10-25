-- A opção "RLS automático" do projeto cria public.rls_auto_enable(), função de gatilho de evento (security definer) que o Security Advisor
-- aponta como executável por anon e authenticated pela API (/rest/v1/rpc). Gatilhos de evento não exigem EXECUTE de quem faz o DDL, então a
-- revogação não afeta o RLS automático; só impede chamá-la pela API. Condicional: o banco local de teste não tem essa função.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

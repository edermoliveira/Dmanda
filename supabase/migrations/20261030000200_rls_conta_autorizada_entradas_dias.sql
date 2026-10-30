-- Terceira camada de acesso (conta autorizada) também em Entradas e em dias indisponíveis.
-- A migração 4 pôs `dmanda_privado.conta_autorizada()` nas políticas de demandas, tarefas e rotina; as tabelas criadas depois (dias_indisponiveis na 8 e entradas na 10)
-- só conferiam o dono da linha. Um usuário do Auth fora da lista (o hook de cadastro e o servidor já o barram) ainda gravaria e leria linhas próprias nelas.
-- Só troca as duas políticas, no mesmo molde da migração 4: nenhum dado é tocado e a conta autorizada (a única real) passa a conferir igual a antes.
drop policy dias_indisponiveis_dono on public.dias_indisponiveis;
create policy dias_indisponiveis_dono on public.dias_indisponiveis for all to authenticated
  using ((select auth.uid()) = user_id and (select dmanda_privado.conta_autorizada()))
  with check ((select auth.uid()) = user_id and (select dmanda_privado.conta_autorizada()));
drop policy entradas_dono on public.entradas;
create policy entradas_dono on public.entradas for all to authenticated
  using ((select auth.uid()) = user_id and (select dmanda_privado.conta_autorizada()))
  with check ((select auth.uid()) = user_id and (select dmanda_privado.conta_autorizada()));

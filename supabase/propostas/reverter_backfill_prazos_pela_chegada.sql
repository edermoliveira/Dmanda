-- PROPOSTA (volta do backfill_prazos_pela_chegada.sql). Não aplicada fora do banco de teste.
-- Devolve as colunas de prazo copiadas antes do backfill, só para as demandas que ainda estão na versão que o backfill gravou (quem foi editado depois não é tocado e aparece na
-- lista final de "não revertidas" para o Éder decidir). A tabela de cópia NÃO é apagada aqui: só depois de o Éder confirmar que a volta ficou certa.
begin;

create temp table nao_revertidas on commit drop as
  select b.id, d.versao as versao_atual, b.versao_depois
  from dmanda_privado.backfill_prazo_chegada b join public.demandas d on d.id = b.id
  where b.versao_depois is not null and d.versao <> b.versao_depois;

update public.demandas d set
  prazo = b.prazo, prazo_original = b.prazo_original, prazo_dias = b.prazo_dias, prazo_base_em = b.prazo_base_em, prazo_ajuste = b.prazo_ajuste, prazo_legado = b.prazo_legado
from dmanda_privado.backfill_prazo_chegada b
where d.id = b.id and b.versao_depois is not null and d.versao = b.versao_depois;

select * from nao_revertidas;

commit;

-- PROPOSTA, NÃO É MIGRAÇÃO E NÃO FOI APLICADA EM LUGAR NENHUM ALÉM DO BANCO DE TESTE (decisão 81, etapa 4 de 6).
-- Só pode ser aplicada no Supabase real com autorização específica do Éder, depois de conferir a comparação de scripts/comparar-prazos-legados.mjs e de uma cópia dos dados.
--
-- O que faz: para as demandas ABERTAS (nem finalizadas, nem arquivadas) que têm uma duração registrada (prazo_dias) e uma data de chegada, mas cuja duração foi contada de outro dia
-- que não a chegada (prazo_base_em diferente de chegou_em, a regra anterior contava de "hoje"), recontar o prazo original como chegada + prazo_dias, guardar a chegada como nova base e
-- reaplicar o ajuste do calendário do usuário (último dia disponível anterior, com o texto dos dias pulados).
-- O que NUNCA toca: finalizadas e arquivadas (histórico), datas escolhidas à mão (sem prazo_dias), prazos sem chegada (falta a base) e demandas sem prazo. Nenhuma duração é deduzida de
-- diferenças entre datas: só entra quem tem a duração gravada.
--
-- Reversível: antes de mudar qualquer coisa, copia as colunas de prazo dos candidatos para dmanda_privado.backfill_prazo_chegada (a tabela fica até o Éder mandar apagar). O arquivo
-- reverter_backfill_prazos_pela_chegada.sql devolve exatamente esses valores para quem ainda está na versão que o backfill gravou (quem foi editado depois não é tocado).
-- A versão da demanda sobe nas linhas alteradas (e na volta): uma janela de edição aberta antes é recusada (DM409) em vez de sobrescrever o vencimento novo.
--
-- Rodar como dono do banco (sem sessão de usuário), numa transação: o cálculo usa os dias indisponíveis de cada usuário pelo user_id da demanda, como a migração 20261029000100.
begin;

create table if not exists dmanda_privado.backfill_prazo_chegada (
  id uuid primary key,
  user_id uuid not null,
  prazo date,
  prazo_original date,
  prazo_dias integer,
  prazo_base_em date,
  prazo_ajuste text,
  prazo_legado boolean not null,
  versao_antes integer not null,
  versao_depois integer,
  copiado_em timestamptz not null default now()
);

insert into dmanda_privado.backfill_prazo_chegada (id, user_id, prazo, prazo_original, prazo_dias, prazo_base_em, prazo_ajuste, prazo_legado, versao_antes)
select id, user_id, prazo, prazo_original, prazo_dias, prazo_base_em, prazo_ajuste, prazo_legado, versao
from public.demandas
where etapa <> 'Finalizado' and arquivada_em is null and prazo_dias is not null and chegou_em is not null and prazo_base_em is distinct from chegou_em
on conflict (id) do nothing;

do $$
declare r record; orig date; d date; pulados text[]; razoes text[]; n integer; achou boolean; novo_ajuste text;
begin
  for r in
    select dm.id, dm.user_id, dm.chegou_em, dm.prazo_dias, dm.prazo, dm.prazo_ajuste, dm.prazo_original
    from public.demandas dm join dmanda_privado.backfill_prazo_chegada b on b.id = dm.id and b.versao_depois is null
    order by dm.id
  loop
    orig := r.chegou_em + r.prazo_dias; d := orig; pulados := '{}'; n := 0; achou := false;
    while n <= 400 loop
      n := n + 1;
      razoes := array_remove(array[case extract(isodow from d)::integer when 6 then 'sábado' when 7 then 'domingo' end], null)
        || coalesce((select array_agg(lower(c.categoria) || ': ' || btrim(c.descricao) order by c.criado_em, c.id) from public.dias_indisponiveis c where c.user_id = r.user_id and c.data = d), '{}');
      if cardinality(razoes) = 0 then achou := true; exit; end if;
      pulados := pulados || (to_char(d, 'DD/MM') || ' ' || array_to_string(razoes, ', '));
      d := d - 1;
    end loop;
    if not achou then continue; end if;   -- sem dia disponível nos 400 dias anteriores: a demanda fica como está
    novo_ajuste := case when cardinality(pulados) = 0 then null else array_to_string(pulados, '; ') end;
    update public.demandas set prazo_base_em = r.chegou_em, prazo_original = orig, prazo = d, prazo_ajuste = novo_ajuste, prazo_legado = false where id = r.id;
    update dmanda_privado.backfill_prazo_chegada set versao_depois = (select versao from public.demandas where id = r.id) where id = r.id;
  end loop;
end $$;

commit;

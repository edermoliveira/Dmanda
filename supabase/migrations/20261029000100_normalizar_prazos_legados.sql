-- Dmanda: normaliza os prazos legados ABERTOS (DECISOES.md, decisão 34).
-- A migração 8 marcou como "legado" o prazo que já existia e o manteve como estava, mesmo caindo em sábado, domingo ou dia cadastrado. Isso deixava demandas abertas
-- com vencimento em fim de semana, sem a antecipação que o calendário prevê. Aqui o vencimento efetivo (prazo) dessas demandas passa a seguir o calendário de cada
-- usuário, e o prazo original continua exatamente como estava (prazo_original e prazo_legado não mudam).
--
--  * Só mexe em demandas não finalizadas com prazo legado. As finalizadas guardam o prazo de então. Quem já tem o vencimento num dia disponível não muda (nem a versão).
--  * Para as que mudam, a versão sobe (gatilho existente), então uma janela de edição aberta com o prazo antigo é recusada (DM409) em vez de sobrescrever o vencimento novo.
--  * A conta é a mesma de ajustar_prazo (do dia original para trás, até o primeiro dia sem fim de semana nem dia cadastrado, com o mesmo texto de explicação), mas feita
--    aqui direto por usuário (user_id da demanda), porque a migração roda sem sessão e a RLS não identificaria o dono. Cada usuário usa só os próprios dias.
--  * Uma demanda sem dia disponível nos 400 dias anteriores é deixada como está, em vez de interromper a migração.
--  * Reaplicar é inofensivo: depois da primeira vez nada mais muda.
--  * Nenhuma migração anterior é reescrita; nenhuma coluna, tarefa ou política é alterada.
do $$
declare r record; d date; pulados text[]; razoes text[]; n integer; achou boolean;
begin
  for r in
    select id, user_id, prazo, prazo_original, prazo_ajuste from public.demandas
    where prazo_legado and etapa <> 'Finalizado' and prazo_original is not null
    order by id
  loop
    d := r.prazo_original; pulados := '{}'; n := 0; achou := false;
    while n <= 400 loop
      n := n + 1;
      razoes := array_remove(array[case extract(isodow from d)::integer when 6 then 'sábado' when 7 then 'domingo' end], null)
        || coalesce((select array_agg(lower(c.categoria) || ': ' || btrim(c.descricao) order by c.criado_em, c.id)
                     from public.dias_indisponiveis c where c.user_id = r.user_id and c.data = d), '{}');
      if cardinality(razoes) = 0 then achou := true; exit; end if;
      pulados := pulados || (to_char(d, 'DD/MM') || ' ' || array_to_string(razoes, ', '));
      d := d - 1;
    end loop;
    if achou and (d is distinct from r.prazo or (case when cardinality(pulados) = 0 then null else array_to_string(pulados, '; ') end) is distinct from r.prazo_ajuste) then
      update public.demandas set prazo = d, prazo_ajuste = case when cardinality(pulados) = 0 then null else array_to_string(pulados, '; ') end where id = r.id;
    end if;
  end loop;
end $$;

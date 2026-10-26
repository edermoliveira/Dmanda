-- Entrada por e-mail e senha (Supabase Auth), além do Google, para a mesma conta autorizada (usuário único).
-- As migrações anteriores não foram reescritas: esta troca só a função que exigia o provedor Google nas políticas de RLS, mantendo a lista protegida,
-- o mesmo usuário e os mesmos dados. Nenhuma tabela, política ou privilégio muda (as políticas chamam conta_autorizada() e passam a valer para os dois provedores).
-- Regra nova: o e-mail do JWT assinado precisa estar na lista protegida E o provedor registrado pelo servidor de Auth (app_metadata.provider,
-- que o usuário não edita) precisa ser 'google' ou 'email'. Qualquer outro provedor (anônimo, telefone, GitHub etc.) segue recusado.
-- Observação: um usuário criado pelo Google continua com app_metadata.provider = 'google' mesmo depois de ganhar senha; os dois valores são aceitos por isso.
--
-- O hook de cadastro (public.hook_antes_criar_usuario) NÃO muda de propósito: continua aceitando só o Google. Ele roda quando um usuário é CRIADO, e o usuário
-- único já existe (a senha é definida nele pela API de administração). Aceitar 'email' no hook abriria cadastro por senha para o endereço autorizado sem
-- exigir e-mail confirmado (por exemplo, se a conta fosse apagada ou a confirmação de e-mail desligada), e a RLS entregaria os dados. Com o hook assim,
-- ninguém cria usuário por e-mail e senha; se um dia for preciso recriar a conta, entra-se uma vez pelo Google (ou por administração) e define-se a senha.
-- Depois de provada a entrada por senha, o Google é desligado no painel do Supabase (e o botão some pela variável DMANDA_LOGIN_GOOGLE), sem outra migração.

create or replace function dmanda_privado.conta_autorizada() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'provider', '') in ('google', 'email')
    and exists (
      select 1 from dmanda_privado.acesso_autorizado a
      where a.email = lower(btrim(coalesce((select auth.jwt()) ->> 'email', '')))
    )
$$;
revoke all on function dmanda_privado.conta_autorizada() from public, anon, authenticated;
grant execute on function dmanda_privado.conta_autorizada() to authenticated;

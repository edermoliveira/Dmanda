# RESUMOCASA-26-10

> **Superado em 27/10/2026.** Os itens 1 e 2 da seção 4 (desativar o Google e `DMANDA_LOGIN_GOOGLE=nao`) foram resolvidos: o Google foi desativado no painel e o botão passou a ficar oculto por padrão, sem variável. O estado corrente está no topo de `SINCRONIZA-PROJETINHO.md`.

Resumo para continuar o Dmanda em casa, exatamente de onde parei no computador do trabalho em 26/10/2026. Sem senhas, chaves nem dados reais (nada disso vai para o Git).

## 1. Onde está o código

- Repositório: https://github.com/edermoliveira/Dmanda.git (privado).
- Branch: `checkpoint/2026-10-23-ajustes-a-d`. Sem merge na main, sem force push.
- Depois de baixar, confira que o último commit de código é `51368b7` (ou posterior, que só terá este resumo).

## 2. Primeiros passos em casa

No PowerShell, na pasta do projeto:

```
git fetch origin
git checkout checkpoint/2026-10-23-ajustes-a-d
git pull origin checkpoint/2026-10-23-ajustes-a-d
npm ci
```

Depois, no `.env.local` de casa (arquivo que nunca vai para o Git), **mude ou acrescente a linha `DMANDA_LOGIN_GOOGLE=nao`**, para esconder o botão do Google. No computador do trabalho isso já foi feito.

Para conferir o ambiente sem mostrar valores: `npm run conferir:env`. Para subir a aplicação: `npm run dev` e abrir http://localhost:7100/login (use um `next dev` por vez; ele usa o Supabase real).

Em casa, a CLI do Supabase já estava vinculada ao projeto `gmxoosvgfcydccyeudej`. Se a CLI pedir login, rode `npx supabase login` e `npx supabase link --project-ref gmxoosvgfcydccyeudej`.

## 3. O que está feito e provado no Supabase real

- **Migrações 6 e 7 aplicadas** (histórico remoto 7 de 7), depois de dry-run, sem reset e sem reaplicar as cinco anteriores. Nada a aplicar em casa.
- **Senha já definida** no usuário existente. Ela vale para qualquer computador (está no Supabase, não no `.env.local`). Não precisa rodar `definir:senha` de novo.
- **Entrada por e-mail e senha: 19 de 19 verificações**, com a senha digitada por você: mesmo usuário e identificador, senha incorreta recusada, demanda TESTE com tarefas criada, editada, recarregada e removida, edição simultânea recusada, Sair e nova entrada. Páginas, exportação e operações sem sessão são barradas (16 de 16).
- **Perda de tarefas corrigida (migração 7):** cada demanda tem uma versão; salvar uma janela desatualizada é recusado por inteiro (código `DM409`), com aviso fixo, a edição local preservada e Salvar bloqueado. Sem tela de mesclagem.
- Testes locais: `testar:banco` 118, `testar:app` 69, `testar:regras` 25 (todos passaram). `tsc`, `eslint` e `build` passaram.
- O banco real tem **0 demandas e 0 tarefas** e 1 usuário. A prova usou registros TESTE, removidos no fim.

## 4. O que falta (nesta ordem)

1. **Desativar o provedor Google no painel do Supabase** (Authentication > Sign In / Providers > Google). Não exclua usuário, identidade nem o projeto do Google Cloud. O botão já está oculto, mas ocultar não substitui desligar.
2. **Avisar o Claude: "Google desligado".** Ele roda `npm run conferir:env`, confirma que o painel reflete isso e que a entrada por senha continua funcionando.
3. **Decidir** o destino privado das cópias dos dados (pasta privada do Drive ou OneDrive pessoal, ou pendrive) e a frequência.
4. **Decidir** o enquadramento do plano Hobby da Vercel (uso pessoal e não comercial) para o uso no trabalho.
5. **Publicar na Vercel** (passos em `supabase/LEIA-ME.md`, seção "Publicação na Vercel"): variáveis de ambiente, incluindo `DMANDA_LOGIN_GOOGLE=nao`, e o agendamento da rotina diária. Nada foi publicado nem contratado ainda.
6. **Avaliar** a aplicação publicada (Issue #2), inclusive a PWA no iPhone e no iPad.
7. Opcional: autorizar uma demonstração da restauração da cópia no projeto real, com dados TESTE.

## 5. Limitações conhecidas

- Intermitência do `testar:sessao` com causa desconhecida (19 execuções seguidas sem falha desde a mudança; não repetida porque a área não mudou).
- A proteção contra edição simultânea cobre o salvamento da janela de edição. Mover etapa, marcar tarefa e arquivar seguem "o último a gravar vence" por campo.
- O cookie `dmanda-ultimo-uso` não é assinado, então a proteção de aparelho esquecido (sessão de 6 h) não é inviolável.
- A restauração da cópia só foi testada em banco local.
- O Supabase avisa que a proteção contra senhas vazadas está desligada (exige plano pago, não contratado).
- PowerShell 7 e outros terminais não foram testados. Expiração de 6 h real, Vercel e primeira execução automática ainda não foram validadas no real.
- A aplicação React segue sem aprovação visual sua.

## 6. Regras que continuam valendo

- Nunca pedir nem enviar senha, chave ou conteúdo do `.env.local` pelo chat, por comando visível, log ou Git.
- Não excluir o usuário, a identidade existente nem o projeto Google Cloud. Sem `db reset`, sem reaplicar migrações antigas, sem mexer em outros projetos.
- Não publicar na Vercel nem contratar plano sem decisão sua. Commits e pushes só na branch de checkpoint, com conferência do hash no remoto (`git ls-remote origin refs/heads/checkpoint/2026-10-23-ajustes-a-d`). Sem merge na main e sem force push.
- O percentual de andamento (18%) não substitui os marcos acima.

## 7. Onde ler mais

- `AUDITORIA.md`, seção 15: conclusão da validação no Supabase real.
- `SINCRONIZA-PROJETINHO.md`: ponto de retomada no topo.
- `supabase/LEIA-ME.md`: Supabase, entrada por senha, sessão de 6 h, Vercel e cópias.
- `DECISOES.md`: itens 11 (edição simultânea) e 13 (desligamento do Google).

## 8. Prompt sugerido para retomar em casa

> Estou em casa, na branch `checkpoint/2026-10-23-ajustes-a-d`. Leia `RESUMOCASA-26-10.md` e o topo de `SINCRONIZA-PROJETINHO.md`. Já desativei o Google no painel do Supabase (ou: ainda vou desativar). Rode `npm run conferir:env` sem mostrar valores, confirme que a entrada por senha segue funcionando e conduza o próximo passo para a publicação na Vercel. Não peça senhas nem chaves no chat, não publique e não contrate nada sem eu decidir.

Sugestão de modelo para o próximo bloco: Sonnet 5.5 com effort médio.

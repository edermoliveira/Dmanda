# Dmanda

Painel pessoal de demandas do Secretário de Administração da Prefeitura de Taquara/RS. Reúne Início, Entradas, Demandas, Agenda, Documentos, IA e Configurações, para não esquecer demandas, acompanhar o que está em outro setor e ver prazos (legal e próprio) com poucos campos. Usuário único. Funciona no celular, iPad e computador.

## Estado

- **Design:** Catalyst único (claro e escuro), aprovado no protótipo em `prototipo/`.
- **Aplicação funcional** (Next.js 16, React 19, Supabase) em `src/`: núcleo de Demandas e tarefas pronto e testado no banco local de teste, com rotina diária na nuvem preparada. As demais áreas ainda não foram construídas.
- **Supabase real:** projeto criado e migrado (7 migrações aplicadas), segurança do banco validada, login Google real validado em 25/10/2026 e, em 26/10/2026, **entrada por e-mail e senha validada no mesmo usuário** e a proteção contra perda de tarefas na edição simultânea. O botão do Google está oculto; desativar o provedor no painel é ação do usuário. **Ainda não validado no real:** publicação na Vercel e a primeira execução automática da rotina. Ver `AUDITORIA.md`.

## Como rodar

```
npm install        (só na primeira vez)
npm run dev:teste  (aplicação em http://localhost:7100 com banco local descartável, sem Supabase)
npm run dev        (aplicação em http://localhost:7100 com o Supabase real, exige .env.local)
```

Protótipo de referência (HTML puro, dados fictícios): dentro de `prototipo`, `python -m http.server 7200 --bind 127.0.0.1` e http://127.0.0.1:7200.

Variáveis: copiar `.env.example` para `.env.local` e preencher (nunca vai para o Git). Passos do Supabase e da Vercel em `supabase/LEIA-ME.md`.

## Testes

`npm run testar:banco`, `npm run testar:regras`, `npm run testar:app`, `npm run testar:sessao` (veja o `CLAUDE.md` para o que cada um cobre e as limitações).

## Documentos

Comece por `CLAUDE.md` (regras e estado do projeto) e `DECISOES.md` (decisões mais recentes). O que aguarda o usuário está em `PENDENCIAS.md` e a retomada em `SINCRONIZA-PROJETINHO.md`.

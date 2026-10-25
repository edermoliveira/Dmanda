import type { Metadata } from "next";
import { CalendarClock, CalendarDays, TriangleAlert } from "lucide-react";
import { BotaoTema } from "@/components/BotaoTema";
import { Icone } from "@/components/Icone";
import { NavPaginas } from "@/components/NavPaginas";
import { ValorCor } from "@/components/ValorCor";

export const metadata: Metadata = { title: "Tokens | Dmanda" };

type Cor = { nome: string; papel: string; variavel: string; classe: string };

// As classes ficam escritas por inteiro para o Tailwind encontrá-las.
const grupos: { titulo: string; cores: Cor[] }[] = [
  {
    titulo: "Fundo",
    cores: [
      { nome: "fundo", papel: "Fundo da página", variavel: "--c-fundo", classe: "bg-fundo" },
      { nome: "brilho-a", papel: "Luz suave do fundo (canto superior)", variavel: "--c-brilho-a", classe: "bg-brilho-a" },
      { nome: "brilho-b", papel: "Luz suave do fundo (canto inferior)", variavel: "--c-brilho-b", classe: "bg-brilho-b" },
    ],
  },
  {
    titulo: "Superfície",
    cores: [
      { nome: "superficie", papel: "Cards, menus e campos", variavel: "--c-superficie", classe: "bg-superficie" },
      { nome: "borda", papel: "Linhas e contornos", variavel: "--c-borda", classe: "bg-borda" },
    ],
  },
  {
    titulo: "Texto",
    cores: [
      { nome: "texto", papel: "Títulos e textos", variavel: "--c-texto", classe: "bg-texto" },
      { nome: "texto-suave", papel: "Detalhes e textos de apoio", variavel: "--c-texto-suave", classe: "bg-texto-suave" },
    ],
  },
  {
    titulo: "Destaque",
    cores: [
      { nome: "destaque", papel: "Botão principal, item ativo, hoje", variavel: "--c-destaque", classe: "bg-destaque" },
      { nome: "destaque-forte", papel: "Destaque usado como texto ou link", variavel: "--c-destaque-forte", classe: "bg-destaque-forte" },
      { nome: "sobre-destaque", papel: "Texto escrito em cima do destaque", variavel: "--c-sobre-destaque", classe: "bg-sobre-destaque" },
    ],
  },
  {
    titulo: "Perigo",
    cores: [
      { nome: "perigo", papel: "Atrasado e crítico (único uso de vermelho)", variavel: "--c-perigo", classe: "bg-perigo" },
      { nome: "perigo-suave", papel: "Fundo de avisos de perigo", variavel: "--c-perigo-suave", classe: "bg-perigo-suave" },
      { nome: "sobre-perigo", papel: "Texto escrito em cima do perigo", variavel: "--c-sobre-perigo", classe: "bg-sobre-perigo" },
    ],
  },
];

const espacos = [
  { nome: "mini", px: 4, classe: "w-mini" },
  { nome: "pequeno", px: 8, classe: "w-pequeno" },
  { nome: "medio", px: 12, classe: "w-medio" },
  { nome: "normal", px: 16, classe: "w-normal" },
  { nome: "grande", px: 24, classe: "w-grande" },
  { nome: "enorme", px: 32, classe: "w-enorme" },
  { nome: "gigante", px: 48, classe: "w-gigante" },
  { nome: "maximo", px: 64, classe: "w-maximo" },
];

const cantos = [
  { nome: "pequeno", px: "8 px", classe: "rounded-pequeno", uso: "Detalhes pequenos" },
  { nome: "medio", px: "12 px", classe: "rounded-medio", uso: "Campos de texto" },
  { nome: "card", px: "24 px", classe: "rounded-card", uso: "Cards e janelas" },
  { nome: "pilula", px: "total", classe: "rounded-pilula", uso: "Botões e etiquetas" },
];

const cartao = "rounded-card border border-borda bg-superficie/80 p-grande shadow-card";

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-normal">
      <h2 className="text-subtitulo">{titulo}</h2>
      {children}
    </section>
  );
}

export default function Tokens() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-gigante p-normal py-enorme sm:p-enorme">
      <header className="flex flex-wrap items-start justify-between gap-normal">
        <div>
          <h1 className="text-titulo">Tokens do Dmanda</h1>
          <p className="mt-pequeno text-texto-suave">
            Cores, fontes, espaços e cantos. Tudo que aparece nas telas vem daqui.
          </p>
        </div>
        <BotaoTema />
      </header>
      <NavPaginas />

      <Secao titulo="Cores (mudam com o tema)">
        <div className="grid gap-grande sm:grid-cols-2">
          {grupos.map((g) => (
            <div key={g.titulo} className={`${cartao} flex flex-col gap-medio`}>
              <h3 className="text-texto-suave">{g.titulo}</h3>
              {g.cores.map((c) => (
                <div key={c.nome} className="flex items-center gap-medio">
                  <span className={`${c.classe} size-gigante shrink-0 rounded-medio border border-borda`} />
                  <div className="min-w-0">
                    <div className="font-bold">{c.nome}</div>
                    <div className="text-detalhe text-texto-suave">{c.papel}</div>
                    <div className="font-mono text-detalhe text-texto-suave">
                      <ValorCor variavel={c.variavel} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Fontes">
        <div className={`${cartao} flex flex-col gap-grande`}>
          <div>
            <div className="font-mono text-detalhe text-texto-suave">Averia Serif Livre Bold · título</div>
            <h1 className="text-titulo">Bom dia, Secretário</h1>
          </div>
          <div>
            <div className="font-mono text-detalhe text-texto-suave">Averia Serif Livre Bold · título de seção</div>
            <h2 className="text-subtitulo">Minhas demandas</h2>
          </div>
          <div>
            <div className="font-mono text-detalhe text-texto-suave">Averia Serif Livre Regular · subtítulo</div>
            <h3 className="text-subtitulo">Você tem 3 demandas pedindo atenção hoje.</h3>
          </div>
          <div>
            <div className="font-mono text-detalhe text-texto-suave">Averia Serif Livre Regular · texto</div>
            <p>O memorando foi enviado à PGM e aguarda retorno há 12 dias.</p>
          </div>
          <div>
            <div className="font-mono text-detalhe text-texto-suave">IBM Plex Mono Regular · detalhes</div>
            <p className="font-mono text-detalhe">Processo 0457/2026 · prazo legal · TCE</p>
          </div>
        </div>
      </Secao>

      <div className="grid gap-gigante md:grid-cols-2">
        <Secao titulo="Espaços">
          <div className={`${cartao} flex flex-col gap-medio`}>
            {espacos.map((e) => (
              <div key={e.nome} className="flex items-center gap-normal">
                <span className="w-24 font-mono text-detalhe">{e.nome}</span>
                <span className="w-12 font-mono text-detalhe text-texto-suave">{e.px} px</span>
                <span className={`${e.classe} h-pequeno rounded-pilula bg-destaque`} />
              </div>
            ))}
          </div>
        </Secao>

        <Secao titulo="Cantos">
          <div className={`${cartao} grid grid-cols-2 gap-normal`}>
            {cantos.map((c) => (
              <div key={c.nome} className="flex flex-col gap-pequeno">
                <span className={`${c.classe} h-maximo border-2 border-destaque-forte bg-destaque/20`} />
                <span className="font-mono text-detalhe">{c.nome} · {c.px}</span>
                <span className="text-detalhe text-texto-suave">{c.uso}</span>
              </div>
            ))}
          </div>
        </Secao>
      </div>

      <Secao titulo="Exemplo: como fica na tela do dia">
        <div className="grid gap-normal sm:grid-cols-3">
          <div className={`${cartao} flex items-center gap-normal`}>
            <span className="grid size-gigante place-items-center rounded-pilula bg-perigo font-bold text-sobre-perigo"><Icone icone={TriangleAlert} /></span>
            <div>
              <div className="text-titulo font-bold leading-none">1</div>
              <div className="text-texto-suave">Atrasadas</div>
            </div>
          </div>
          <div className={`${cartao} flex items-center gap-normal`}>
            <span className="grid size-gigante place-items-center rounded-pilula bg-destaque font-bold text-sobre-destaque"><Icone icone={CalendarClock} /></span>
            <div>
              <div className="text-titulo font-bold leading-none">2</div>
              <div className="text-texto-suave">Para hoje</div>
            </div>
          </div>
          <div className={`${cartao} flex items-center gap-normal`}>
            <span className="grid size-gigante place-items-center rounded-pilula bg-texto font-bold text-fundo"><Icone icone={CalendarDays} /></span>
            <div>
              <div className="text-titulo font-bold leading-none">2</div>
              <div className="text-texto-suave">Próximos 7 dias</div>
            </div>
          </div>
        </div>

        <div className={`${cartao} flex flex-col gap-medio`}>
          <h3 className="font-bold text-perigo">ATRASADAS 1</h3>
          <div className="flex items-center gap-normal rounded-medio border border-borda bg-superficie p-normal">
            <span className="size-grande shrink-0 rounded-pilula border-2 border-borda" />
            <div className="min-w-0 flex-1">
              <div className="font-bold">Resposta ao pedido do TCE</div>
              <div className="font-mono text-detalhe text-texto-suave">0457/2026 · prazo legal · TCE</div>
            </div>
            <span className="rounded-pilula bg-perigo px-medio py-mini font-mono text-detalhe text-sobre-perigo">Ontem</span>
          </div>
          <h3 className="font-bold text-texto-suave">HOJE 1</h3>
          <div className="flex items-center gap-normal rounded-medio border border-borda bg-superficie p-normal">
            <span className="size-grande shrink-0 rounded-pilula border-2 border-borda" />
            <div className="min-w-0 flex-1">
              <div className="font-bold">Parecer sobre aluguel</div>
              <div className="font-mono text-detalhe text-texto-suave">1120/2026 · Gabinete</div>
            </div>
            <span className="rounded-pilula bg-destaque px-medio py-mini font-mono text-detalhe text-sobre-destaque">Hoje</span>
          </div>
        </div>
      </Secao>

      <Secao titulo="Botões e campos">
        <div className={`${cartao} flex flex-col gap-grande`}>
          <div className="flex flex-wrap gap-normal">
            <button type="button" className="rounded-pilula bg-destaque px-grande py-medio font-bold text-sobre-destaque cursor-pointer">Salvar demanda</button>
            <button type="button" className="rounded-pilula border border-borda bg-superficie px-grande py-medio font-bold text-texto cursor-pointer">Cancelar</button>
            <button type="button" className="rounded-pilula bg-perigo px-grande py-medio font-bold text-sobre-perigo cursor-pointer">Excluir</button>
            <a href="#" className="self-center font-bold text-destaque-forte underline">Link de destaque</a>
          </div>
          <label className="flex flex-col gap-pequeno">
            <span className="text-detalhe text-texto-suave">Assunto</span>
            <input
              type="text"
              placeholder="O que é, em poucas palavras"
              className="rounded-medio border border-borda bg-superficie px-normal py-medio text-texto placeholder:text-texto-suave"
            />
          </label>
        </div>
      </Secao>
    </main>
  );
}

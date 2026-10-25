"use client";

import { useState, type ReactNode } from "react";
import {
  Archive,
  CalendarClock,
  CalendarDays,
  Check,
  CircleAlert,
  EllipsisVertical,
  Inbox,
  LoaderCircle,
  Moon,
  Pencil,
  Plus,
  Search,
  Sun,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Botao } from "@/components/Botao";
import { BotaoTema } from "@/components/BotaoTema";
import { Campo } from "@/components/Campo";
import { Etiqueta } from "@/components/Etiqueta";
import { Icone } from "@/components/Icone";
import { Janela, JanelaConteudo } from "@/components/Janela";
import { Menu, MenuLista, type ItemMenu } from "@/components/Menu";
import { NavPaginas } from "@/components/NavPaginas";

const cartao = "rounded-card border border-borda bg-superficie/80 p-grande shadow-card";
const grade = "grid gap-grande grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]";
const gradeLarga = "grid gap-grande grid-cols-[repeat(auto-fit,minmax(17rem,1fr))]";

function Secao({ titulo, texto, children }: { titulo: string; texto: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-normal">
      <div>
        <h2 className="text-subtitulo">{titulo}</h2>
        <p className="text-texto-suave">{texto}</p>
      </div>
      <div className={`${cartao} flex flex-col gap-grande`}>{children}</div>
    </section>
  );
}

function Estado({ nome, children }: { nome: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-pequeno">
      <span className="font-mono text-detalhe text-texto-suave">{nome}</span>
      {children}
    </div>
  );
}

const iconesUsados = [
  { nome: "Plus", icone: Plus },
  { nome: "Check", icone: Check },
  { nome: "X", icone: X },
  { nome: "Search", icone: Search },
  { nome: "Pencil", icone: Pencil },
  { nome: "Archive", icone: Archive },
  { nome: "Trash2", icone: Trash2 },
  { nome: "Inbox", icone: Inbox },
  { nome: "CalendarDays", icone: CalendarDays },
  { nome: "CalendarClock", icone: CalendarClock },
  { nome: "EllipsisVertical", icone: EllipsisVertical },
  { nome: "CircleAlert", icone: CircleAlert },
  { nome: "TriangleAlert", icone: TriangleAlert },
  { nome: "LoaderCircle", icone: LoaderCircle },
  { nome: "Sun", icone: Sun },
  { nome: "Moon", icone: Moon },
];

const itensMenuEstados: ItemMenu[] = [
  { id: "editar", rotulo: "Editar (normal)", icone: Pencil },
  { id: "arquivar", rotulo: "Arquivar (foco)", icone: Archive, foco: true },
  { id: "mover", rotulo: "Mover (desativado)", icone: Inbox, desativado: true },
  { id: "salvar", rotulo: "Salvando (carregando)", icone: Check, carregando: true },
  { id: "excluir", rotulo: "Excluir (erro)", icone: Trash2, perigo: true, erro: "Não foi possível excluir." },
];

const itensMenuReal: ItemMenu[] = [
  { id: "editar", rotulo: "Editar", icone: Pencil },
  { id: "arquivar", rotulo: "Arquivar", icone: Archive },
  { id: "excluir", rotulo: "Excluir", icone: Trash2, perigo: true },
];

export function Vitrine() {
  const [janelaAberta, setJanelaAberta] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [escolhido, setEscolhido] = useState("nenhum");

  function salvarJanela() {
    setSalvando(true);
    setTimeout(() => {
      setSalvando(false);
      setJanelaAberta(false);
    }, 1500);
  }

  const rodapeNormal = (
    <>
      <Botao variante="secundario">Cancelar</Botao>
      <Botao icone={Check}>Salvar</Botao>
    </>
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-gigante p-normal py-enorme sm:p-enorme">
      <header className="flex flex-wrap items-start justify-between gap-normal">
        <div>
          <h1 className="text-titulo">Peças do Dmanda</h1>
          <p className="mt-pequeno text-texto-suave">
            Botão, campo, janela, menu, avatar e etiqueta, cada um com os cinco estados.
          </p>
        </div>
        <BotaoTema />
      </header>
      <NavPaginas />

      <Secao titulo="Botão" texto="Três variantes. O estado de erro avisa que a ação falhou.">
        <div className={grade}>
          <Estado nome="normal"><Botao icone={Plus}>Nova demanda</Botao></Estado>
          <Estado nome="foco"><Botao icone={Plus} data-foco="true">Nova demanda</Botao></Estado>
          <Estado nome="desativado"><Botao icone={Plus} disabled>Nova demanda</Botao></Estado>
          <Estado nome="carregando"><Botao carregando>Salvando</Botao></Estado>
          <Estado nome="erro"><Botao erro>Tentar de novo</Botao></Estado>
        </div>
        <div className="flex flex-wrap gap-normal border-t border-borda pt-grande">
          <Botao variante="primario" icone={Check}>Primário</Botao>
          <Botao variante="secundario" icone={Pencil}>Secundário</Botao>
          <Botao variante="perigo" icone={Trash2}>Perigo</Botao>
        </div>
      </Secao>

      <Secao titulo="Campo" texto="Rótulo sempre visível. A mensagem de erro aparece embaixo do próprio campo.">
        <div className={grade}>
          <Estado nome="normal">
            <Campo rotulo="Número" placeholder="0457/2026" ajuda="Número do processo ou memorando" className="w-full" />
          </Estado>
          <Estado nome="foco">
            <Campo rotulo="Número" placeholder="0457/2026" data-foco="true" className="w-full" />
          </Estado>
          <Estado nome="desativado">
            <Campo rotulo="Número" defaultValue="0457/2026" disabled className="w-full" />
          </Estado>
          <Estado nome="carregando">
            <Campo rotulo="Buscar" icone={Search} defaultValue="TCE" carregando ajuda="Buscando..." className="w-full" />
          </Estado>
          <Estado nome="erro">
            <Campo rotulo="Prazo" defaultValue="31/02" erro="Essa data não existe." className="w-full" />
          </Estado>
        </div>
      </Secao>

      <Secao titulo="Janela" texto="A janela de verdade usa o dialog do navegador: prende o foco, fecha com Esc e com clique fora.">
        <div className={gradeLarga}>
          <Estado nome="normal">
            <JanelaConteudo titulo="Arquivar demanda" rodape={rodapeNormal}>
              <p>Ela sai do quadro e vai para o Arquivo.</p>
            </JanelaConteudo>
          </Estado>
          <Estado nome="foco">
            <JanelaConteudo titulo="Arquivar demanda" focoNoFechar rodape={rodapeNormal}>
              <p>Ela sai do quadro e vai para o Arquivo.</p>
            </JanelaConteudo>
          </Estado>
          <Estado nome="desativado">
            <JanelaConteudo
              titulo="Arquivar demanda"
              rodape={
                <>
                  <Botao variante="secundario" disabled>Cancelar</Botao>
                  <Botao icone={Check} disabled>Salvar</Botao>
                </>
              }
            >
              <p className="text-texto-suave">Aguarde, esta ação está indisponível.</p>
            </JanelaConteudo>
          </Estado>
          <Estado nome="carregando">
            <JanelaConteudo
              titulo="Arquivar demanda"
              carregando
              rodape={
                <>
                  <Botao variante="secundario">Cancelar</Botao>
                  <Botao carregando>Salvando</Botao>
                </>
              }
            >
              <p>Arquivando...</p>
            </JanelaConteudo>
          </Estado>
          <Estado nome="erro">
            <JanelaConteudo titulo="Arquivar demanda" erro="Não foi possível arquivar. Tente de novo." rodape={rodapeNormal}>
              <p>Ela sai do quadro e vai para o Arquivo.</p>
            </JanelaConteudo>
          </Estado>
        </div>
        <div className="flex flex-wrap items-center gap-normal border-t border-borda pt-grande">
          <Botao variante="secundario" onClick={() => setJanelaAberta(true)}>Abrir janela de verdade</Botao>
          <span className="text-texto-suave">Teste o Esc, o Tab e o clique fora.</span>
        </div>
        <Janela
          aberta={janelaAberta}
          aoFechar={() => setJanelaAberta(false)}
          titulo="Arquivar demanda"
          carregando={salvando}
          rodape={
            <>
              <Botao variante="secundario" disabled={salvando} onClick={() => setJanelaAberta(false)}>Cancelar</Botao>
              <Botao icone={Check} carregando={salvando} onClick={salvarJanela}>
                {salvando ? "Salvando" : "Salvar"}
              </Botao>
            </>
          }
        >
          <p>Ela sai do quadro e vai para o Arquivo.</p>
        </Janela>
      </Secao>

      <Secao titulo="Menu" texto="Cada item mostra um estado. O menu de verdade abre com clique e navega com as setas.">
        <div className="grid gap-grande md:grid-cols-2">
          <Estado nome="itens: normal, foco, desativado, carregando e erro">
            <MenuLista itens={itensMenuEstados} />
          </Estado>
          <Estado nome="menu de verdade">
            <Menu rotulo="Mais ações" itens={itensMenuReal} aoEscolher={setEscolhido} />
            <p className="text-detalhe text-texto-suave">
              Último item escolhido: <span className="font-mono">{escolhido}</span>
            </p>
          </Estado>
        </div>
      </Secao>

      <Secao titulo="Avatar" texto="Iniciais sobre o destaque. O erro troca as iniciais por um aviso.">
        <div className={grade}>
          <Estado nome="normal"><Avatar nome="Secretário de Administração" tamanho="grande" /></Estado>
          <Estado nome="foco"><Avatar nome="Secretário de Administração" tamanho="grande" interativo data-foco="true" /></Estado>
          <Estado nome="desativado"><Avatar nome="Secretário de Administração" tamanho="grande" interativo desativado /></Estado>
          <Estado nome="carregando"><Avatar nome="Secretário de Administração" tamanho="grande" carregando /></Estado>
          <Estado nome="erro"><Avatar nome="Secretário de Administração" tamanho="grande" erro /></Estado>
        </div>
        <div className="flex items-center gap-normal border-t border-borda pt-grande">
          <Avatar nome="Secretário de Administração" />
          <Avatar nome="Secretário de Administração" tamanho="grande" />
          <span className="text-detalhe text-texto-suave">dois tamanhos: normal (32 px) e grande (48 px)</span>
        </div>
      </Secao>

      <Secao titulo="Etiqueta" texto="Marca curta em fonte mono. Pode ser só informação ou um botão.">
        <div className={grade}>
          <Estado nome="normal"><Etiqueta tom="destaque" icone={CalendarClock}>Hoje</Etiqueta></Estado>
          <Estado nome="foco"><Etiqueta tom="destaque" icone={CalendarClock} interativa data-foco="true">Hoje</Etiqueta></Estado>
          <Estado nome="desativado"><Etiqueta tom="destaque" icone={CalendarClock} interativa desativada>Hoje</Etiqueta></Estado>
          <Estado nome="carregando"><Etiqueta carregando>Atualizando</Etiqueta></Estado>
          <Estado nome="erro"><Etiqueta erro>Falhou</Etiqueta></Estado>
        </div>
        <div className="flex flex-wrap gap-medio border-t border-borda pt-grande">
          <Etiqueta>Prazo próprio</Etiqueta>
          <Etiqueta tom="destaque">Hoje</Etiqueta>
          <Etiqueta tom="perigo" icone={TriangleAlert}>Atrasada 3 d</Etiqueta>
          <Etiqueta icone={Inbox}>Processo</Etiqueta>
        </div>
      </Secao>

      <Secao titulo="Ícones" texto="Só Lucide, todos com 20 px (size-icone) e traço 2. Nunca outro tamanho nem outra biblioteca.">
        <div className="grid gap-normal grid-cols-[repeat(auto-fill,minmax(8rem,1fr))]">
          {iconesUsados.map((i) => (
            <div key={i.nome} className="flex items-center gap-medio">
              <Icone icone={i.icone} />
              <span className="font-mono text-detalhe text-texto-suave">{i.nome}</span>
            </div>
          ))}
        </div>
      </Secao>
    </main>
  );
}

"use client";

import { useSyncExternalStore } from "react";

// Mostra o valor atual (do tema ativo) de uma cor da paleta, só para consulta na página /tokens.

function assinar(aoMudar: () => void) {
  const observador = new MutationObserver(aoMudar);
  observador.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-tema"],
  });
  return () => observador.disconnect();
}

export function ValorCor({ variavel }: { variavel: string }) {
  const valor = useSyncExternalStore(
    assinar,
    () =>
      getComputedStyle(document.documentElement)
        .getPropertyValue(variavel)
        .trim()
        .toUpperCase(),
    () => "",
  );
  return <span>{valor}</span>;
}

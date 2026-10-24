# Ícones do menu de navegação

- **Fonte:** Ionicons 8.0.13, variante outline, https://ionic.io/ionicons (MIT, Copyright (c) 2015-present Ionic). Licença em `LICENSE-MIT.txt` nesta pasta.
- **Originais e mapeamento (referência):** `imagens/figma-kit/icones/` (SVGs, PNGs de conferência e `dmanda__mapeamento-icones.md`). Escolha feita pelo usuário.
- **Uso em execução:** `node gerar.mjs` (nesta pasta) lê os 7 SVGs e gera `../icones-nav.js`, que o `index.html` carrega. O SVG entra dentro da página para herdar `currentColor`.
- **Mapeamento:** Início = home, Entradas = file-tray-full, Demandas = clipboard, Agenda = today, Documentos = document-text, IA = bulb, Configurações = settings.
- Os demais ícones do aplicativo continuam com Iconoir e Lucide até haver seleção para o restante.

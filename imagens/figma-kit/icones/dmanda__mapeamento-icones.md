# Dmanda — mapeamento de ícones de navegação

Fonte: Ionicons 8.0.13, variante outline (https://ionic.io/ionicons). Licença MIT, Copyright (c) 2015-present Ionic. Arquivo de licença: ionicons-8.0.13__LICENSE-MIT.txt.
Os ícones NÃO são símbolos da Apple. O kit "iOS and iPadOS 27 (Community)" do Figma foi inspecionado e não oferece ícones isolados (os símbolos são glifos de texto SF sem nome legível, com marcadores genéricos nos componentes).

| Menu | Símbolo (nome exato) | SVG | PNG 2x (48x48, transparente) |
|---|---|---|---|
| Início | home-outline | inicio__home-outline__outline.svg | inicio__home-outline__outline@2x.png |
| Entradas | file-tray-full-outline | entradas__file-tray-full-outline__outline.svg | entradas__file-tray-full-outline__outline@2x.png |
| Demandas | clipboard-outline | demandas__clipboard-outline__outline.svg | demandas__clipboard-outline__outline@2x.png |
| Agenda | today-outline | agenda__today-outline__outline.svg | agenda__today-outline__outline@2x.png |
| Documentos | document-text-outline | documentos__document-text-outline__outline.svg | documentos__document-text-outline__outline@2x.png |
| IA | bulb-outline | ia__bulb-outline__outline.svg | ia__bulb-outline__outline@2x.png |
| Configurações | settings-outline | configuracoes__settings-outline__outline.svg | configuracoes__settings-outline__outline@2x.png |

Referência de origem de cada ícone: https://ionic.io/ionicons (busca pelo nome) e SVG oficial em https://unpkg.com/ionicons@8.0.13/dist/svg/<nome>.svg

## Notas para implementação
- Os SVGs são os originais do Ionicons, sem alteração (viewBox 512x512, traço currentColor, largura 32). Herdam a cor do tema claro e escuro.
- Nenhum dos 7 ícones escolhidos tem elementos sem cor própria: nenhum exige fill: currentColor.
- Os PNGs são só de conferência (traço preto, fundo transparente). No app, usar o SVG.
- Pontos a verificar no app: legibilidade da clipboard-outline a 22 px com o menu recolhido; se o bulb-outline comunica "IA" sem o rótulo.
- Destino efetivo dos arquivos: não confirmado (o navegador baixa em Downloads). Mover para C:\Users\Éder\Desktop\Dmanda\imagens\figma-kit\icones\.
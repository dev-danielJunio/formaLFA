# Forma — Laboratório de Autômatos

## Executar

Requer Node.js 22 ou superior e npm.

```sh
npm ci
npm run dev
```

Abra o endereço que o Vite informar. Para a versão de produção:

```sh
npm run build
npm run preview
```

`npm test` executa a suíte. `npm run format` formata o código. A pasta `dist/` incluída na entrega pode ser servida por qualquer servidor HTTP estático; não abra seu HTML diretamente com `file://`.

O projeto fixa `esbuild` como um alias de `esbuild-wasm` porque o executável nativo teve problemas ao resolver diretórios no ambiente Windows restrito usado para desenvolver este MVP. O lockfile conserva uma instalação reproduzível; não há alteração de dependências após a instalação.

## 1. Modelo e histórico

`src/model.ts` define:

```ts
type StateNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  initial: boolean;
  final: boolean;
};
type Edge = {
  id: string;
  source: string;
  target: string;
  symbols: string[];
  curve?: { along: number; normal: number };
  loop?: { angle: number; size: number };
};
type Note = { id: string; text: string; x: number; y: number };
type Automaton = {
  version: 1;
  title: string;
  mode: "AFD" | "AFN";
  nodes: StateNode[];
  edges: Edge[];
  notes: Note[];
};
```

IDs são independentes dos nomes. `ε` é reservado para a transição vazia. Uma aresta pode agrupar vários símbolos. O alfabeto é derivado das arestas, excluindo `ε`.

`src/store.ts` mantém `doc`, `past`, `future`, `selection` e `revision`. Toda operação persistente passa por `commit`: clona o documento, aplica a mudança, guarda o anterior e limpa o redo. Ações sem alteração não geram histórico. Há um limite de 100 ações.

Um arraste não altera o documento a cada pixel: seu deslocamento fica no estado temporário do canvas e é aplicado apenas ao soltar. Assim, mover um grupo inteiro exige só um Ctrl+Z para desfazer. Excluir estados também exclui suas arestas incidentes; o undo restaura o conjunto. Seleção, zoom, pan e execução do simulador não entram no histórico do documento.

## 2. Canvas e conexão por arraste

`src/components/Canvas.tsx` implementa uma máquina de gestos discriminada: `move`, `connect`, `curve`, `marquee` ou `pan`. `Diagram.tsx` desenha o documento sem cuidar dos eventos. `geometry.ts` compartilha a geometria entre a tela e os arquivos exportados.

O fluxo de conexão é:

1. `pointerdown` em uma das quatro âncoras armazena o ID de origem e chama `setPointerCapture` no SVG.
2. `pointermove` atualiza apenas a curva provisória. A posição do ponteiro é convertida com a inversa de `getScreenCTM()`, respeitando o zoom, o pan e o redimensionamento.
3. `pointerup` procura o estado sob as coordenadas finais. Não utiliza `event.target`, pois a captura mantém o evento no SVG.
4. Se o destino é válido e houve deslocamento, a linha aparece imediatamente com um campo focado sobre o rótulo. Origem igual ao destino cria um loop. Digite `0,1` ou `a, b`; Enter ou clique fora confirma. Esc descarta a edição. A transição e seus símbolos entram juntos no histórico, em uma única ação.
5. `Escape`, `pointercancel` e `lostpointercapture` descartam o gesto provisório. Soltar fora de um destino não cria uma aresta órfã.

Transições em sentidos opostos usam curvas separadas; loops usam Bézier cúbica. Conectar novamente o mesmo par agrupa os símbolos na aresta existente. Áreas transparentes de 18 px facilitam selecionar as linhas.

Arrastar no fundo com o botão esquerdo ou direito cria a seleção retangular. Estados devem caber por inteiro; arestas são verificadas pelos limites reais do grupo SVG, incluindo sua curva e rótulo. As notas são selecionadas pela posição de origem. Arrastar um estado ou nota selecionada move o conjunto, mantendo as arestas ligadas aos estados. Ctrl/Cmd/Shift + clique altera a seleção.

O snap usa grade de 20 unidades e detecta alinhamento próximo a estados não selecionados. Guias horizontais/verticais aparecem durante o movimento. O botão no rodapé permite desativar o snap.

## 3. Matemática do simulador

`src/engine.ts` é puro e independente de React. `src/useSimulation.ts` controla o relógio e o índice atual. `Simulator.tsx` apresenta a fita e os controles.

Para entrada `w = a₁a₂…aₙ`, seja `E(S)` o fecho-ε de um conjunto de estados. O processamento usa:

```text
S₀ = E({q_inicial})
Sᵢ₊₁ = E( união de δ(q, aᵢ₊₁) para todo q em Sᵢ )
aceita ⇔ após consumir toda a entrada, Sₙ ∩ F ≠ ∅
```

O fecho-ε usa uma fila e um conjunto de visitados. Ciclos e loops ε sempre terminam. No AFD, o mesmo algoritmo opera com no máximo um estado ativo; a validação bloqueia ε e saídas ambíguas. Uma transição ausente equivale à rejeição, sem exigir um estado sumidouro explícito. No AFN, qualquer ramo final aceita, mas apenas depois de consumir toda a palavra.

Cada `Frame` guarda o número de símbolos consumidos, o conjunto ativo, as arestas percorridas, o símbolo lido e o resultado. Voltar um passo consulta o frame anterior, sem tentar inverter uma transição não determinística. As transições ε são agrupadas no frame inicial ou no frame do símbolo que as alcançou; não há um clique separado para cada ε.

A entrada vazia é testada deixando o campo em branco. Ela é aceita quando o fecho-ε inicial alcança um estado final. A tokenização usa `Array.from`, portanto um caractere como 😀 ocupa um passo; grafemas compostos por vários code points não são tratados como um único símbolo.

O primeiro avanço prepara o frame inicial; os seguintes consomem um símbolo por vez. Play parte desse frame, pausa preserva a posição, reset limpa a execução. Alterar o documento ou a entrada invalida a execução anterior.

## Componentes

| Arquivo                                     | Responsabilidade                                                      |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `src/model.ts`                              | Tipos e exemplo inicial                                               |
| `src/store.ts`                              | Documento, seleção e undo/redo                                        |
| `src/geometry.ts`                           | Curvas, loops e rótulos                                               |
| `src/components/Canvas.tsx`                 | Gestos, captura de ponteiro, snap, pan e zoom                         |
| `src/components/Diagram.tsx`                | Renderização SVG e destaques                                          |
| `src/components/TransitionSymbolsInput.tsx` | Edição focada na linha e nas propriedades, com validação ao confirmar |
| `src/components/Inspector.tsx`              | Edição de estados, notas e símbolos                                   |
| `src/engine.ts`                             | Validação, fecho-ε e execução                                         |
| `src/useSimulation.ts`                      | Player e controle temporal                                            |
| `src/components/Simulator.tsx`              | Fita, controles, resultado e histórico de execução                    |
| `src/io.ts`                                 | Importação validada e exportação JSON/SVG/PNG                         |
| `src/App.tsx`                               | Tela, atalhos, tema, importação e menus                               |
| `src/engine.test.ts`                        | Testes matemáticos, de histórico e arquivos                           |

## Arquivos e exportação

JSON mantém o documento inteiro, com versão de formato. O importador valida tipos, IDs duplicados, referências de arestas, coordenadas finitas e limites de tamanho antes de alterar o store. Conteúdo inesperado não é incorporado ao estado. Importações válidas ainda podem representar autômatos matematicamente incompletos; o painel explica o problema antes de simular.

SVG e PNG usam fundo transparente e removem grade, seleção, âncoras e destaques de simulação. Os círculos têm preenchimento branco para legibilidade. PNG desenha as mesmas curvas diretamente em Canvas 2D, em até 2×, limitado a 8192 pixels por dimensão. Os textos são escapados no SVG. A exportação ocorre no próprio navegador e não envia o projeto a um servidor.

## Verificação

Foram aprovados 31 testes automatizados, incluindo 10 casos de símbolos separados por vírgula e 7 de geometria. Um dos testes verifica exaustivamente as 255 palavras binárias de comprimento 0 a 7, comparando o resultado com `endsWith('01')`. A suíte também cobre palavra vazia, Unicode, ciclos ε, ramificações, transições inexistentes, AFD inválido, undo/redo, exclusão de arestas incidentes e importação/exportação.

No navegador foram verificados: aceitação e rejeição; retorno de passo; criação por duplo clique; conexão sem Shift; loop; seleção de 11 elementos; movimento coletivo e desfazer; notas multilinha; tema escuro; e layout em 1440 e 390 pixels, sem rolagem horizontal no tamanho menor. A exportação SVG exibiu confirmação de geração. A última revisão visual/baixamento do PNG foi interrompida por um timeout da ferramenta de navegador; não se afirma que o arquivo PNG final foi baixado e inspecionado.

## Escopo e limites do MVP

- O trabalho vive na memória até ser exportado em JSON. Recarregar a página perde alterações não exportadas.
- Sem login, banco de dados, colaboração, cobrança ou biblioteca de projetos em nuvem.
- Entrada limitada a 500 unidades UTF-16 no campo. Importação: até 2 MB, 500 estados, 3000 arestas e 500 notas.
- Símbolos separados por vírgula no formulário; a vírgula literal não é editável por esse formulário. ε é reservado.
- Arestas importadas separadas para o mesmo par podem se sobrepor inicialmente; arraste cada curva para separá-las.
- A interação principal é desenhada para mouse. A interface se adapta ao celular, mas não implementa zoom por pinça nem um editor completo de gestos multitoque.
- A integração opcional WebMCP não foi incluída após bloqueio da revisão automática. A aplicação não expõe o autômato por esse canal.
- A publicação hospedada não foi concluída: a skill/recurso de hospedagem ficou indisponível na sessão. A entrega inclui código e build estático local.

## Atualização: edição na própria transição

O modal de criação foi removido. Conectar dois estados (ou criar um loop) mostra a curva normal com o campo de símbolos já focado. A digitação de vírgulas não dispara validação nem retira o foco. `0,1` representa duas alternativas na mesma aresta. Enter ou sair do campo confirma; Esc cancela. Se a lista estiver incompleta (`0,`), a mensagem aparece junto ao campo e mantém o texto para correção. Duplo clique em uma transição existente também permite editar diretamente na linha.

O navegador confirmou o foco automático sem modal, as listas `0,1` e `a,b`, a correção de uma vírgula incompleta, criação de loop, cancelamento e desfazer em uma única ação.

## Atualização: canvas largo e aceitação por duplo clique

O editor ocupa toda a largura disponível. Simulação e Propriedades ficam em abas no painel inferior, com os controles distribuídos horizontalmente em telas grandes e empilhados em telas menores. O viewBox do SVG acompanha o tamanho real do canvas, liberando espaço de desenho horizontal e mantendo zoom, pan, alinhamento e coordenadas do mouse consistentes.

Duplo clique sobre um estado alterna sua marca de aceitação (círculo duplo). A ação entra no histórico como uma única alteração e pode ser desfeita/refeita. A detecção usa também as coordenadas do ponteiro, pois a captura usada para arrastar pode redirecionar o evento de duplo clique ao SVG. Isso evita criar um estado acidentalmente sobre o estado clicado. O duplo clique em uma transição continua abrindo seu campo de símbolos na própria linha.

Verificado no navegador: painel abaixo do canvas com a mesma largura; estado normal → final → normal; desfazer/refazer; manutenção dos três estados do exemplo; edição de transição com foco; layout estreito sem rolagem horizontal.

## Atualização: curvas, rótulos e menu dos estados

Arraste diretamente uma transição para curvá-la. Entre estados, a curva é quadrática: `B(t) = (1−t)²P₀ + 2(1−t)tC + t²P₁`. O controle é armazenado em coordenadas relativas ao segmento entre os estados (`along`, `normal`), preservando a forma ao mover o conjunto. A normal próxima de zero encaixa a linha reta. Loops usam arco Bézier cúbico; o arraste controla ângulo e tamanho. O ponto de controle é interno, sem alças visíveis sobre os rótulos.

O arraste usa captura de ponteiro e um limiar de movimento, aplica somente uma alteração no histórico ao soltar e pode ser cancelado com Esc. Os rótulos são deslocados pela normal da tangente no meio da curva e têm máscara de fundo. Uma camada separada acima das linhas impede que outras transições atravessem o texto. A geometria ajustada é preservada em JSON e nas exportações SVG/PNG; o enquadramento inclui as curvas esticadas.

`StateContextMenu.tsx` oferece Renomear e Excluir no botão direito, com fechamento ao clicar fora ou pressionar Esc. Renomear abre um campo focado no próprio estado. Enter/clique fora confirma; Esc cancela. O toque longo de 550 ms também abre o menu e é cancelado quando começa um arraste. Essa alternativa de toque foi implementada, mas não foi verificada em um dispositivo físico.

Delete/Backspace excluem a seleção sem interferir em campos de texto. Ao remover um estado, todas as transições incidentes são removidas na mesma ação reversível.

Verificado no navegador nesta revisão: arraste direto da curva, ajuste de loop, desfazer, menu de contexto, renomeação, fechamento ao clicar fora, exclusão pelo menu e pelos dois atalhos, restauração das arestas incidentes, edição de `a,b` e aceitação por duplo clique.

## Revisão de usabilidade v1.4

- Clique simples no símbolo abre seu campo focado. O rótulo tem prioridade de clique sobre as linhas; o arraste da própria linha altera a curvatura, sem círculos de controle sobre o texto.
- `1, 0`, `1 , 0` e espaços não separáveis são normalizados para dois símbolos. Se um AFD tiver outra saída com o mesmo símbolo, a simulação explica o conflito e como resolvê-lo; isso independe dos espaços da lista.
- Estado e Texto permanecem ativos até a troca manual de ferramenta, inclusive ao mover estados. A barra agora fica acima do canvas, sem ocupar sua área de desenho. O título decorativo foi removido.
- Inserir Texto abre `NoteInput.tsx`, com foco imediato no canvas. Enter quebra a linha, Ctrl/Cmd+Enter ou clique fora salva, Esc cancela. Criação e conteúdo formam uma única ação de histórico. Dois cliques reabrem o texto; na ferramenta Texto, um clique é suficiente.
- O menu de botão direito também funciona nas anotações (Editar texto/Excluir) e transições (Editar símbolos/Excluir). A exclusão continua reversível.

Verificado no navegador: foco no rótulo com clique simples, `1, 0` preservado, arraste sem alça, duas anotações consecutivas com digitação multilinha, exclusão pelo menu e restauração, reedição por duplo clique, dois estados consecutivos e movimento sem trocar de ferramenta. A barra não se sobrepõe ao canvas.

## Tela cheia e teste rápido

O botão de expandir ao lado do zoom ocupa toda a viewport com o quadro. F alterna esse modo quando não há um campo de texto em edição; Esc ou Sair da Tela Cheia restaura o layout anterior, mantendo zoom, desenho e o estado do painel inferior.

A barra flutuante compartilha a palavra, a reprodução e a velocidade com a simulação. Enter ou Play inicia/retoma os passos na velocidade escolhida em Simular; durante a reprodução, o botão vira Pausar. O indicador ao lado mostra a velocidade atual, inclusive com o painel recolhido ou em tela cheia. Campo vazio testa ε. O resultado é limpo ao editar a palavra ou o autômato; erros de validação são indicados separadamente de rejeição. A explicação aparece ao passar o mouse ou focar o aviso.

Recolher painel libera o espaço vertical para o quadro. As abas Simular e Propriedades reabrem o painel. Selecionar um elemento no desenho não força sua reabertura.

A ferramenta Arrastar quadro move a visualização inteira, inclusive quando o gesto começa sobre estados, transições ou anotações. A grade pontilhada está no mesmo sistema de coordenadas SVG do diagrama e acompanha o arraste e o zoom. A mão fecha durante o arraste; as coordenadas dos componentes e o histórico permanecem intactos. Clique novamente na mão para voltar a editar.

## Ajustes de interação: botão direito, texto e destaques

- Segurar e arrastar com o botão direito ativa a mão temporariamente, inclusive sobre componentes. Ao soltar ou perder a captura/foco, a ferramenta anterior é restaurada. Clique direito sem movimento mantém o menu de contexto. A seleção em área continua no botão esquerdo.
- Com Texto ativo, um clique no fundo abre a anotação focada. A ferramenta volta ao modo padrão ao iniciar a digitação; os dois cliques no fundo continuam criando estados nesse modo.
- Executar, retomar ou avançar/voltar passos limpa a seleção de edição. Os destaques da simulação desaparecem 2,5 segundos após pausar ou terminar, incluindo o contorno de resultado do quadro. Aceito/Rejeitado e o histórico de passos continuam disponíveis; retomar reacende o estado atual.

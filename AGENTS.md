# FormaLFA — projeto principal

Decisão do usuário em 17/10/2026: o caminho canônico para este editor é
`C:\Users\conta\Documents\Projetos\faculdade\LFA\formaLFA`.

- Execute comandos e aplique futuras atualizações nesta raiz. O código atual está em `src/`, os recursos em `public/` e a compilação em `dist/`.
- Leia o README deste projeto antes de alterar o código. As orientações da pasta Faculdade continuam aplicáveis.
- As melhorias das revisões `work/ux-preview`, `work/ux-auto` e `work/ux-uppercase` foram consolidadas na raiz em 17/10/2026. Essas pastas são histórico, não fontes principais. Não retome seus caminhos antigos nem crie outra cópia completa como padrão.
- Preserve o trabalho do usuário no navegador. Ele pediu para testar atualizações em outra porta; não interrompa ou recarregue uma sessão de edição ativa. Para revisão isolada, prefira um build estático servido em porta livre com `npm run preview -- --port <porta> --strictPort`. Verifique se uma sessão ativa usa Vite/HMR desta raiz antes de editar fontes; nesse caso, preserve essa sessão por isolamento explícito.
- O documento em edição existe na memória do navegador. Não o substitua, reinicie ou importe outro por causa de uma atualização. Arquivos JSON pessoais devem ser preservados.
- Funcionalidades já consolidadas: início vazio, nomes de estados em maiúsculas, AFD/AFN automático, conexões com prévia e desvio de obstáculos, edição inline e clique fora para salvar/desmarcar, tabelas, canetinha, importação/exportação, painel e testes ocultáveis, zoom/pan, simulação, undo/redo e temas.
- Validação a partir desta raiz: `npm test` e `npm run build`. A suíte ignora `work/` para não executar cópias históricas. O Vite também ignora alterações nos arquivos de apoio.
- Não envie commits ou faça push sem pedido correspondente do usuário.

Uma cópia de segurança da raiz anterior está em `work/backup-raiz-20261017-054147/`.

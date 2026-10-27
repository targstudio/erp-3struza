# ERP 3STRUZA

ERP web da 3STRUZA (comercialização de PP reciclado moído e granulado): caixa, contas a pagar e a receber, compras, vendas, estoque e cadastros de clientes e fornecedores.

Site estático (GitHub Pages) com banco de dados e login no Supabase.

## Configuração (uma vez)

1. **Supabase:** em *SQL Editor*, rode `supabase/schema.sql`. Opcional: rode `supabase/exemplos.sql` para carregar dados de exemplo.
2. **Logins:** em *Authentication → Users → Add user*, crie um usuário (e-mail e senha) para cada pessoa. Em *Authentication → Sign In / Providers*, desligue "Allow new users to sign up" para ninguém se cadastrar sozinho.
3. **config.js:** preencha `url` e `key` (anon public key) do projeto.
4. **GitHub Pages:** em *Settings → Pages*, escolha *Deploy from a branch*, branch `main`, pasta `/ (root)`.

## Arquivos

- `index.html`: o ERP pronto para o navegador (gerado pelo `npm run build`, não editar à mão).
- `src/`: código-fonte do ERP.
  - `index.html`: estrutura da página (menu, cabeçalho, login).
  - `main.js`: inicialização.
  - `util.js`, `dados.js`, `sync.js`: utilidades, estado dos dados e sincronização com o Supabase.
  - `regras.js`: regras de negócio (saldo, estoque, custo médio, margem, parcelas).
  - `estado.js`, `render.js`, `modal.js`, `eventos.js`: navegação, desenho das telas, janelas e cliques.
  - `telas/`: uma tela por arquivo (painel, caixa, contas, compras/vendas, estoque, relatórios…).
  - `forms/`: formulários (compra/venda, título, conta, parceiro, ajuste, pagamento).
  - `impressos.js`, `backup.js`: recibo, romaneio e backup.
  - `estilos/`: CSS (base com as cores e fontes, menu, conteúdo, telas, janelas).
  - `assets/`: logos.
- `test/`: testes automáticos dos cálculos e dos formulários.
- `config.js`: endereço e chave pública do Supabase.
- `vendor/supabase.js`: biblioteca supabase-js 2.117.3 (MIT).
- `supabase/schema.sql`: tabela `docs` (col, id, data jsonb) com RLS para usuários logados e realtime, mais o histórico.
- `supabase/historico.sql`: histórico de alterações (tabela `historico` + gatilho). Rode em bancos criados antes do histórico.

## Desenvolvimento

Precisa do Node.js 20 ou mais novo.

```sh
npm install      # uma vez
npm run dev      # abre o ERP local com recarga automática
npm test         # roda os testes
npm run build    # gera o index.html da raiz
```

Fluxo de mudança: edite os arquivos em `src/`, rode `npm test` e `npm run build`, e faça commit junto do `index.html` gerado. O GitHub Pages publica o `index.html` da raiz do branch `main`. A verificação automática do GitHub (aba *Actions*) roda os testes e acusa erro se o `index.html` não tiver sido gerado a partir do `src/`.

Sem `config.js` preenchido (ou abrindo o `index.html` direto do disco sem Supabase), o ERP roda em modo local e guarda os dados só no navegador, o que serve para testes.

## Sincronização

Cada alteração é gravada no Supabase na hora. Se a internet cair, as alterações ficam numa fila no navegador e são enviadas sozinhas quando a conexão volta. As telas recebem as mudanças dos outros usuários em tempo real e recarregam os dados ao voltar para a aba e a cada 60 segundos. O indicador no topo mostra "Sincronizado", "Salvando…" ou "Sem conexão".

## Histórico de alterações

Toda criação, alteração e exclusão é registrada pelo banco (gatilho em `docs`), com usuário, data, hora e os dados antes e depois. Ninguém consegue apagar ou editar o histórico pelo sistema. Veja no menu **Histórico** ou no botão de relógio ao lado de cada registro.

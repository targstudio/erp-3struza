# ERP 3STRUZA

ERP web da 3STRUZA (comercialização de PP reciclado moído e granulado): caixa, contas a pagar e a receber, compras, vendas, estoque e cadastros de clientes e fornecedores.

Site estático (GitHub Pages) com banco de dados e login no Supabase.

## Configuração (uma vez)

1. **Supabase:** em *SQL Editor*, rode `supabase/schema.sql`. Opcional: rode `supabase/exemplos.sql` para carregar dados de exemplo.
2. **Logins:** em *Authentication → Users → Add user*, crie um usuário (e-mail e senha) para cada pessoa. Em *Authentication → Sign In / Providers*, desligue "Allow new users to sign up" para ninguém se cadastrar sozinho.
3. **config.js:** preencha `url` e `key` (anon public key) do projeto.
4. **GitHub Pages:** em *Settings → Pages*, escolha *Deploy from a branch*, branch `main`, pasta `/ (root)`.

## Arquivos

- `index.html`: o ERP inteiro (HTML, CSS e JS).
- `config.js`: endereço e chave pública do Supabase.
- `vendor/supabase.js`: biblioteca supabase-js 2.117.3 (MIT).
- `supabase/schema.sql`: tabela `docs` (col, id, data jsonb) com RLS para usuários logados e realtime.

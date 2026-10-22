# AlfaTec Financeiro

Sistema de controle de mensalidades, pagantes, conciliação e relatórios da AlfaTec, com **login real no servidor** e **auditoria de alterações por usuário**.

## Estrutura

- `public/index.html`: formulário público de login, sem dados financeiros.
- `api/app.js`: entrega o painel **somente a usuários autenticados**.
- `private/dashboard.html`: interface AlfaTec preexistente, preservando as turmas, Pagantes, Financeiro, Repasse e relatórios. Busca o estado atual no banco.
- `api/state.js`: lê/grava o estado com **controle otimista de versão** e auditoria na mesma operação SQL.
- `public/admin.html`, `api/admin.js`: administração de contas e consulta à trilha de auditoria, só para o administrador principal.
- `lib/`: autenticação, sessões, validações e banco de dados PostgreSQL (Neon ou provedor compatível).

## Segurança

1. **Não coloque a senha do administrador no GitHub, HTML, JavaScript, `README`, arquivos `.env` versionados ou histórico de commits.**
2. Configure `ADMIN_PASSWORD` somente em **Vercel → Project → Settings → Environment Variables**, tipo *Sensitive*. A primeira inicialização cria o usuário **Kristopher** usando o hash `scrypt` da senha informada. Depois, altere essa senha na área do administrador (recomendado, especialmente se foi citada numa conversa).
3. Configure `DATABASE_URL` como segredo na Vercel, apontando para um PostgreSQL com TLS. Não há sincronização real de dados nem auditoria confiável sem banco.
4. Crie o repositório **privado** `alfatec-financeiro`. Antes de enviar para o GitHub, confira a lista de arquivos com `git status` e garanta que `AlfaTec_Dados_Iniciais_PRIVADO.json` (arquivo entregue separadamente) não está no commit.
5. Perfis: `main_admin` vê histórico e gerencia usuários; `editor` altera dados; `viewer` lê apenas. A autorização é validada pelo backend. As senhas individuais de novos usuários exigem no mínimo 6 caracteres.
6. O cookie de sessão é `HttpOnly; Secure; SameSite=Strict`, com expiração de 12 horas; a API exige origem compatível para gravações e não oferece CORS a terceiros.
7. Os eventos incluem usuário autenticado, ação, timestamp, diferenças de valores e campos. A API não expõe exclusão de eventos de auditoria; faça backups periódicos do banco de dados e proteja as permissões do banco.
8. O aplicativo original guarda alguns dados no navegador. **Esta versão remove a gravação local do sistema e salva no servidor.** Dados editados anteriormente no navegador não migram automaticamente; importe um backup JSON na área **Configurações** depois do login.

## Importar dados da versão original

O arquivo **`AlfaTec_Dados_Iniciais_PRIVADO.json`** é fornecido à parte. Ele contém os alunos, as mensalidades e os Pix extraídos dos documentos; **não deve ser enviado ao GitHub**.

1. Acesse o sistema com a conta do administrador principal.
2. Abra **Configurações → Importar backup JSON** e selecione `AlfaTec_Dados_Iniciais_PRIVADO.json`.
3. Confira os 16 alunos e os recebimentos importados antes de distribuir os pagamentos por aluno e competência.
4. O carregamento é registrado na auditoria, e outros administradores não podem apagá-lo pela interface.

## Publicação

1. Na conta GitHub: crie repositório privado **alfatec-financeiro** e envie apenas os arquivos desta pasta, **excluindo os JSON privados**.
2. Em Vercel, na equipe `flauzino-s-projects`, crie projeto **alfatec-financeiro** vinculado ao repositório.
3. Crie banco PostgreSQL e configure `DATABASE_URL` e `ADMIN_PASSWORD` nos ambientes necessários. Não utilize a Vercel Blob pública para guardar informações financeiras.
4. Confirme que o ambiente de produção tem `NODE_ENV=production` (padrão da Vercel) e revise Vercel Authentication / proteção de implantação. O login de aplicação também será obrigatório.
5. Primeiro acesso: `/` → login. Admin: `/admin.html` → auditoria e contas. Aplicativo: `/api/app`.
6. **Teste**: entrar como admin; criar editor; criar/alocar uma mensalidade; sair; entrar como editor; alterar um valor; conferir o autor no histórico administrativo; testar novo navegador e celular.

### Para executar com Node localmente

O projeto usa funções Node (`api/*.js`) compatíveis com a Vercel e PostgreSQL remoto. Instale dependências com `npm install`, defina as variáveis de ambiente localmente fora do Git e inicie usando o ambiente de desenvolvimento da Vercel (`vercel dev`). Não exponha `.env`.

## Limitações/observações

- A publicação remota depende das permissões concedidas no GitHub e na equipe Vercel.
- Nenhum lançamento é alterado na planilha original do Google Sheets; ela é referência de conferência. Uma sincronização bidirecional exigiria integração e regras específicas para evitar sobrescrever pagamentos.
- A lógica de rateio existente foi preservada. Como qualquer conciliação bancária, vínculos sugeridos entre pagantes e alunos devem ser confirmados.
- Importação de dados pessoais: somente em ambiente protegido e com a conta administrativa, nunca num repositório público.
- Existe controle contra alterações concorrentes: se dois editores mudarem o mesmo estado, o segundo receberá aviso para recarregar os dados, em vez de sobrescrever silenciosamente.

## Cadastro pela tela de login (v1.1)

- O botão **Criar usuário** aceita senha de 6 a 256 caracteres; recomendamos 12 ou mais.
- Solicitações criam usuários com papel `viewer` e `is_active=false`: **ninguém obtém acesso sem a aprovação do administrador principal**.
- Em `/admin.html`, o administrador ativa e pode promover a `editor`. Aprovação, alterações de perfil e cadastros aparecem na auditoria.
- Sem `DATABASE_URL`, não há login nem cadastro. Configure um PostgreSQL privado em Vercel antes do primeiro acesso. `ADMIN_PASSWORD` também é obrigatório para a criação do primeiro administrador (usuário `kristopher`, não `flauzino`).

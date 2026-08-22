# 📁 DocSaaS Backend — Gestão de Documentos Multi-Tenant (Startup XYZ)

Backend oficial do MVP desenvolvido para o Trabalho de Conclusão de Curso EDN, demonstrando isolamento multi-tenant, URLs pré-assinadas, ciclo de vida de armazenamento (S3 Standard -> Glacier) e conformidade com a LGPD.

---

## 🎯 Problema do TCC & Atendimento aos Requisitos do Professor

| Requisito do Professor | Implementação no DocSaaS |
| :--- | :--- |
| **1. Discovery** | Startup XYZ recebe 50.000 docs/mês com retenção perpétua para IA. Dores centrais: Custo de armazenamento e risco de vazamento de dados entre empresas. |
| **2. Jornada do Cliente** | Login isolado por Tenant -> Geração de Pre-Signed Upload URL -> Upload direto no Storage -> Catálogo restrito à empresa -> Arquivamento automático aos 365 dias -> Exclusão lógica LGPD. |
| **3. Refinamento Técnico** | JWT com claim `tenantId`, prefixos no Storage `/{tenantId}/{docId}/`, Pre-Signed URLs com expiração (15 min), controle `STANDARD` vs `GLACIER` e soft delete auditável. |
| **4. Desenho da Solução** | Arquitetura Serverless IaC (CloudFormation) + MVP funcional integrado ao Supabase (Auth, Postgres e Storage). |
| **5. Construção do MVP** | Backend Node.js / Express 100% autônomo, modular e testável via scripts E2E para comprovação ao vivo na banca. |

---

## 🏗️ Estrutura de Arquivos

```text
docs-saas-backend/
├── src/
│   ├── config/
│   │   └── supabase.js             # Inicialização do cliente Supabase
│   ├── middlewares/
│   │   └── auth.js                 # Middleware de validação JWT e extração de Tenant
│   ├── controllers/
│   │   ├── authController.js       # Registro e login com tenantId
│   │   └── documentController.js   # URLs assinadas, isolamento, LGPD e Glacier
│   ├── routes/
│   │   ├── authRoutes.js           # /api/auth (register, login, me)
│   │   └── documentRoutes.js       # /api/documents (CRUD e simulações)
│   └── app.js                      # Configuração do Express e Health Check
├── .env                            # Variáveis de ambiente
├── package.json                    # Scripts e dependências
├── server.js                       # Entrypoint HTTP com Graceful Shutdown
├── supabase_schema.sql             # Script SQL de criação das tabelas no Supabase
└── test-e2e.js                     # Bateria de testes automatizados E2E
```

---

## 🚀 Como Executar

### 1. Instalação das Dependências
```bash
npm install
```

### 2. Configurar o Banco de Dados
Abra o **SQL Editor** no painel do Supabase e execute o arquivo `supabase_schema.sql`.

### 3. Rodar o Servidor
```bash
npm run dev
```
Servidor disponível em: `http://localhost:3000`  
Health check em: `http://localhost:3000/health`

---

## 🧪 Testes Automatizados E2E (Comprovação para a Banca)

Com o servidor rodando em um terminal, execute em outro:
```bash
npm run test:e2e
```

O script testará e exibirá no terminal:
1. Cadastro de dois tenants distintos (`Empresa Alfa` e `Empresa Beta`).
2. Geração de URL pré-assinada para upload.
3. **Comprovação de Isolamento:** Empresa Beta não consegue visualizar nem acessar os documentos da Alfa.
4. **Ciclo de Vida Glacier:** Transição e bloqueio de download imediato para arquivos de camada fria.
5. **Conformidade LGPD:** Exclusão lógica mantendo registro de auditoria.

---

## 📋 Endpoints da API

### Autenticação (`/api/auth`)
* `POST /api/auth/register` - Cadastra usuário vinculando ao `tenantId`.
* `POST /api/auth/login` - Retorna token JWT contendo `tenantId`.
* `GET /api/auth/me` - Retorna dados do usuário autenticado.

### Documentos (`/api/documents`)
* `POST /api/documents/upload-url` - Gera URL pré-assinada temporária para upload direto.
* `POST /api/documents` - Salva metadados do documento.
* `GET /api/documents` - Lista apenas os documentos do tenant autenticado.
* `GET /api/documents/:id` - Retorna URL de download (ou status Glacier).
* `DELETE /api/documents/:id` - Desativação lógica do documento (LGPD).
* `POST /api/documents/:id/simulate-glacier` - Simula transição para Glacier (> 365 dias).
* `POST /api/documents/:id/restore-glacier` - Simula restauração de volta para Standard.

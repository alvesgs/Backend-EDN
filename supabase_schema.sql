-- ==============================================================================
-- SCRIPT DE INICIALIZAÇÃO DO BANCO DE DADOS - DOCSAAS MVP (TCC STARTUP XYZ)
-- Execute este script no "SQL Editor" do seu painel do Supabase
-- ==============================================================================

-- 1. Criação da Tabela de Metadados de Documentos
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  storage_class TEXT DEFAULT 'STANDARD', -- 'STANDARD' ou 'GLACIER'
  deleted BOOLEAN DEFAULT FALSE,         -- Conformidade LGPD (Eliminação Lógica)
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  archived_at TIMESTAMPTZ,
  restored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Criação de Índices para Busca Rápida e Isolamento por Tenant
CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON public.documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_deleted ON public.documents(deleted);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);

-- 3. Habilitação de RLS (Row Level Security) opcional caso queira proteção direta no Postgres
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Política de Acesso: Permite operações autenticadas
CREATE POLICY "Permitir acesso completo para usuarios autenticados"
ON public.documents
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Política para a chave anon / pública (caso aplicável para leitura/escrita do MVP)
CREATE POLICY "Permitir acesso para anon"
ON public.documents
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

import { useState, useEffect } from 'react';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenant, setTenant] = useState('');
  
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (token) {
      fetchDocuments();
    }
  }, [token]);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/documents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      
      if (res.ok) {
        // Garante a leitura correta caso venha em json.data ou json direto
        const docsList = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
        setDocuments(docsList);
      } else if (res.status === 401 || res.status === 403) {
        handleLogout();
      }
    } catch (err) {
      console.error('Erro ao buscar documentos:', err);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin ? { email, password } : { email, password, tenantId: tenant };

    try {
      const res = await fetch(`http://localhost:3000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (res.ok && data.token) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
      } else {
        if (!isLogin) {
          alert('Conta criada! Tentando entrar...');
          setIsLogin(true);
        } else {
          alert('Erro: ' + (data.error || 'Falha na autenticação'));
        }
      }
    } catch (err) {
      alert('Erro ao conectar com o servidor.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setDocuments([]);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      // 1. Gera URL pré-assinada
      const urlRes = await fetch('http://localhost:3000/api/documents/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ fileName: file.name, contentType: file.type })
      });

      const urlData = await urlRes.json();
      if (!urlRes.ok) throw new Error(urlData.error || 'Erro ao gerar URL');

      const targetUrl = urlData.data?.uploadUrl || urlData.uploadUrl;
      const targetFilePath = urlData.data?.filePath || urlData.filePath;

      // 2. Upload direto do binário para o Storage
      const uploadRes = await fetch(targetUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      });

      if (!uploadRes.ok) throw new Error('Falha no upload direto para o storage');

      // 3. Persistência de metadados
      const currentToken = localStorage.getItem('token');

      const metaRes = await fetch('http://localhost:3000/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify({ 
          title: file.name,
          filePath: targetFilePath,
          fileSize: file.size,
          mimeType: file.type
        })
      });

      const metaData = await metaRes.json();
      if (!metaRes.ok) throw new Error(metaData.error || 'Erro ao salvar metadados');
      
      alert('Documento enviado e catalogado com sucesso!');
      await fetchDocuments();
    } catch (err) {
      alert('Aviso no envio: ' + err.message);
      // Atualiza a lista mesmo se o erro for apenas na resposta final
      fetchDocuments();
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  const handleDownload = async (id) => {
    try {
      const res = await fetch(`http://localhost:3000/api/documents/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      
      if (!res.ok) throw new Error(json.error || 'Erro ao processar download');

      if (json.data?.storage_class === 'GLACIER' || json.data?.storageClass === 'GLACIER') {
        alert(`🔒 Acesso Negado!\n\n${json.data.statusMessage || 'Documento em camada fria (Glacier).'}`);
      } else if (json.data?.downloadUrl) {
        window.open(json.data.downloadUrl, '_blank');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleGlacier = async (id, currentStatus) => {
    const isGlacier = currentStatus === 'GLACIER';
    const endpoint = isGlacier 
      ? `/api/documents/${id}/restore-glacier`
      : `/api/documents/${id}/simulate-glacier`;

    try {
      const res = await fetch(`http://localhost:3000${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      
      if (res.ok) {
        alert('Status atualizado: ' + json.message);
        fetchDocuments();
      } else {
        alert('Erro: ' + json.error);
      }
    } catch (err) {
      alert('Erro ao alterar status do documento.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja desativar este documento (Exclusão Lógica LGPD)?')) return;
    
    try {
      const res = await fetch(`http://localhost:3000/api/documents/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        alert('Exclusão lógica realizada com sucesso!');
        fetchDocuments();
      }
    } catch (err) {
      alert('Erro ao excluir documento.');
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
        <div className="w-full max-w-md bg-white/90 backdrop-blur-sm rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-slate-800">DocSaaS</h1>
            <p className="text-sm text-slate-500 mt-1">{isLogin ? 'Acesse o seu workspace' : 'Cadastre sua empresa'}</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Empresa (Tenant)</label>
                <input 
                  type="text" required value={tenant} onChange={(e) => setTenant(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="Ex: Empresa Alfa"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
              <input 
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
              <input 
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors mt-2">
              {isLogin ? 'Entrar' : 'Criar Conta'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Faça login'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">DocSaaS Workspace</h1>
            <p className="text-sm text-slate-500">Gestão Multi-Tenant e Ciclo de Vida de Documentos</p>
          </div>
          <button onClick={handleLogout} className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
            Sair
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <h2 className="text-lg font-medium text-slate-800">Documentos da Empresa</h2>
            
            <label className={`cursor-pointer px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm flex items-center gap-2 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              {uploading ? 'Enviando arquivo...' : '+ Novo Documento (PDF)'}
              <input type="file" accept="application/pdf" onChange={handleFileUpload} className="hidden" disabled={uploading} />
            </label>
          </div>

          {documents.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-xl">
              <p className="text-sm text-slate-400">Nenhum documento encontrado para este tenant.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {documents.map((doc, index) => (
                <div key={doc.id || index} className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  
                  <div>
                    <p className="font-medium text-slate-800">{doc.title || doc.filename || 'Sem título'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Status: <span className={`font-semibold ${doc.storage_class === 'GLACIER' ? 'text-blue-500' : 'text-indigo-600'}`}>
                        {doc.storage_class || 'STANDARD'}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full mr-2 hidden sm:inline-block">
                      {doc.tenant_id}
                    </span>
                    
                    <button 
                      onClick={() => handleDownload(doc.id)} 
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded shadow-sm transition-colors"
                    >
                      Baixar
                    </button>
                    
                    <button 
                      onClick={() => handleToggleGlacier(doc.id, doc.storage_class)} 
                      className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${doc.storage_class === 'GLACIER' ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-blue-600 bg-blue-50 hover:bg-blue-100'}`}
                    >
                      {doc.storage_class === 'GLACIER' ? 'Restaurar S3' : 'Simular Glacier'}
                    </button>
                    
                    <button 
                      onClick={() => handleDelete(doc.id)} 
                      className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
                    >
                      Excluir
                    </button>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import PerfilEditModal from './Usuarios/PerfilEditModal';
import { SidebarProvider, SidebarInset, SidebarTrigger } from './ui/sidebar';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './ui/breadcrumb';

interface LayoutProps {
  isAuthenticated: boolean;
  username: string;
  email?: string;
  onLogout: () => void;
  role?: string;
  permissions: Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>;
  onUpdateProfile?: (username: string, email: string) => void;
}

/**
 * Componente de Layout Principal da Área Administrativa / Protegida.
 * 
 * Por que existe: Serve como moldura estrutural pós-autenticação.
 * Envolve a área logada no SidebarProvider para fornecer estados do menu lateral 
 * e utiliza SidebarInset e SidebarTrigger para controlar e renderizar a área 
 * de conteúdo ao lado da barra lateral. Inclui também o cabeçalho com o sistema
 * de breadcrumbs dinâmicos para facilitar a navegação do usuário.
 */
export default function Layout({ isAuthenticated, username, email, onLogout, role, permissions, onUpdateProfile }: LayoutProps) {
  const location = useLocation();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // Mapeamento manual e amigável da rota atual para definir o setor e a página ativa
  const path = location.pathname.replace(/^\/|\/$/g, '');
  let sector = '';
  let pageName = 'Início';

  if (path === 'lojas') {
    sector = 'Operação';
    pageName = 'Lojas';
  } else if (path === 'lojas/mapa') {
    sector = 'Operação';
    pageName = 'Mapa de Lojas';
  } else if (path === 'agenda') {
    sector = 'Operação';
    pageName = 'Agenda';
  } else if (path === 'agenda/historico') {
    sector = 'Operação';
    pageName = 'Histórico de Limpeza';
  } else if (path === 'colaboradores') {
    sector = 'Operação';
    pageName = 'Base de Colaboradores';
  } else if (path === 'terminos') {
    sector = 'Operação';
    pageName = 'Términos de Exp.';
  } else if (path === 'testes') {
    sector = 'Operação';
    pageName = 'Testes de Promoção';
  } else if (path === 'escopos') {
    sector = 'Análises';
    pageName = 'Escopos';
  } else if (path === 'comparativo') {
    sector = 'Análises';
    pageName = 'Raio-X';
  } else if (path === 'headcount') {
    sector = 'Análises';
    pageName = 'Headcount';
  } else if (path === 'diarias') {
    sector = 'Análises';
    pageName = 'Diárias';
  } else if (path === 'premios') {
    sector = 'Análises';
    pageName = 'Prêmios';
  } else if (path === 'faltas') {
    sector = 'Gestão de Faltas';
    const params = new URLSearchParams(location.search);
    const client = params.get('client');
    const view = params.get('view');
    if (client === 'carrefour') pageName = 'Carrefour';
    else if (client === 'protege') pageName = 'Protege';
    else if (client === 'assai_atacadao') pageName = 'Assaí & Atacadão';
    else if (client === 'dia') pageName = 'Rede Dia';
    else if (view === 'tarifas') pageName = 'Lojas & Tarifas';
    else if (view === 'historico_banco') pageName = 'Histórico';
    else pageName = 'Painel de Faltas';
  } else if (path === 'butanta') {
    sector = 'Gestão de Faltas';
    pageName = 'Faltas Shoppings';
  } else if (path === 'importacoes') {
    sector = 'Configurações';
    pageName = 'Importações';
  } else if (path === 'usuarios') {
    sector = 'Configurações';
    pageName = 'Usuários';
  } else {
    sector = 'Geral';
    pageName = 'Início';
  }

  // Por que existe: Atualiza o título da aba do navegador dinamicamente conforme o usuário navega entre as páginas do sistema.
  useEffect(() => {
    document.title = `Operacional | ${pageName}`;
  }, [pageName]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SidebarProvider>
      {/* Menu Lateral de Navegação */}
      <Sidebar 
        username={username} 
        email={email}
        onLogout={onLogout} 
        role={role} 
        permissions={permissions}
        onOpenProfile={() => setProfileModalOpen(true)} 
      />

      {/* Conteúdo Principal da Área de Trabalho */}
      <SidebarInset className="h-screen overflow-hidden">
        {/* Cabeçalho Superior com Gatilho da Sidebar */}
        <header className="h-16 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4">
            {/* Botão para colapsar/expandir a Sidebar */}
            <SidebarTrigger />
            
            {/* Componente Oficial do Shadcn para exibição da hierarquia da página */}
            <Breadcrumb>
              <BreadcrumbList>
                {sector && (
                  <>
                    <BreadcrumbItem>
                      <span className="text-neutral-500 font-medium text-xs">{sector}</span>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                  </>
                )}
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-xs font-semibold">{pageName}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 transition-all focus:outline-none cursor-pointer border border-transparent active:scale-95"
              title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-500" />
              ) : (
                <Moon className="h-4 w-4 text-neutral-600" />
              )}
            </button>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Logado como: <span className="font-semibold text-neutral-800 dark:text-neutral-200">{username}</span>
            </div>
          </div>
        </header>

        {/* Local onde a rota ativa será renderizada */}
        <div className="p-6 md:p-8 flex-1 overflow-y-auto">
          <Outlet context={{ role, permissions }} />
        </div>
      </SidebarInset>

      {profileModalOpen && (
        <PerfilEditModal
          onClose={() => setProfileModalOpen(false)}
          onSaveSuccess={(newUsername, newEmail) => {
            onUpdateProfile?.(newUsername, newEmail);
            setProfileModalOpen(false);
          }}
        />
      )}
    </SidebarProvider>
  );
}

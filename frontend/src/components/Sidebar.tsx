import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Store, 
  Map,
  Users, 
  LogOut, 
  TrendingUp,
  TrendingDown,
  Database,
  Layers,
  ChevronsUpDown,
  ChevronDown,
  ChevronRight,
  CalendarCheck,
  CalendarX,
  Coins,
  CircleDollarSign,
  FileSpreadsheet,
  Building2,
  ShieldCheck,
  History,
  Sliders
} from 'lucide-react';
import { logoBase64 } from '../assets/logoBase64';
import { 
  Sidebar as ShadcnSidebar, 
  SidebarHeader, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupLabel, 
  SidebarGroupContent, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton, 
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarFooter, 
  SidebarRail,
  useSidebar
} from './ui/sidebar';
import api from '../api/client';

interface SidebarProps {
  username?: string;
  email?: string;
  onLogout: () => void;
  role?: string;
  permissions?: Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>;
  onOpenProfile?: () => void;
}

/**
 * Componente de Navegação Lateral (Sidebar).
 * 
 * Por que existe: Implementa a navegação principal estruturada por setores.
 * Utiliza o visual e componentes oficiais do Shadcn UI (grupos, switcher de workspace,
 * rodapé com dados do perfil e submenus colapsáveis).
 */
export default function Sidebar({ username = 'Usuário', email = '', onLogout, permissions, onOpenProfile }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { open } = useSidebar();
  const [colabSubOpen, setColabSubOpen] = useState(true);
  const [apoioSubOpen, setApoioSubOpen] = useState(true);
  const [faltasSubOpen, setFaltasSubOpen] = useState(true);

  const handleLogoutClick = async () => {
    try {
      await api.post('/usuarios/api/logout/');
    } catch (error) {
      console.error('Erro ao deslogar da API:', error);
    } finally {
      onLogout();
      navigate('/login');
    }
  };

  return (
    <ShadcnSidebar>
      {/* Cabeçalho da Sidebar - Atalho para Página Inicial */}
      <SidebarHeader>
        <Link 
          to="/"
          className="flex items-center justify-between w-full p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-850 cursor-pointer transition-colors group"
          title="Ir para o início"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white overflow-hidden shadow-xs border border-neutral-100">
              <img src={logoBase64} alt="Logo" className="h-7 w-7 object-contain" />
            </div>
            {open && (
              <div className="flex flex-col min-w-0 text-left">
                <span className="font-semibold text-xs leading-tight truncate text-neutral-900 dark:text-white">
                  Sistema Operacional
                </span>
                <span className="text-[10px] text-neutral-400 truncate">
                  Operação & Análises
                </span>
              </div>
            )}
          </div>
        </Link>
      </SidebarHeader>

      {/* Conteúdo com os links por setores */}
      <SidebarContent>
        {/* Setor Geral */}
        <SidebarGroup>
          <SidebarGroupLabel>Geral</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild 
                  isActive={location.pathname === '/'}
                  title={!open ? "Início" : undefined}
                >
                  <Link to="/">
                    <LayoutDashboard className="h-5 w-5 shrink-0" />
                    {open && <span className="truncate">Início</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Setor Equipe & Lotação */}
        <SidebarGroup>
          <SidebarGroupLabel>Operação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Lojas */}
              {permissions?.lojas?.view === true && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === '/lojas'}
                    title={!open ? "Lojas" : undefined}
                  >
                    <Link to="/lojas">
                      <Store className="h-5 w-5 shrink-0" />
                      {open && <span className="truncate">Lojas</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {/* Mapa de Lojas */}
              {permissions?.lojas?.view === true && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === '/lojas/mapa'}
                    title={!open ? "Mapa de Lojas" : undefined}
                  >
                    <Link to="/lojas/mapa">
                      <Map className="h-5 w-5 shrink-0" />
                      {open && <span className="truncate">Mapa de Lojas</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {/* Apoio com Submenu Colapsável */}
              {permissions?.apoio?.view === true && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => setApoioSubOpen(!apoioSubOpen)}
                    isActive={location.pathname === '/agenda' || location.pathname === '/agenda/historico'}
                    title={!open ? "Apoio" : undefined}
                  >
                    <CalendarCheck className="h-5 w-5 shrink-0" />
                    {open && (
                      <>
                        <span className="truncate flex-1 text-left">Apoio</span>
                        {apoioSubOpen ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                        )}
                      </>
                    )}
                  </SidebarMenuButton>

                  {open && apoioSubOpen && (
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuButton 
                          asChild 
                          isActive={location.pathname === '/agenda'}
                        >
                          <Link to="/agenda">
                            <span className="truncate">Agenda</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuButton 
                          asChild 
                          isActive={location.pathname === '/agenda/historico'}
                        >
                          <Link to="/agenda/historico">
                            <span className="truncate">Histórico de Limpeza</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              )}

              {/* Colaboradores com Submenu Colapsável */}
              {permissions?.colaboradores?.view === true && (
                <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => setColabSubOpen(!colabSubOpen)}
                  isActive={location.pathname === '/colaboradores' || location.pathname === '/terminos' || location.pathname === '/testes'}
                  title={!open ? "Colaboradores" : undefined}
                >
                  <Users className="h-5 w-5 shrink-0" />
                  {open && (
                    <>
                      <span className="truncate flex-1 text-left">Colaboradores</span>
                      {colabSubOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                      )}
                    </>
                  )}
                </SidebarMenuButton>

                {open && colabSubOpen && (
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuButton 
                        asChild 
                        isActive={location.pathname === '/colaboradores'}
                      >
                        <Link to="/colaboradores">
                          <span className="truncate">Base de Colaboradores</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuButton 
                        asChild 
                        isActive={location.pathname === '/terminos'}
                      >
                        <Link to="/terminos">
                          <span className="truncate">Términos de Exp.</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuSubItem>
                    {permissions?.testes_promocao?.view === true && (
                      <SidebarMenuSubItem>
                        <SidebarMenuButton 
                          asChild 
                          isActive={location.pathname === '/testes'}
                        >
                          <Link to="/testes">
                            <span className="truncate">Testes de Promoção</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuSubItem>
                    )}
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Setor Planejamento & BI */}
        <SidebarGroup>
          <SidebarGroupLabel>Análises</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {permissions?.escopos?.view === true && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === '/escopos'}
                    title={!open ? "Escopos" : undefined}
                  >
                    <Link to="/escopos">
                      <Layers className="h-5 w-5 shrink-0" />
                      {open && <span className="truncate">Escopos</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {permissions?.comparativo?.view === true && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === '/comparativo'}
                    title={!open ? "Raio-X" : undefined}
                  >
                    <Link to="/comparativo">
                      <TrendingUp className="h-5 w-5 shrink-0" />
                      {open && <span className="truncate">Raio-X</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {permissions?.headcount?.view === true && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === '/headcount'}
                    title={!open ? "Headcount" : undefined}
                  >
                    <Link to="/headcount">
                      <Users className="h-5 w-5 shrink-0" />
                      {open && <span className="truncate">Headcount</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {permissions?.diarias?.view === true && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === '/diarias'}
                    title={!open ? "Diárias" : undefined}
                  >
                    <Link to="/diarias">
                      <CalendarCheck className="h-5 w-5 shrink-0" />
                      {open && <span className="truncate">Diárias</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {permissions?.premios?.view === true && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === '/premios'}
                    title={!open ? "Prêmios" : undefined}
                  >
                    <Link to="/premios">
                      <Coins className="h-5 w-5 shrink-0" />
                      {open && <span className="truncate">Prêmios</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {permissions?.turnover?.view === true && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === '/turnover'}
                    title={!open ? "Turnover" : undefined}
                  >
                    <Link to="/turnover">
                      <TrendingDown className="h-5 w-5 shrink-0" />
                      {open && <span className="truncate">Turnover</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              
              {permissions?.ausencias?.view === true && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === '/ausencias'}
                    title={!open ? "Ausências" : undefined}
                  >
                    <Link to="/ausencias">
                      <CalendarX className="h-5 w-5 shrink-0" />
                      {open && <span className="truncate">Ausências</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Setor Gestão de Faltas */}
        {((permissions?.faltas?.view ?? true) || (permissions?.butanta?.view ?? true)) && (
          <SidebarGroup>
            <SidebarGroupLabel>Gestão de Faltas</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Fechamentos de Faltas com Submenu Colapsável */}
                {(permissions?.faltas?.view ?? true) && (
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      onClick={() => {
                        if (!open) {
                          navigate('/faltas');
                        } else {
                          setFaltasSubOpen(!faltasSubOpen);
                        }
                      }}
                      isActive={location.pathname === '/faltas'}
                      title={!open ? "Fechamentos" : undefined}
                    >
                      <FileSpreadsheet className="h-5 w-5 shrink-0" />
                      {open && (
                        <>
                          <span className="truncate flex-1 text-left">Fechamentos</span>
                          {faltasSubOpen ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                          )}
                        </>
                      )}
                    </SidebarMenuButton>

                    {open && faltasSubOpen && (
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuButton 
                            asChild 
                            isActive={location.pathname === '/faltas' && !location.search}
                          >
                            <Link to="/faltas">
                              <span className="truncate">Painel Geral</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuButton 
                            asChild 
                            isActive={location.pathname === '/faltas' && location.search.includes('client=carrefour')}
                          >
                            <Link to="/faltas?client=carrefour">
                              <span className="truncate">Carrefour</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuButton 
                            asChild 
                            isActive={location.pathname === '/faltas' && location.search.includes('client=protege')}
                          >
                            <Link to="/faltas?client=protege">
                              <span className="truncate">Protege</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuButton 
                            asChild 
                            isActive={location.pathname === '/faltas' && location.search.includes('client=assai_atacadao')}
                          >
                            <Link to="/faltas?client=assai_atacadao">
                              <span className="truncate">Assaí & Atacadão</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuButton 
                            asChild 
                            isActive={location.pathname === '/faltas' && location.search.includes('view=tarifas')}
                          >
                            <Link to="/faltas?view=tarifas">
                              <span className="truncate">Lojas & Tarifas</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuButton 
                            asChild 
                            isActive={location.pathname === '/faltas' && location.search.includes('view=historico_banco')}
                          >
                            <Link to="/faltas?view=historico_banco">
                              <span className="truncate">Histórico</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                )}

                {/* Faltas Shoppings */}
                {(permissions?.butanta?.view ?? true) && (
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      asChild 
                      isActive={location.pathname === '/butanta'}
                      title={!open ? "Faltas Shoppings" : undefined}
                    >
                      <Link to="/butanta">
                        <Store className="h-5 w-5 shrink-0 text-cyan-400" />
                        {open && <span className="truncate">Faltas Shoppings</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}


        {/* Setor Configurações */}
        <SidebarGroup>
          <SidebarGroupLabel>Configurações</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {permissions?.usuarios?.view === true && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === '/usuarios'}
                    title={!open ? "Usuários" : undefined}
                  >
                    <Link to="/usuarios">
                      <Users className="h-5 w-5 shrink-0" />
                      {open && <span className="truncate">Usuários</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {permissions?.salarios?.view === true && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === '/salarios'}
                    title={!open ? "Salários" : undefined}
                  >
                    <Link to="/salarios">
                      <CircleDollarSign className="h-5 w-5 shrink-0" />
                      {open && <span className="truncate">Salários</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {permissions?.importacoes?.view === true && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === '/importacoes'}
                    title={!open ? "Importações" : undefined}
                  >
                    <Link to="/importacoes">
                      <Database className="h-5 w-5 shrink-0" />
                      {open && <span className="truncate">Importações</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Rodapé - Informações do Usuário & Logout */}
      <SidebarFooter>
        <div className="flex flex-col gap-2">
          <div 
            onClick={() => onOpenProfile?.()}
            className={`flex items-center justify-between p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-850 cursor-pointer transition-colors group ${!open ? 'justify-center' : ''}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 shadow-xs uppercase">
                {username ? username.substring(0, 2) : 'US'}
              </div>
              {open && (
                <div className="flex flex-col min-w-0 text-left">
                  <p className="text-xs font-semibold truncate text-neutral-900 dark:text-white leading-tight">
                    {username}
                  </p>
                  <p className="text-[9px] text-neutral-400 truncate leading-none mt-0.5">
                    {email || `${username.toLowerCase()}@grupo.com`}
                  </p>
                </div>
              )}
            </div>
            {open && (
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-neutral-450 group-hover:text-neutral-600 dark:group-hover:text-neutral-200 transition-colors" />
            )}
          </div>
          
          <button
            onClick={handleLogoutClick}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-650 hover:bg-red-500/10 transition-colors cursor-pointer ${
              !open ? 'justify-center' : ''
            }`}
            title="Sair do sistema"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {open && <span>Sair</span>}
          </button>
        </div>
      </SidebarFooter>

      {/* Trilho para recolhimento visual */}
      <SidebarRail />
    </ShadcnSidebar>
  );
}

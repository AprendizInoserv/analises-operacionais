import api, { getBackendPort } from '../api/client';

export const getBaseApiUrl = (): string => {
  return `http://${window.location.hostname}:${getBackendPort()}`;
};

export const gestaoFaltasApi = {
  // Fechamentos
  async getFechamentos() {
    const res = await api.get('/api/faltas/fechamentos/');
    return res.data;
  },

  async getFechamento(id: number | string) {
    const res = await api.get(`/api/faltas/fechamentos/${id}/`);
    return res.data;
  },

  async inicializarFechamento(clienteId: any, ano: number, mes: number, clienteCodigo: string | null = null) {
    const res = await api.post('/api/faltas/fechamentos/inicializar/', {
      cliente_id: clienteId,
      cliente_codigo: clienteCodigo,
      ano,
      mes
    });
    return res.data;
  },

  async atualizarItensFechamento(fechamentoId: number | string, itens: any[]) {
    const res = await api.post(`/api/faltas/fechamentos/${fechamentoId}/atualizar-itens/`, itens);
    return res.data;
  },

  async parseWhatsApp(fechamentoId: number | string, texto: string, aplicar: boolean = false) {
    const res = await api.post(`/api/faltas/fechamentos/${fechamentoId}/parser-whatsapp/`, {
      texto,
      aplicar
    });
    return res.data;
  },

  async getResumoRegionais(fechamentoId: number | string) {
    const res = await api.get(`/api/faltas/fechamentos/${fechamentoId}/resumo-regionais/`);
    return res.data;
  },

  async getResumoEmailsProtege(fechamentoId: number | string) {
    const res = await api.get(`/api/faltas/fechamentos/${fechamentoId}/resumo-emails-protege/`);
    return res.data;
  },

  getDownloadProtegeExcelUrl(fechamentoId: number | string) {
    return `${getBaseApiUrl()}/api/faltas/fechamentos/${fechamentoId}/exportar-protege-excel/`;
  },

  // Lojas & Tarifas
  async getLojas(params?: any) {
    const res = await api.get('/api/faltas/lojas/lojas/', { params });
    return res.data;
  },

  async getCandidatasBaseOficial(params?: any) {
    const res = await api.get('/api/faltas/lojas/lojas/candidatas-base/', { params });
    return res.data;
  },

  async adicionarLojaDaBase(data: {
    loja_base_id: number | string;
    cliente_codigo?: string;
    cliente_id?: number | string;
    desconto_por_falta?: number | string;
    regiao_id?: number | string;
    reativar?: boolean;
  }) {
    const res = await api.post('/api/faltas/lojas/lojas/adicionar-da-base/', data);
    return res.data;
  },

  async toggleLojaAtivo(id: number | string) {
    const res = await api.post(`/api/faltas/lojas/lojas/${id}/toggle-ativo/`);
    return res.data;
  },

  async inativarLoja(id: number | string) {
    const res = await api.post(`/api/faltas/lojas/lojas/${id}/inativar/`);
    return res.data;
  },

  async ativarLoja(id: number | string) {
    const res = await api.post(`/api/faltas/lojas/lojas/${id}/ativar/`);
    return res.data;
  },

  async atualizarLoja(id: number | string, data: any) {
    const res = await api.patch(`/api/faltas/lojas/lojas/${id}/`, data);
    return res.data;
  },

  async atualizarPrecosLote(items: any[]) {
    const res = await api.post('/api/faltas/lojas/lojas/atualizar-precos/', items);
    return res.data;
  },

  async getRegioes() {
    const res = await api.get('/api/faltas/lojas/regioes/');
    return res.data;
  },

  async atualizarRegiao(id: number | string, data: any) {
    const res = await api.patch(`/api/faltas/lojas/regioes/${id}/`, data);
    return res.data;
  },

  // Relatórios & KPIs
  async getKPIs() {
    const res = await api.get('/api/relatorios/dashboard-kpis/');
    return res.data;
  },

  getDownloadExcelUrl(fechamentoId: number | string) {
    return `${getBaseApiUrl()}/api/relatorios/exportar-excel/${fechamentoId}/`;
  },

  getDownloadAnoExcelUrl(ano: number | string, clienteId: string = '') {
    return `${getBaseApiUrl()}/api/relatorios/exportar-ano/${ano}/?cliente_id=${clienteId}`;
  },

  // Colaboradores
  async getColaboradores() {
    const res = await api.get('/api/gestao-faltas/colaboradores/colaboradores/');
    return res.data;
  },

  async getColaboradoresLoja(lojaId: number | string) {
    const res = await api.get(`/api/gestao-faltas/colaboradores/colaboradores/?loja=${lojaId}&status=ATIVO`);
    return res.data;
  },

  async criarColaborador(dados: any) {
    const res = await api.post('/api/gestao-faltas/colaboradores/colaboradores/', dados);
    return res.data;
  },

  async atualizarColaborador(id: number | string, dados: any) {
    const res = await api.patch(`/api/gestao-faltas/colaboradores/colaboradores/${id}/`, dados);
    return res.data;
  },

  async excluirColaborador(id: number | string) {
    const res = await api.delete(`/api/gestao-faltas/colaboradores/colaboradores/${id}/`);
    return res.data;
  },

  async getTerminosExperiencia() {
    const res = await api.get('/api/gestao-faltas/colaboradores/colaboradores/terminos-experiencia/');
    return res.data;
  },

  // Detalhe Gerador
  async getDetalheGerador(fechamentoId: number | string, lojaId: number | string | null = null) {
    const url = lojaId 
      ? `/api/faltas/fechamentos/${fechamentoId}/detalhe-gerador/?loja_id=${lojaId}`
      : `/api/faltas/fechamentos/${fechamentoId}/detalhe-gerador/`;
    const res = await api.get(url);
    return res.data;
  },

  getDownloadDetalheExcelUrl(fechamentoId: number | string, lojaId: number | string | null = null) {
    return lojaId
      ? `${getBaseApiUrl()}/api/faltas/fechamentos/${fechamentoId}/exportar-detalhe-excel/?loja_id=${lojaId}`
      : `${getBaseApiUrl()}/api/faltas/fechamentos/${fechamentoId}/exportar-detalhe-excel/`;
  },

  // Shopping Butantã
  async getShoppingsButanta() {
    const res = await api.get('/api/butanta/shoppings/');
    return res.data;
  },

  async addShoppingButanta(nome: string) {
    const res = await api.post('/api/butanta/shoppings/', { nome });
    return res.data;
  },

  async deleteShoppingButanta(id: number | string) {
    const res = await api.delete(`/api/butanta/shoppings/${id}/`);
    return res.data;
  },

  async parseQuadroButanta(text: string, autoSplit: boolean = true, autoDate: boolean = true, shopping: string | null = null) {
    const res = await api.post('/api/butanta/parse/', {
      text,
      auto_split: autoSplit,
      auto_date: autoDate,
      shopping
    });
    return res.data;
  },

  async getRecordsButanta(filters: any = {}) {
    const params = new URLSearchParams();
    if (filters.month) params.set('month', filters.month);
    if (filters.search) params.set('search', filters.search);
    if (filters.turno && filters.turno !== 'todos') params.set('turno', filters.turno);
    if (filters.shopping && filters.shopping !== 'todos') params.set('shopping', filters.shopping);

    const res = await api.get(`/api/butanta/records/?${params.toString()}`);
    return res.data;
  },

  async getRecordButanta(id: number | string) {
    const res = await api.get(`/api/butanta/records/${id}/`);
    return res.data;
  },

  async saveRecordsButanta(records: any[], autoMerge: boolean = true) {
    const res = await api.post('/api/butanta/records/', {
      records,
      auto_merge: autoMerge
    });
    return res.data;
  },

  async updateRecordButanta(id: number | string, recordData: any) {
    const res = await api.put(`/api/butanta/records/${id}/`, recordData);
    return res.data;
  },

  async deleteRecordButanta(id: number | string) {
    const res = await api.delete(`/api/butanta/records/${id}/`);
    return res.data;
  },

  async clearRecordsButanta() {
    const res = await api.post('/api/butanta/records/clear/');
    return res.data;
  },

  async getSummaryButanta(month: string = '', shopping: string = '') {
    const params = new URLSearchParams();
    if (month) params.set('month', month);
    if (shopping && shopping !== 'todos') params.set('shopping', shopping);

    const res = await api.get(`/api/butanta/summary/?${params.toString()}`);
    return res.data;
  },

  getDownloadButantaExcelUrl(month: string = '', shopping: string = '') {
    const params = new URLSearchParams();
    if (month) params.set('month', month);
    if (shopping && shopping !== 'todos') params.set('shopping', shopping);
    return `${getBaseApiUrl()}/api/butanta/export/excel/?${params.toString()}`;
  },

  getDownloadButantaCsvUrl(month: string = '', shopping: string = '', type: string = 'daily') {
    const params = new URLSearchParams({ type });
    if (month) params.set('month', month);
    if (shopping && shopping !== 'todos') params.set('shopping', shopping);
    return `${getBaseApiUrl()}/api/butanta/export/csv/?${params.toString()}`;
  },

  // Atacadão & Assaí
  async processarAtacadaoAssai(formData: FormData) {
    const res = await api.post('/api/fechamento-atacadao-assai/processar/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  async getUltimoFechamentoAtacadaoAssai(mes?: number, ano?: number) {
    const params = new URLSearchParams();
    if (mes) params.append('mes', mes.toString());
    if (ano) params.append('ano', ano.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await api.get(`/api/fechamento-atacadao-assai/ultimo/${query}`);
    return res.data;
  },

  async limparFechamentoAtacadaoAssai() {
    const res = await api.delete('/api/fechamento-atacadao-assai/ultimo/');
    return res.data;
  },

  getDownloadAtacadaoAssaiExcelUrl(mes?: number, ano?: number) {
    const params = new URLSearchParams();
    if (mes) params.append('mes', mes.toString());
    if (ano) params.append('ano', ano.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return `${getBaseApiUrl()}/api/fechamento-atacadao-assai/exportar-excel/${query}`;
  },

  getDownloadAtacadaoAssaiZipUrl(mes?: number, ano?: number) {
    const params = new URLSearchParams();
    if (mes) params.append('mes', mes.toString());
    if (ano) params.append('ano', ano.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return `${getBaseApiUrl()}/api/fechamento-atacadao-assai/exportar-zip/${query}`;
  },

  getDownloadLojaPdfUrl(loja: string, mes?: number, ano?: number) {
    const params = new URLSearchParams();
    params.append('loja', loja);
    if (mes) params.append('mes', mes.toString());
    if (ano) params.append('ano', ano.toString());
    return `${getBaseApiUrl()}/api/fechamento-atacadao-assai/exportar-loja-pdf/?${params.toString()}`;
  },

  async getQuadrosAtacadaoAssai() {
    const res = await api.get('/api/fechamento-atacadao-assai/quadros/');
    return res.data;
  },

  async salvarQuadroAtacadaoAssai(quadroData: Record<string, unknown>) {
    if (quadroData.id) {
      const res = await api.put(`/api/fechamento-atacadao-assai/quadros/${quadroData.id}/`, quadroData);
      return res.data;
    } else {
      const res = await api.post('/api/fechamento-atacadao-assai/quadros/', quadroData);
      return res.data;
    }
  },

  async excluirQuadroAtacadaoAssai(id: number | string) {
    const res = await api.delete(`/api/fechamento-atacadao-assai/quadros/${id}/`);
    return res.data;
  },

  async enviarCargaQuadrosAtacadaoAssai(textoCarga: string, substituirExistentes: boolean = false) {
    const res = await api.post('/api/fechamento-atacadao-assai/quadros/carga-texto/', {
      texto: textoCarga,
      substituir: substituirExistentes,
    });
    return res.data;
  },

  async getDiariasAtacadaoAssai() {
    const res = await api.get('/api/fechamento-atacadao-assai/diarias/');
    return res.data;
  },

  async salvarDiariaAtacadaoAssai(diariaData: Record<string, unknown>) {
    if (diariaData.id) {
      const res = await api.put(`/api/fechamento-atacadao-assai/diarias/${diariaData.id}/`, diariaData);
      return res.data;
    } else {
      const res = await api.post('/api/fechamento-atacadao-assai/diarias/', diariaData);
      return res.data;
    }
  },

  async criarDiariaAtacadaoAssai(diariaData: Record<string, unknown>) {
    return this.salvarDiariaAtacadaoAssai(diariaData);
  },

  async excluirDiariaAtacadaoAssai(id: number | string) {
    const res = await api.delete(`/api/fechamento-atacadao-assai/diarias/${id}/`);
    return res.data;
  },

  async getHistoricoAtacadaoAssai() {
    const res = await api.get('/api/fechamento-atacadao-assai/historico/');
    return res.data;
  },
};

export const apiFaltas = gestaoFaltasApi;
export default gestaoFaltasApi;

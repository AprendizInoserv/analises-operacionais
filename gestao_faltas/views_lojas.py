from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from .models import Cliente, Regiao, LojaTarifa
from .serializers import ClienteSerializer, RegiaoSerializer, LojaSerializer


class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all().order_by('nome')
    serializer_class = ClienteSerializer
    permission_classes = [AllowAny]


class RegiaoViewSet(viewsets.ModelViewSet):
    queryset = Regiao.objects.all().order_by('ordem', 'nome')
    serializer_class = RegiaoSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        cliente_id = self.request.query_params.get('cliente')
        cliente_codigo = self.request.query_params.get('cliente_codigo')
        if cliente_codigo:
            qs = qs.filter(cliente__codigo=cliente_codigo)
        elif cliente_id:
            qs = qs.filter(cliente_id=cliente_id)
        return qs


class LojaViewSet(viewsets.ModelViewSet):
    queryset = LojaTarifa.objects.all().select_related('cliente', 'regiao', 'loja_base', 'loja_base__coordenador', 'loja_base__supervisor').order_by('regiao__ordem', 'ordem', 'nome')
    serializer_class = LojaSerializer

    def get_permissions(self):
        """
        Garante que operações de escrita (adicionar, alterar tarifas, alternar status ativo/inativo)
        exijam usuário autenticado no sistema, preservando a segurança diretamente na API.
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'atualizar_precos_em_lote', 'adicionar_da_base', 'toggle_ativo', 'inativar', 'ativar']:
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_queryset(self):
        qs = super().get_queryset()
        cliente_id = self.request.query_params.get('cliente')
        cliente_codigo = self.request.query_params.get('cliente_codigo')
        regiao_id = self.request.query_params.get('regiao')
        ativo = self.request.query_params.get('ativo')
        busca = self.request.query_params.get('busca')

        if cliente_codigo:
            qs = qs.filter(cliente__codigo=cliente_codigo)
        elif cliente_id:
            qs = qs.filter(cliente_id=cliente_id)

        if regiao_id:
            qs = qs.filter(regiao_id=regiao_id)

        if ativo is not None and ativo != '':
            qs = qs.filter(ativo=ativo.lower() in ['true', '1'])

        if busca:
            busca_clean = busca.strip()
            from django.db.models import Q
            qs = qs.filter(
                Q(nome__icontains=busca_clean) |
                Q(regiao__nome__icontains=busca_clean) |
                Q(supervisor__icontains=busca_clean) |
                Q(codigo_filial__icontains=busca_clean)
            )

        return qs

    @action(detail=False, methods=['get'], url_path='candidatas-base')
    def candidatas_base_oficial(self, request):
        """
        Retorna lojas candidatas da base oficial (lojas.models.Loja) para vínculo ao fechamento.
        Valida o status da loja na base oficial (ATIVA vs INATIVA) e indica se a loja já está
        vinculada a este cliente (fechamento) e qual é seu estado atual (ativa/inativa).
        """
        from lojas.models import Loja

        cliente_codigo = request.query_params.get('cliente_codigo')
        cliente_id = request.query_params.get('cliente')
        busca = request.query_params.get('busca', '').strip()

        cliente = None
        if cliente_codigo:
            cliente = Cliente.objects.filter(codigo=cliente_codigo).first()
        elif cliente_id:
            cliente = Cliente.objects.filter(id=cliente_id).first()

        # Mapa de lojas já vinculadas a este cliente específico
        vinculadas_map = {}
        if cliente:
            for lt in LojaTarifa.objects.filter(cliente=cliente):
                if lt.loja_base_id:
                    vinculadas_map[lt.loja_base_id] = lt
                vinculadas_map[lt.nome.strip().lower()] = lt

        lojas_qs = Loja.objects.all().select_related('supervisor', 'coordenador').order_by('nome_referencia')
        if busca:
            from django.db.models import Q
            lojas_qs = lojas_qs.filter(
                Q(nome_referencia__icontains=busca) |
                Q(cliente__icontains=busca) |
                Q(centro_de_custo__icontains=busca)
            )

        candidatas = []
        for l in lojas_qs[:200]:  # Limita para performance ágil no seletor
            ja_vinculada = False
            ativo_no_fechamento = None
            loja_tarifa_id = None

            if l.id in vinculadas_map:
                lt = vinculadas_map[l.id]
                ja_vinculada = True
                ativo_no_fechamento = lt.ativo
                loja_tarifa_id = lt.id
            elif l.nome_referencia.strip().lower() in vinculadas_map:
                lt = vinculadas_map[l.nome_referencia.strip().lower()]
                ja_vinculada = True
                ativo_no_fechamento = lt.ativo
                loja_tarifa_id = lt.id

            is_ativa_oficial = (l.status == 'ATIVA')
            candidatas.append({
                "id": l.id,
                "nome_referencia": l.nome_referencia,
                "cliente": l.cliente or "",
                "centro_de_custo": l.centro_de_custo or "",
                "codigo_loja": l.codigo_loja,
                "status_oficial": l.status,
                "pode_adicionar": is_ativa_oficial and (not ja_vinculada or not ativo_no_fechamento),
                "motivo_bloqueio": (
                    "Loja está INATIVA na base oficial de lojas." if not is_ativa_oficial
                    else ("Loja já está vinculada e ATIVA neste fechamento." if (ja_vinculada and ativo_no_fechamento)
                    else None)
                ),
                "coordenador_nome": l.coordenador.nome if l.coordenador else "",
                "supervisor_nome": l.supervisor.nome if l.supervisor else "",
                "vinculada": ja_vinculada,
                "ativo_no_fechamento": ativo_no_fechamento,
                "loja_tarifa_id": loja_tarifa_id,
            })

        return Response(candidatas)

    @action(detail=False, methods=['post'], url_path='adicionar-da-base')
    def adicionar_da_base(self, request):
        """
        Adiciona uma loja da base oficial ao fechamento do cliente selecionado.
        
        Regras aplicadas no backend:
        1. Lojas candidatas vêm da base oficial existente (lojas.models.Loja).
        2. Só lojas ATIVAS na base oficial podem ser adicionadas. Se inativa, bloqueia com 400.
        3. O estado de ativação é independente por fechamento.
        4. Não permite a mesma loja duas vezes ativa no mesmo fechamento.
        5. Se já vinculada mas inativa, permite 'Reativar' em vez de duplicar.
        """
        from lojas.models import Loja

        loja_base_id = request.data.get('loja_base_id')
        cliente_codigo = request.data.get('cliente_codigo')
        cliente_id = request.data.get('cliente_id')
        regiao_id = request.data.get('regiao_id')
        desconto_por_falta = request.data.get('desconto_por_falta', 0)
        reativar_val = request.data.get('reativar', False)
        reativar = (reativar_val is True) or (str(reativar_val).lower() in ['true', '1'])

        if not loja_base_id:
            return Response({"error": "Selecione uma loja da base oficial."}, status=status.HTTP_400_BAD_REQUEST)

        # Localiza o cliente
        cliente = None
        if cliente_codigo:
            cliente = Cliente.objects.filter(codigo=cliente_codigo).first()
        elif cliente_id:
            cliente = Cliente.objects.filter(id=cliente_id).first()

        if not cliente:
            return Response({"error": "Cliente do fechamento não informado ou inexistente."}, status=status.HTTP_400_BAD_REQUEST)

        # Localiza a loja na base oficial
        try:
            loja_base = Loja.objects.select_related('coordenador', 'supervisor').get(id=loja_base_id)
        except Loja.DoesNotExist:
            return Response({"error": "Loja não encontrada na base oficial de lojas."}, status=status.HTTP_404_NOT_FOUND)

        # REGRA 2: Só lojas ATIVAS na base oficial podem ser adicionadas
        if loja_base.status != 'ATIVA':
            return Response(
                {"error": f"A loja '{loja_base.nome_referencia}' está INATIVA na base oficial de lojas e não pode ser vinculada ao fechamento."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # REGRA 4 e 5: Verificar se já existe vínculo neste fechamento
        loja_existente = LojaTarifa.objects.filter(
            cliente=cliente,
            loja_base=loja_base
        ).first()

        if not loja_existente:
            # Fallback por nome exato
            loja_existente = LojaTarifa.objects.filter(
                cliente=cliente,
                nome__iexact=loja_base.nome_referencia
            ).first()

        if loja_existente:
            if loja_existente.ativo:
                return Response(
                    {"error": f"A loja '{loja_base.nome_referencia}' já está vinculada e ATIVA no fechamento do cliente {cliente.nome}."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            else:
                # Se estiver inativa e o usuário solicitou reativação
                if reativar:
                    loja_existente.ativo = True
                    loja_existente.loja_base = loja_base
                    if desconto_por_falta:
                        try:
                            loja_existente.desconto_por_falta = Decimal(str(desconto_por_falta))
                        except Exception:
                            pass
                    loja_existente.save()
                    return Response({
                        "message": f"A loja '{loja_existente.nome}' foi reativada com sucesso no fechamento {cliente.nome}.",
                        "data": LojaSerializer(loja_existente).data,
                        "reativada": True
                    }, status=status.HTTP_200_OK)
                else:
                    return Response({
                        "error": f"A loja '{loja_base.nome_referencia}' já está vinculada a este fechamento, porém está INATIVA.",
                        "pode_reativar": True,
                        "loja_tarifa_id": loja_existente.id
                    }, status=status.HTTP_409_CONFLICT)

        # Define região de fechamento
        regiao = None
        if regiao_id:
            regiao = Regiao.objects.filter(id=regiao_id, cliente=cliente).first()
        if not regiao:
            regiao = cliente.regioes.first()

        if not regiao:
            # Cria região padrão caso nenhuma exista para este cliente
            regiao = Regiao.objects.create(
                cliente=cliente,
                nome=f"REGIONAL GERAL ({cliente.nome})"
            )

        try:
            tarifa_dec = Decimal(str(desconto_por_falta or 0))
        except Exception:
            tarifa_dec = Decimal('0.0000')

        nova_loja = LojaTarifa.objects.create(
            cliente=cliente,
            regiao=regiao,
            loja_base=loja_base,
            nome=loja_base.nome_referencia,
            codigo_filial=str(loja_base.codigo_loja or ''),
            supervisor=loja_base.supervisor.nome if loja_base.supervisor else '',
            coordenacao=loja_base.coordenador.nome if loja_base.coordenador else '',
            desconto_por_falta=tarifa_dec,
            ativo=True
        )

        return Response({
            "message": f"Loja '{nova_loja.nome}' vinculada com sucesso ao fechamento {cliente.nome}!",
            "data": LojaSerializer(nova_loja).data,
            "criada": True
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='toggle-ativo')
    def toggle_ativo(self, request, pk=None):
        """
        Alterna o estado ativo/inativo da loja neste fechamento específico.
        Nunca altera a base oficial nem afeta outros clientes/fechamentos.
        Preserva 100% dos dados históricos.
        """
        loja = self.get_object()
        loja.ativo = not loja.ativo
        loja.save(update_fields=['ativo', 'atualizado_em'])
        status_txt = "ativada" if loja.ativo else "inativada"
        return Response({
            "message": f"Loja '{loja.nome}' {status_txt} com sucesso para o fechamento {loja.cliente.nome}.",
            "id": loja.id,
            "ativo": loja.ativo,
            "nome": loja.nome
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='inativar')
    def inativar_loja(self, request, pk=None):
        loja = self.get_object()
        loja.ativo = False
        loja.save(update_fields=['ativo', 'atualizado_em'])
        return Response({
            "message": f"Loja '{loja.nome}' inativada com sucesso para o fechamento {loja.cliente.nome}.",
            "id": loja.id,
            "ativo": False
        })

    @action(detail=True, methods=['post'], url_path='ativar')
    def ativar_loja(self, request, pk=None):
        loja = self.get_object()
        loja.ativo = True
        loja.save(update_fields=['ativo', 'atualizado_em'])
        return Response({
            "message": f"Loja '{loja.nome}' ativada com sucesso para o fechamento {loja.cliente.nome}.",
            "id": loja.id,
            "ativo": True
        })

    @action(detail=False, methods=['post'], url_path='atualizar-precos')
    def atualizar_precos_em_lote(self, request):
        items = request.data
        if not isinstance(items, list):
            return Response(
                {"error": "O corpo deve ser uma lista de objetos com id e desconto_por_falta"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        updated_count = 0
        for item in items:
            loja_id = item.get('id')
            novo_valor = item.get('desconto_por_falta')
            if loja_id is not None and novo_valor is not None:
                LojaTarifa.objects.filter(id=loja_id).update(desconto_por_falta=novo_valor)
                updated_count += 1

        return Response({
            "message": f"{updated_count} tarifa(s) de loja atualizada(s) com sucesso.",
            "updated": updated_count
        })

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
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
        if cliente_id:
            qs = qs.filter(cliente_id=cliente_id)
        return qs


class LojaViewSet(viewsets.ModelViewSet):
    queryset = LojaTarifa.objects.all().order_by('regiao__ordem', 'ordem', 'nome')
    serializer_class = LojaSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        cliente_id = self.request.query_params.get('cliente')
        regiao_id = self.request.query_params.get('regiao')
        ativo = self.request.query_params.get('ativo')
        if cliente_id:
            qs = qs.filter(cliente_id=cliente_id)
        if regiao_id:
            qs = qs.filter(regiao_id=regiao_id)
        if ativo is not None:
            qs = qs.filter(ativo=ativo.lower() in ['true', '1'])
        return qs

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
            "message": f"{updated_count} loja(s) atualizada(s) com sucesso.",
            "updated": updated_count
        })

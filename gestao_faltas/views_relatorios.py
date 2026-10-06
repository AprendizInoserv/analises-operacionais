from django.http import HttpResponse, Http404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.db.models import Sum, Count, Avg
from .models import Fechamento, ItemFechamento, Cliente, LojaTarifa
from .services.relatorios import gerar_excel_fechamento, gerar_excel_ano_completo


class ExportarExcelFechamentoView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            fechamento = Fechamento.objects.select_related('cliente').get(pk=pk)
        except Fechamento.DoesNotExist:
            raise Http404("Fechamento não encontrado.")

        buffer = gerar_excel_fechamento(fechamento)
        nome_arquivo = f"FECHAMENTO_{fechamento.cliente.nome.upper()}_{fechamento.ano_referencia}_{fechamento.mes_referencia:02d}.xlsx"

        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="{nome_arquivo}"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response


class ExportarExcelAnoView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, ano):
        cliente_id = request.query_params.get('cliente_id')
        if cliente_id:
            cliente = Cliente.objects.filter(pk=cliente_id).first()
        else:
            cliente = Cliente.objects.first()

        if not cliente:
            return Response({"error": "Cliente não encontrado."}, status=status.HTTP_404_NOT_FOUND)

        buffer = gerar_excel_ano_completo(cliente, ano)
        nome_arquivo = f"{cliente.nome.upper()}_{ano}_COMPLETO.xlsx"

        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="{nome_arquivo}"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response


class DashboardKPIsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        total_fechamentos = Fechamento.objects.count()
        total_lojas = LojaTarifa.objects.filter(ativo=True).count()
        
        ultimo_fechamento = Fechamento.objects.order_by('-ano_referencia', '-mes_referencia').first()
        
        agregados = Fechamento.objects.aggregate(
            total_faltas=Sum('total_faltas'),
            total_desconto=Sum('total_desconto')
        )
        
        historico_recente = Fechamento.objects.order_by('-ano_referencia', '-mes_referencia')[:6]
        historico_dados = [
            {
                "id": f.id,
                "titulo": f.titulo,
                "periodo": f.periodo_formatado,
                "mes": f.mes_referencia,
                "ano": f.ano_referencia,
                "total_faltas": f.total_faltas,
                "total_desconto": float(f.total_desconto),
                "status": f.status
            }
            for f in reversed(historico_recente)
        ]

        return Response({
            "total_fechamentos": total_fechamentos,
            "total_lojas_ativas": total_lojas,
            "total_faltas_acumuladas": agregados['total_faltas'] or 0,
            "total_descontos_acumulados": float(agregados['total_desconto'] or 0.0),
            "ultimo_fechamento": {
                "id": ultimo_fechamento.id,
                "titulo": ultimo_fechamento.titulo,
                "periodo": ultimo_fechamento.periodo_formatado,
                "total_faltas": ultimo_fechamento.total_faltas,
                "total_desconto": float(ultimo_fechamento.total_desconto),
                "status": ultimo_fechamento.status
            } if ultimo_fechamento else None,
            "historico": historico_dados
        })

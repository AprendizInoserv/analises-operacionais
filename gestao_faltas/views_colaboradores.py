from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from datetime import date, timedelta
from .models import ColaboradorFaltas
from .serializers import ColaboradorSerializer


class ColaboradorViewSet(viewsets.ModelViewSet):
    queryset = ColaboradorFaltas.objects.all().order_by('nome')
    serializer_class = ColaboradorSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        loja_id = self.request.query_params.get('loja')
        status_val = self.request.query_params.get('status')
        if loja_id:
            qs = qs.filter(loja_id=loja_id)
        if status_val:
            qs = qs.filter(status=status_val)
        return qs

    @action(detail=False, methods=['get'], url_path='terminos-experiencia')
    def terminos_experiencia(self, request):
        hoje = date.today()
        limite = hoje + timedelta(days=30)
        
        proximos_45 = ColaboradorFaltas.objects.filter(
            status='ATIVO',
            termino_experiencia_45__gte=hoje,
            termino_experiencia_45__lte=limite
        )
        proximos_90 = ColaboradorFaltas.objects.filter(
            status='ATIVO',
            termino_experiencia_90__gte=hoje,
            termino_experiencia_90__lte=limite
        )
        
        return Response({
            'proximos_45_dias': ColaboradorSerializer(proximos_45, many=True).data,
            'proximos_90_dias': ColaboradorSerializer(proximos_90, many=True).data,
        })

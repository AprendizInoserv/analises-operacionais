from rest_framework import serializers
from .models import (
    Cliente, 
    Regiao, 
    LojaTarifa, 
    ColaboradorFaltas, 
    Fechamento, 
    ItemFechamento, 
    QuadroLoja, 
    DiariaManual, 
    HistoricoProcessamento,
    ButantaShopping,
    ButantaRegistro
)


class ClienteSerializer(serializers.ModelSerializer):
    total_lojas = serializers.SerializerMethodField()

    class Meta:
        model = Cliente
        fields = ['id', 'nome', 'codigo', 'ativo', 'descricao', 'total_lojas']

    def get_total_lojas(self, obj):
        return obj.lojas.filter(ativo=True).count()


class RegiaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Regiao
        fields = '__all__'


class LojaSerializer(serializers.ModelSerializer):
    regiao_nome = serializers.CharField(source='regiao.nome', read_only=True)
    cliente_nome = serializers.CharField(source='cliente.nome', read_only=True)

    class Meta:
        model = LojaTarifa
        fields = [
            'id', 'cliente', 'cliente_nome', 'regiao', 'regiao_nome',
            'nome', 'codigo_filial', 'sigla', 'centro', 'formato',
            'endereco', 'supervisor', 'telefone', 'email_contatos',
            'desconto_por_falta', 'ativo', 'ordem'
        ]


class ColaboradorSerializer(serializers.ModelSerializer):
    loja_nome = serializers.CharField(source='loja.nome', read_only=True)

    class Meta:
        model = ColaboradorFaltas
        fields = '__all__'


class ItemFechamentoSerializer(serializers.ModelSerializer):
    loja_nome = serializers.CharField(source='loja.nome', read_only=True)
    loja_sigla = serializers.CharField(source='loja.sigla', read_only=True)
    loja_centro = serializers.CharField(source='loja.centro', read_only=True)
    regiao_id = serializers.IntegerField(source='loja.regiao.id', read_only=True)
    supervisor = serializers.CharField(source='loja.supervisor', read_only=True)
    email_contatos = serializers.CharField(source='loja.email_contatos', read_only=True)

    class Meta:
        model = ItemFechamento
        fields = [
            'id', 'fechamento', 'loja', 'loja_nome', 'loja_sigla', 'loja_centro',
            'regiao_id', 'regiao_nome', 'valor_falta_aplicado', 'faltas_computadas',
            'desconto_total', 'cargo', 'status_data', 'respondido_whatsapp',
            'texto_original_whatsapp', 'observacao', 'ordem', 'supervisor', 'email_contatos'
        ]


class FechamentoSerializer(serializers.ModelSerializer):
    cliente_nome = serializers.CharField(source='cliente.nome', read_only=True)
    cliente_codigo = serializers.CharField(source='cliente.codigo', read_only=True)
    itens = ItemFechamentoSerializer(many=True, read_only=True)
    periodo_formatado = serializers.CharField(read_only=True)

    class Meta:
        model = Fechamento
        fields = [
            'id', 'cliente', 'cliente_nome', 'cliente_codigo', 'titulo',
            'mes_referencia', 'ano_referencia', 'data_inicio', 'data_fim',
            'periodo_formatado', 'status', 'total_faltas', 'total_desconto',
            'observacoes', 'arquivo_gerado', 'criado_em', 'atualizado_em', 'itens'
        ]


class FechamentoCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fechamento
        fields = '__all__'


class QuadroLojaSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuadroLoja
        fields = '__all__'


class DiariaManualSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiariaManual
        fields = '__all__'


class HistoricoProcessamentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = HistoricoProcessamento
        fields = '__all__'


class ButantaShoppingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ButantaShopping
        fields = '__all__'


class ButantaRegistroSerializer(serializers.ModelSerializer):
    class Meta:
        model = ButantaRegistro
        fields = '__all__'

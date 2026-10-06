from django.db import models
from decimal import Decimal


class Cliente(models.Model):
    nome = models.CharField(max_length=150, unique=True)
    codigo = models.SlugField(max_length=50, unique=True, default='carrefour')
    ativo = models.BooleanField(default=True)
    descricao = models.TextField(blank=True, null=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'gestao_faltas_cliente'
        verbose_name = 'Cliente de Fechamento'
        verbose_name_plural = 'Clientes de Fechamento'
        ordering = ['nome']

    def __str__(self):
        return self.nome


class Regiao(models.Model):
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='regioes')
    nome = models.CharField(max_length=100)
    emails_padrao = models.TextField(
        blank=True, 
        null=True, 
        help_text="E-mails separados por ponto e vírgula (;)"
    )
    assunto_template = models.CharField(
        max_length=255, 
        default="{cliente} {regiao} - Fechamento ({data_inicio} até {data_fim})"
    )
    corpo_template = models.TextField(
        default="Boa Tarde, tudo bem?\n\nSegue fechamento {data_inicio} à {data_fim} conforme resumo abaixo:\n\n{tabela_resumo}\n\nFico à disposição."
    )
    ordem = models.PositiveIntegerField(default=0)
    ativo = models.BooleanField(default=True)

    class Meta:
        db_table = 'gestao_faltas_regiao'
        verbose_name = 'Região de Fechamento'
        verbose_name_plural = 'Regiões de Fechamento'
        ordering = ['ordem', 'nome']
        unique_together = ('cliente', 'nome')

    def __str__(self):
        return f"{self.nome} ({self.cliente.nome})"


class LojaTarifa(models.Model):
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='lojas')
    regiao = models.ForeignKey(Regiao, on_delete=models.CASCADE, related_name='lojas')
    nome = models.CharField(max_length=150)
    codigo_filial = models.CharField(max_length=50, blank=True, null=True)
    sigla = models.CharField(max_length=20, blank=True, null=True)
    centro = models.CharField(max_length=20, blank=True, null=True)
    formato = models.CharField(max_length=50, default='HIPER', blank=True, null=True)
    endereco = models.CharField(max_length=255, blank=True, null=True)
    supervisor = models.CharField(max_length=150, blank=True, null=True)
    telefone = models.CharField(max_length=50, blank=True, null=True)
    email_contatos = models.TextField(blank=True, null=True, help_text="E-mails específicos desta filial separados por ;")
    desconto_por_falta = models.DecimalField(
        max_digits=12, 
        decimal_places=4, 
        default=Decimal('0.0000'),
        help_text="Valor em R$ descontado por cada falta registrada"
    )
    ativo = models.BooleanField(default=True)
    ordem = models.PositiveIntegerField(default=0)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'gestao_faltas_loja'
        verbose_name = 'Loja & Tarifa'
        verbose_name_plural = 'Lojas & Tarifas'
        ordering = ['regiao__ordem', 'ordem', 'nome']
        unique_together = ('cliente', 'nome')

    def __str__(self):
        return f"{self.nome} - {self.regiao.nome} (R$ {self.desconto_por_falta:.2f})"

Loja = LojaTarifa


class ColaboradorFaltas(models.Model):
    STATUS_CHOICES = [
        ('ATIVO', 'Ativo'),
        ('FERIAS', 'Férias'),
        ('AFASTADO', 'Afastado'),
        ('DEMITIDO', 'Demitido'),
    ]

    nome = models.CharField(max_length=200)
    cpf = models.CharField(max_length=20, blank=True, null=True)
    matricula = models.CharField(max_length=50, blank=True, null=True)
    loja = models.ForeignKey(LojaTarifa, on_delete=models.CASCADE, related_name='colaboradores', null=True, blank=True)
    cargo = models.CharField(max_length=120, default='Operador de Limpeza')
    salario = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    data_admissao = models.DateField(blank=True, null=True)
    termino_experiencia_45 = models.DateField(blank=True, null=True, verbose_name="1º Término Experiência (45 dias)")
    termino_experiencia_90 = models.DateField(blank=True, null=True, verbose_name="2º Término Experiência (90 dias)")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ATIVO')
    turno = models.CharField(max_length=50, blank=True, null=True)
    horario = models.CharField(max_length=50, blank=True, null=True)
    observacoes = models.TextField(blank=True, null=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'gestao_faltas_colaborador'
        verbose_name = 'Colaborador (Fechamentos)'
        verbose_name_plural = 'Colaboradores (Fechamentos)'
        ordering = ['nome']

    def __str__(self):
        return f"{self.nome} ({self.loja.nome if self.loja else 'Sem Loja'})"

Colaborador = ColaboradorFaltas


class Fechamento(models.Model):
    STATUS_CHOICES = [
        ('RASCUNHO', 'Rascunho / Em Andamento'),
        ('CONCLUIDO', 'Fechamento Concluído'),
        ('ENVIADO', 'E-mails Enviados'),
    ]

    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='fechamentos')
    titulo = models.CharField(max_length=200, help_text="Ex: CARREFOUR - Fechamento (20/08 até 19/09)")
    mes_referencia = models.PositiveSmallIntegerField(default=1, help_text="Mês de término (1 a 12)")
    ano_referencia = models.PositiveIntegerField(default=2026)
    data_inicio = models.DateField(help_text="Início do período: sempre dia 20")
    data_fim = models.DateField(help_text="Fim do período: sempre dia 19")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='RASCUNHO')
    total_faltas = models.PositiveIntegerField(default=0)
    total_desconto = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    observacoes = models.TextField(blank=True, null=True)
    arquivo_gerado = models.FileField(upload_to='fechamentos/', blank=True, null=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'gestao_faltas_fechamento'
        verbose_name = 'Fechamento de Faltas'
        verbose_name_plural = 'Fechamentos de Faltas'
        ordering = ['-ano_referencia', '-mes_referencia', '-id']

    def __str__(self):
        return f"{self.cliente.nome} ({self.periodo_formatado}) - {self.get_status_display()}"

    @property
    def periodo_formatado(self):
        return f"{self.data_inicio.strftime('%d/%m')} até {self.data_fim.strftime('%d/%m')}"

    def recalcular_totais(self):
        itens = self.itens.all()
        soma_faltas = sum(item.faltas_computadas for item in itens)
        soma_desconto = sum(item.desconto_total for item in itens)
        self.total_faltas = soma_faltas
        self.total_desconto = round(Decimal(str(soma_desconto)), 2)
        self.save(update_fields=['total_faltas', 'total_desconto', 'atualizado_em'])
        return self.total_faltas, self.total_desconto


class ItemFechamento(models.Model):
    fechamento = models.ForeignKey(Fechamento, on_delete=models.CASCADE, related_name='itens')
    loja = models.ForeignKey(LojaTarifa, on_delete=models.CASCADE, related_name='itens_fechamento')
    regiao_nome = models.CharField(max_length=100, blank=True)
    valor_falta_aplicado = models.DecimalField(
        max_digits=12, 
        decimal_places=4,
        help_text="Desconto por falta congelado/utilizado neste fechamento"
    )
    faltas_computadas = models.PositiveIntegerField(default=0)
    desconto_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    cargo = models.CharField(max_length=150, default='AUX. DE LIMPEZA', blank=True, null=True)
    status_data = models.CharField(max_length=150, default='ok', help_text="Status exibido na coluna DATA (ex: ok, 02/08/2026)")
    respondido_whatsapp = models.BooleanField(default=False)
    texto_original_whatsapp = models.TextField(blank=True, null=True)
    observacao = models.TextField(blank=True, null=True)
    ordem = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'gestao_faltas_itemfechamento'
        verbose_name = 'Item do Fechamento'
        verbose_name_plural = 'Itens do Fechamento'
        ordering = ['fechamento', 'ordem', 'loja__regiao__ordem', 'loja__nome']
        unique_together = ('fechamento', 'loja')

    def save(self, *args, **kwargs):
        if not self.regiao_nome and self.loja and self.loja.regiao:
            self.regiao_nome = self.loja.regiao.nome
        if self.ordem == 0 and self.loja:
            self.ordem = self.loja.ordem
        self.desconto_total = round(Decimal(str(self.faltas_computadas)) * Decimal(str(self.valor_falta_aplicado)), 2)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.loja.nome}: {self.faltas_computadas} faltas = R$ {self.desconto_total:.2f}"


class QuadroLoja(models.Model):
    OPERACAO_CHOICES = [
        ('ATACADAO', 'Atacadão'),
        ('ASSAI', 'Assaí'),
    ]

    nome_loja = models.CharField(max_length=150, unique=True, help_text="Nome normalizado corporativo da filial")
    operacao = models.CharField(max_length=20, choices=OPERACAO_CHOICES, default='ATACADAO')
    quadro_previsto = models.PositiveIntegerField(default=0, help_text="Quantidade contratada de colaboradores")
    vigencia_inicio = models.DateField(null=True, blank=True, help_text="Início da vigência do quadro")
    vigencia_fim = models.DateField(null=True, blank=True, help_text="Fim da vigência (ou vazio para ativo)")
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'gestao_faltas_quadroloja'
        verbose_name = 'Quadro da Loja (Assaí/Atacadão)'
        verbose_name_plural = 'Quadros das Lojas (Assaí/Atacadão)'
        ordering = ['operacao', 'nome_loja']

    def __str__(self):
        return f"{self.nome_loja} ({self.get_operacao_display()}): {self.quadro_previsto} postos"


class DiariaManual(models.Model):
    nome_loja = models.CharField(max_length=150)
    data = models.DateField()
    quantidade = models.PositiveIntegerField(default=1)
    observacao = models.TextField(blank=True, default='')
    usuario_responsavel = models.CharField(max_length=100, default='Operador')
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'gestao_faltas_diariamanual'
        verbose_name = 'Diária Manual (Assaí/Atacadão)'
        verbose_name_plural = 'Diárias Manuais (Assaí/Atacadão)'
        ordering = ['-data', 'nome_loja']

    def __str__(self):
        return f"{self.nome_loja} - {self.data.strftime('%d/%m/%Y')}: {self.quantidade} diária(s)"


class HistoricoProcessamento(models.Model):
    mes_referencia = models.PositiveSmallIntegerField(default=8)
    ano_referencia = models.PositiveIntegerField(default=2026)
    total_lojas = models.PositiveIntegerField(default=0)
    total_esperado = models.PositiveIntegerField(default=0)
    resultado_total = models.PositiveIntegerField(default=0)
    comparativo_total = models.IntegerField(default=0)
    faltas_operacionais = models.PositiveIntegerField(default=0)
    total_inconsistencias = models.PositiveIntegerField(default=0)
    arquivo_excel = models.FileField(upload_to='fechamento_atacadao_assai/excel/', null=True, blank=True)
    arquivo_zip = models.FileField(upload_to='fechamento_atacadao_assai/zip/', null=True, blank=True)
    status = models.CharField(max_length=20, default='CONCLUIDO')
    dados_json = models.JSONField(null=True, blank=True, help_text="Cópia serializada dos dados do fechamento")
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'gestao_faltas_historicoprocessamento'
        verbose_name = 'Histórico de Processamento Assaí/Atacadão'
        verbose_name_plural = 'Históricos de Processamentos Assaí/Atacadão'
        ordering = ['-criado_em']

    def __str__(self):
        return f"Fechamento {self.mes_referencia:02d}/{self.ano_referencia} ({self.total_lojas} lojas) - {self.status}"


class ButantaShopping(models.Model):
    nome = models.CharField(max_length=150, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'shoppings'
        verbose_name = 'Shopping (Butantã)'
        verbose_name_plural = 'Shoppings (Butantã)'

    def __str__(self):
        return self.nome


class ButantaRegistro(models.Model):
    data_iso = models.CharField(max_length=20)
    data_formatada = models.CharField(max_length=20)
    turno = models.CharField(max_length=50)
    shopping = models.CharField(max_length=150, default='Shopping Butantã')
    presentes = models.IntegerField(default=0)
    folgas = models.IntegerField(default=0)
    faltas = models.IntegerField(default=0)
    atestados = models.IntegerField(default=0)
    apoio_noite = models.IntegerField(default=0)
    banheirista_apoio = models.IntegerField(default=0)
    outros = models.TextField(default='[]')
    observacoes = models.TextField(blank=True, default='')
    created_at = models.CharField(max_length=50, blank=True, null=True)
    updated_at = models.CharField(max_length=50, blank=True, null=True)

    class Meta:
        db_table = 'quadro_registros'
        verbose_name = 'Registro de Quadro Butantã'
        verbose_name_plural = 'Registros de Quadro Butantã'
        unique_together = ('data_iso', 'turno', 'shopping')

    def __str__(self):
        return f"{self.shopping} - {self.data_formatada} ({self.turno})"

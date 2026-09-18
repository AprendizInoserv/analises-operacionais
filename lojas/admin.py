from django.contrib import admin
from django.contrib.admin import EmptyFieldListFilter
from django.urls import reverse
from django.utils.html import format_html

from .models import (
    Cargo,
    ConfiguracaoInsalubridadeLoja,
    EscopoMensal,
    ItemEscopoMensal,
    LinhaFolha,
    Loja,
    Salario,
    Verba,
    Coordenador,
    Supervisor,
)
from .forms import EscopoMensalForm


class ConfiguracaoInsalubridadeLojaInline(admin.StackedInline):
    """Um bloco por loja: parâmetros de insalubridade da convenção."""

    model = ConfiguracaoInsalubridadeLoja
    can_delete = False
    max_num = 1
    extra = 1


@admin.register(Loja)
class LojaAdmin(admin.ModelAdmin):
    inlines = [ConfiguracaoInsalubridadeLojaInline]
    list_display = (
        "ver_escopos_mensais",
        "nome_referencia",
        "centro_de_custo",
        "cliente",
        "quadro",
        "coordenador",
        "supervisor",
        "status",
    )
    list_filter = ("status", "quadro", "cliente", "uf", "sub_regiao", "coordenador", "supervisor")
    search_fields = (
        "nome_referencia",
        "centro_de_custo",
        "cnpj",
        "cliente",
        "nome_metricas",
        "coordenador__nome",
        "supervisor__nome",
    )
    ordering = ("nome_referencia",)
    readonly_fields = ("created_at", "updated_at")

    fieldsets = (
        (
            "Identificação",
            {
                "fields": (
                    "nome_referencia",
                    "centro_de_custo",
                    "quadro",
                    "status",
                    "cliente",
                    "cnpj",
                    "codigo_loja",
                    "coordenador",
                    "supervisor",
                    "nome_metricas",
                ),
            },
        ),
        (
            "Nomes em outros sistemas e Regras",
            {
                "fields": (
                    "nome_geovictoria",
                    "dispensa_divergencia_ponto",
                    "nome_totvs",
                    "nome_financeiro",
                    "nome_findme",
                ),
            },
        ),
        (
            "Endereço",
            {
                "fields": (
                    "cep",
                    "rua",
                    "bairro",
                    "municipio",
                    "uf",
                    "sub_regiao",
                ),
            },
        ),
        (
            "Controle",
            {
                "fields": ("created_at", "updated_at"),
            },
        ),
    )

    @admin.display(description="Escopos")
    def ver_escopos_mensais(self, obj):
        url = reverse("admin:lojas_escopomensal_changelist")
        return format_html(
            '<a href="{}?loja__id__exact={}">Ver escopos</a>', url, obj.id
        )


@admin.register(Cargo)
class CargoAdmin(admin.ModelAdmin):
    search_fields = ("nome",)
    list_display = ("nome",)


@admin.register(Coordenador)
class CoordenadorAdmin(admin.ModelAdmin):
    """Permite listar e pesquisar coordenadores no admin Django."""

    search_fields = ("nome",)
    list_display = ("nome",)


@admin.register(Supervisor)
class SupervisorAdmin(admin.ModelAdmin):
    """Permite listar e pesquisar supervisores no admin Django."""

    search_fields = ("nome",)
    list_display = ("nome",)


@admin.register(Salario)
class SalarioAdmin(admin.ModelAdmin):
    list_display = ("cargo", "uf", "ano", "valor")
    list_filter = ("uf", "ano")
    search_fields = ("cargo__nome",)


class ItemEscopoMensalInline(admin.TabularInline):
    model = ItemEscopoMensal
    extra = 0
    autocomplete_fields = ("cargo",)


@admin.register(EscopoMensal)
class EscopoMensalAdmin(admin.ModelAdmin):
    form = EscopoMensalForm
    list_display = ("loja", "ano", "mes")
    list_filter = ("loja", "ano", "mes")
    autocomplete_fields = ("loja",)
    inlines = [ItemEscopoMensalInline]


@admin.register(Verba)
class VerbaAdmin(admin.ModelAdmin):
    list_display = (
        "codigo_verba",
        "descricao",
        "tipo_codigo",
        "categoria",
        "considerar_na_contagem",
    )
    list_filter = ("tipo_codigo", "considerar_na_contagem", "categoria")
    search_fields = ("codigo_verba", "descricao", "categoria")
    ordering = ("codigo_verba",)


@admin.register(LinhaFolha)
class LinhaFolhaAdmin(admin.ModelAdmin):
    list_display = (
        "matricula",
        "codigo_verba",
        "valor",
        "dt_arq",
        "dt_pagamento",
        "centro_custo_real",
        "loja",
        "arquivo_origem",
        "created_at",
    )
    list_filter = (
        "dt_arq",
        "codigo_verba",
        ("loja", EmptyFieldListFilter),
    )
    search_fields = ("matricula", "codigo_verba", "arquivo_origem", "centro_custo", "centro_custo_real")
    readonly_fields = ("created_at",)
    date_hierarchy = "dt_arq"
    ordering = ("-dt_arq", "matricula")



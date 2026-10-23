from django.db import models
from django.contrib.auth.models import Group, User
from django.utils import timezone

class RolePermission(models.Model):
    """
    Este modelo serve para registrar de forma dinâmica quais permissões (visualizar, cadastrar, 
    editar e excluir) cada grupo de usuários (Role/Group do Django) possui em cada módulo 
    da plataforma de análises operacionais.
    """
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="role_permissions")
    module = models.CharField(max_length=50)
    can_view = models.BooleanField(default=False)
    can_create = models.BooleanField(default=False)
    can_edit = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)

    class Meta:
        unique_together = ("group", "module")
        verbose_name = "Permissão de Role"
        verbose_name_plural = "Permissões de Role"

    def __str__(self):
        return f"{self.group.name} - {self.module} (View: {self.can_view}, Edit: {self.can_edit})"


class Aviso(models.Model):
    """
    Representa avisos e comunicados corporativos exibidos no primeiro login do dia dos usuários.
    Permite agendamento por calendário, visualização histórica e reenvio em novas datas.
    """
    titulo = models.CharField("Nome do Aviso", max_length=255)
    conteudo = models.TextField("Conteúdo do Aviso")
    data_inicio = models.DateField("Data de Início / Exibição")
    data_fim = models.DateField("Data de Término", blank=True, null=True)
    criado_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="avisos_criados",
        verbose_name="Criado por"
    )
    ativo = models.BooleanField("Ativo", default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Aviso"
        verbose_name_plural = "Avisos"
        ordering = ["-data_inicio", "-created_at"]

    def save(self, *args, **kwargs):
        if not self.data_fim:
            self.data_fim = self.data_inicio
        super().save(*args, **kwargs)

    @property
    def status_atual(self):
        import datetime
        hoje = timezone.localdate()
        if not self.ativo:
            return "inativo"
        data_fim_calc = self.data_fim or self.data_inicio
        if isinstance(data_fim_calc, str):
            try:
                data_fim_calc = datetime.date.fromisoformat(data_fim_calc)
            except Exception:
                pass
        data_inicio_calc = self.data_inicio
        if isinstance(data_inicio_calc, str):
            try:
                data_inicio_calc = datetime.date.fromisoformat(data_inicio_calc)
            except Exception:
                pass
        try:
            if data_fim_calc < hoje:
                return "expirado"
            elif data_inicio_calc > hoje:
                return "agendado"
        except TypeError:
            pass
        return "ativo"

    def __str__(self):
        return f"{self.titulo} ({self.data_inicio})"

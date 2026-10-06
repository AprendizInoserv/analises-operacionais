import re
import calendar
import unicodedata
from datetime import date
from decimal import Decimal
from django.http import HttpResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from .models import Fechamento, ItemFechamento, Cliente, Regiao, LojaTarifa
from .services.detalhe import gerar_matriz_detalhe, exportar_excel_detalhe
from .services.protege import exportar_excel_protege, MESES_NOMES
from .serializers import (
    FechamentoSerializer, 
    FechamentoCreateUpdateSerializer, 
    ItemFechamentoSerializer
)

def normalizar_texto(txt):
    if not txt:
        return ""
    nfkd = unicodedata.normalize('NFKD', str(txt))
    sem_acento = "".join([c for c in nfkd if not unicodedata.combining(c)])
    return re.sub(r'[^a-zA-Z0-9]', '', sem_acento).lower()


class FechamentoViewSet(viewsets.ModelViewSet):
    queryset = Fechamento.objects.all().order_by('-ano_referencia', '-mes_referencia', '-id')
    serializer_class = FechamentoSerializer
    permission_classes = [AllowAny]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return FechamentoCreateUpdateSerializer
        return FechamentoSerializer

    @action(detail=False, methods=['post'], url_path='inicializar')
    def inicializar_periodo(self, request):
        cliente_id = request.data.get('cliente_id')
        cliente_codigo = request.data.get('cliente_codigo')
        ano = int(request.data.get('ano', 2026))
        mes = int(request.data.get('mes', 9))

        if cliente_codigo:
            cliente = Cliente.objects.filter(codigo=cliente_codigo).first()
        elif cliente_id:
            cliente = Cliente.objects.filter(id=cliente_id).first()
        else:
            cliente = Cliente.objects.filter(codigo='carrefour').first() or Cliente.objects.first()

        if not cliente:
            return Response({"error": "Nenhum cliente cadastrado no sistema."}, status=status.HTTP_400_BAD_REQUEST)

        meses_nomes = [
            '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ]
        nome_mes = meses_nomes[mes] if 1 <= mes <= 12 else str(mes)

        if cliente.codigo == 'protege':
            dia_fim = calendar.monthrange(ano, mes)[1]
            data_inicio = date(ano, mes, 1)
            data_fim = date(ano, mes, dia_fim)
            titulo = f"{cliente.nome.upper()} - Fechamento {nome_mes}/{ano}"
        else:
            if mes == 1:
                ano_inicio = ano - 1
                mes_inicio = 12
            else:
                ano_inicio = ano
                mes_inicio = mes - 1

            data_inicio = date(ano_inicio, mes_inicio, 20)
            data_fim = date(ano, mes, 19)
            titulo = f"{cliente.nome.upper()} - Fechamento {nome_mes} ({data_inicio.strftime('%d/%m')} até {data_fim.strftime('%d/%m')})"

        fechamento, criado = Fechamento.objects.get_or_create(
            cliente=cliente,
            ano_referencia=ano,
            mes_referencia=mes,
            defaults={
                'titulo': titulo,
                'data_inicio': data_inicio,
                'data_fim': data_fim,
                'status': 'RASCUNHO'
            }
        )

        lojas = LojaTarifa.objects.filter(cliente=cliente, ativo=True).order_by('regiao__ordem', 'ordem', 'nome')
        for loja in lojas:
            cargo_padrao = loja.formato or 'AUX. DE LIMPEZA'
            ItemFechamento.objects.get_or_create(
                fechamento=fechamento,
                loja=loja,
                defaults={
                    'regiao_nome': loja.regiao.nome,
                    'valor_falta_aplicado': loja.desconto_por_falta,
                    'faltas_computadas': 0,
                    'desconto_total': Decimal('0.00'),
                    'cargo': cargo_padrao,
                    'ordem': loja.ordem or 0,
                    'status_data': 'ok'
                }
            )

        fechamento.recalcular_totais()
        serializer = FechamentoSerializer(fechamento)
        return Response(serializer.data, status=status.HTTP_201_CREATED if criado else status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='atualizar-itens')
    def atualizar_lote_respostas(self, request, pk=None):
        fechamento = self.get_object()
        itens_data = request.data
        if not isinstance(itens_data, list):
            return Response({"error": "Envie uma lista de itens para atualizar."}, status=status.HTTP_400_BAD_REQUEST)

        atualizados = 0
        for item_dict in itens_data:
            item_id = item_dict.get('id')
            if not item_id:
                continue
            item = ItemFechamento.objects.filter(id=item_id, fechamento=fechamento).first()
            if item:
                if 'faltas_computadas' in item_dict:
                    item.faltas_computadas = int(item_dict['faltas_computadas'])
                if 'valor_falta_aplicado' in item_dict:
                    item.valor_falta_aplicado = Decimal(str(item_dict['valor_falta_aplicado']))
                if 'cargo' in item_dict:
                    item.cargo = item_dict['cargo']
                if 'status_data' in item_dict:
                    item.status_data = item_dict['status_data']
                if 'respondido_whatsapp' in item_dict:
                    item.respondido_whatsapp = bool(item_dict['respondido_whatsapp'])
                if 'observacao' in item_dict:
                    item.observacao = item_dict['observacao']
                item.save()
                atualizados += 1

        fechamento.recalcular_totais()
        return Response({
            "message": f"{atualizados} itens atualizados com sucesso.",
            "fechamento": FechamentoSerializer(fechamento).data
        })

    @action(detail=True, methods=['post'], url_path='parser-whatsapp')
    def parser_whatsapp(self, request, pk=None):
        fechamento = self.get_object()
        texto = request.data.get('texto', '')
        aplicar_automaticamente = request.data.get('aplicar', False)

        if not texto.strip():
            return Response({"error": "Texto do WhatsApp não fornecido."}, status=status.HTTP_400_BAD_REQUEST)

        linhas = texto.splitlines()
        itens = fechamento.itens.select_related('loja', 'loja__regiao').all()
        
        loja_map = {}
        for item in itens:
            norm_loja = normalizar_texto(item.loja.nome)
            loja_map[norm_loja] = item
            
            sem_protege = norm_loja.replace('protege', '').strip()
            if sem_protege and sem_protege not in loja_map:
                loja_map[sem_protege] = item
            sem_carrefour = norm_loja.replace('carrefour', '').strip()
            if sem_carrefour and sem_carrefour not in loja_map:
                loja_map[sem_carrefour] = item
            sem_df = norm_loja.replace('df', '').strip()
            if sem_df and sem_df not in loja_map:
                loja_map[sem_df] = item

            if 'baseoestedsc' in norm_loja:
                loja_map['dsc'] = item
                loja_map['oestedsc'] = item
            elif 'baseoeste' in norm_loja:
                loja_map['baseoeste'] = item
                loja_map['oeste'] = item
            if 'saojosedoscampos' in norm_loja or 'sjose' in norm_loja:
                loja_map['sjc'] = item
                loja_map['sjcampos'] = item
            if 'florianopolis' in norm_loja:
                loja_map['floripa'] = item
            if 'belohorizonte' in norm_loja:
                loja_map['bh'] = item
            if 'ribeirao' in norm_loja:
                loja_map['rp'] = item
                loja_map['ribeirao'] = item
            if 'santoandre' in norm_loja:
                loja_map['sa'] = item
                loja_map['santoandre'] = item
            if 'campinasi' in norm_loja:
                loja_map['campinas1'] = item
            if 'campinasii' in norm_loja:
                loja_map['campinas2'] = item

        matches = []
        nao_reconhecidos = []

        for linha in linhas:
            linha_limpa = linha.strip()
            if not linha_limpa:
                continue

            linha_lower = linha_limpa.lower()
            
            termos_sem_faltas = [
                'sem falta', 'sem faltas', 'zerado', 'zerada', 'zero faltas',
                'zero falta', 'nenhuma falta', 'nenhuma ausencia', 'sem alteracao',
                'sem alteracoes', 'sem apontamento', 'sem apontamentos', 'nada a apontar',
                'tudo ok sem falta', '0 faltas', '0 falta'
            ]
            eh_sem_faltas = any(t in linha_lower for t in termos_sem_faltas)

            soma_match = re.search(r'(\d+)\s*\+\s*(\d+)', linha_limpa)
            numeros = re.findall(r'\b\d+\b', linha_limpa)

            if eh_sem_faltas:
                faltas_detectadas = 0
            elif soma_match:
                faltas_detectadas = int(soma_match.group(1)) + int(soma_match.group(2))
            elif numeros:
                faltas_detectadas = int(numeros[-1])
            else:
                nao_reconhecidos.append({"linha": linha_limpa, "motivo": "Nenhum número ou indicação de falta encontrado"})
                continue

            cargo_detectado = None
            if 'aux' in linha_lower or 'limpeza' in linha_lower:
                cargo_detectado = 'AUX. DE LIMPEZA'
            elif faltas_detectadas == 0:
                cargo_detectado = 'SEM FALTAS'

            linha_sem_num = re.sub(r'\b\d+\b', '', linha_limpa)
            linha_sem_num = re.sub(r'(faltas?|ausencias?|ausncias?|loja|filial|fechamento|qtd|quantidade|ok|zerado|zerada)', '', linha_sem_num, flags=re.IGNORECASE)
            linha_norm = normalizar_texto(linha_sem_num)

            matched_item = None
            for key, item in loja_map.items():
                if key and (key in linha_norm or linha_norm in key):
                    matched_item = item
                    break

            if matched_item:
                matches.append({
                    "item_id": matched_item.id,
                    "loja_nome": matched_item.loja.nome,
                    "regiao_nome": matched_item.regiao_nome,
                    "faltas_detectadas": faltas_detectadas,
                    "cargo_detectado": cargo_detectado or matched_item.cargo,
                    "linha_original": linha_limpa,
                    "valor_unitario": float(matched_item.valor_falta_aplicado),
                    "desconto_calculado": float(faltas_detectadas * matched_item.valor_falta_aplicado)
                })
                if aplicar_automaticamente:
                    matched_item.faltas_computadas = faltas_detectadas
                    matched_item.respondido_whatsapp = True
                    matched_item.texto_original_whatsapp = linha_limpa
                    if cargo_detectado:
                        matched_item.cargo = cargo_detectado
                    matched_item.save()
            else:
                nao_reconhecidos.append({"linha": linha_limpa, "motivo": "Nome da loja não identificado"})

        if aplicar_automaticamente and matches:
            fechamento.recalcular_totais()

        return Response({
            "total_linhas": len(linhas),
            "total_reconhecidas": len(matches),
            "total_nao_reconhecidas": len(nao_reconhecidos),
            "reconhecidas": matches,
            "nao_reconhecidas": nao_reconhecidos,
            "aplicado": aplicar_automaticamente,
            "fechamento": FechamentoSerializer(fechamento).data if aplicar_automaticamente else None
        })

    @action(detail=True, methods=['get'], url_path='resumo-regionais')
    def resumo_regionais(self, request, pk=None):
        fechamento = self.get_object()
        itens = fechamento.itens.select_related('loja', 'loja__regiao').order_by('loja__regiao__ordem', 'ordem', 'loja__nome')

        regionais_dict = {}
        for item in itens:
            regiao = item.loja.regiao
            reg_nome = regiao.nome
            if reg_nome not in regionais_dict:
                regionais_dict[reg_nome] = {
                    "regiao_id": regiao.id,
                    "regiao_nome": reg_nome,
                    "emails": regiao.emails_padrao or "",
                    "total_lojas": 0,
                    "total_faltas": 0,
                    "total_desconto": Decimal('0.00'),
                    "lojas": [],
                }

            reg = regionais_dict[reg_nome]
            reg["total_lojas"] += 1
            reg["total_faltas"] += item.faltas_computadas
            reg["total_desconto"] += item.desconto_total
            reg["lojas"].append({
                "loja_id": item.loja.id,
                "loja_nome": item.loja.nome,
                "faltas": item.faltas_computadas,
                "valor_unitario": float(item.valor_falta_aplicado),
                "desconto_total": float(item.desconto_total),
                "respondido": item.respondido_whatsapp,
            })

        periodo_str = f"{fechamento.data_inicio.strftime('%d/%m')} até {fechamento.data_fim.strftime('%d/%m')}"
        periodo_corpo_str = f"{fechamento.data_inicio.strftime('%d/%m')} à {fechamento.data_fim.strftime('%d/%m')}"

        resultado = []
        for reg_nome, dados in regionais_dict.items():
            assunto = f"{fechamento.cliente.nome.upper()} {reg_nome} - Fechamento ({periodo_str})"
            if reg_nome in ['CAMPO GRANDE', 'JUIZ DE FORA']:
                assunto = f"{reg_nome} - Fechamento ({periodo_str})"

            linhas_tabela = []
            for lj in dados["lojas"]:
                faltas_txt = f"{lj['faltas']} faltas" if lj['faltas'] != 1 else "1 falta"
                val_txt = f"R$ {lj['desconto_total']:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
                linhas_tabela.append(f"• {lj['loja_nome']}: {faltas_txt} (Desconto: {val_txt})")

            tabela_str = "\n".join(linhas_tabela)
            total_desc_str = f"R$ {dados['total_desconto']:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')

            corpo = (
                f"Boa Tarde, tudo bem?\n\n"
                f"Segue fechamento {periodo_corpo_str} conforme resumo abaixo:\n\n"
                f"{tabela_str}\n\n"
                f"-----------------------------------------\n"
                f"Total de Faltas da Regional: {dados['total_faltas']}\n"
                f"Desconto Total: {total_desc_str}\n"
                f"-----------------------------------------\n\n"
                f"Ficamos no aguardo de sua confirmação.\n\n"
                f"Atenciosamente,\n"
                f"Gestão Operacional de Faltas"
            )

            resultado.append({
                "regiao_id": dados["regiao_id"],
                "regiao_nome": reg_nome,
                "emails": dados["emails"],
                "assunto": assunto,
                "corpo": corpo,
                "total_lojas": dados["total_lojas"],
                "total_faltas": dados["total_faltas"],
                "total_desconto": float(dados["total_desconto"]),
                "lojas": dados["lojas"]
            })

        todos_emails_set = set()
        linhas_consolidado = []
        for reg in resultado:
            if reg["emails"]:
                for e in reg["emails"].split(';'):
                    if e.strip():
                        todos_emails_set.add(e.strip())
            desc_fmt = f"R$ {reg['total_desconto']:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
            linhas_consolidado.append(f"• Regional {reg['regiao_nome']} ({reg['total_lojas']} filiais): {reg['total_faltas']} faltas | Desconto: {desc_fmt}")

        tabela_cons_str = "\n".join(linhas_consolidado)
        total_geral_desc_str = f"R$ {fechamento.total_desconto:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
        assunto_geral = f"CARREFOUR - Fechamento Consolidado Geral ({periodo_str})"
        corpo_geral = (
            f"Boa Tarde, tudo bem?\n\n"
            f"Segue o resumo geral consolidado das faltas apuradas no ciclo ({periodo_corpo_str}):\n\n"
            f"{tabela_cons_str}\n\n"
            f"-----------------------------------------\n"
            f"Total Geral de Faltas: {fechamento.total_faltas}\n"
            f"Total Geral de Desconto: {total_geral_desc_str}\n"
            f"-----------------------------------------\n\n"
            f"Ficamos no aguardo da validação de todas as regionais.\n\n"
            f"Atenciosamente,\n"
            f"Gestão Operacional de Faltas"
        )

        return Response({
            "fechamento_id": fechamento.id,
            "cliente": fechamento.cliente.nome,
            "periodo": periodo_str,
            "consolidado": {
                "destinatarios": "; ".join(sorted(list(todos_emails_set))),
                "assunto": assunto_geral,
                "corpo": corpo_geral,
            },
            "regionais": resultado
        })

    @action(detail=True, methods=['get'], url_path='detalhe-gerador')
    def detalhe_gerador(self, request, pk=None):
        fechamento = self.get_object()
        loja_id = request.query_params.get('loja_id')
        if loja_id:
            try:
                loja_id = int(loja_id)
            except ValueError:
                loja_id = None
        
        dados = gerar_matriz_detalhe(fechamento, loja_id=loja_id)
        return Response(dados)

    @action(detail=True, methods=['get'], url_path='exportar-detalhe-excel')
    def exportar_detalhe_excel(self, request, pk=None):
        fechamento = self.get_object()
        loja_id = request.query_params.get('loja_id')
        if loja_id:
            try:
                loja_id = int(loja_id)
            except ValueError:
                loja_id = None

        buffer = exportar_excel_detalhe(fechamento, loja_id=loja_id)
        nome_arquivo = f"Detalhe_{fechamento.cliente.nome}_{fechamento.ano_referencia}_{fechamento.mes_referencia:02d}.xlsx"
        
        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response['Content-Disposition'] = f'attachment; filename="{nome_arquivo}"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

    @action(detail=False, methods=['get'], url_path='detalhe-gerador-recente')
    def detalhe_gerador_recente(self, request):
        fechamento = Fechamento.objects.filter(cliente__codigo='carrefour').order_by('-ano_referencia', '-mes_referencia').first()
        if not fechamento:
            fechamento = Fechamento.objects.first()
        if not fechamento:
            return Response({"error": "Nenhum fechamento encontrado."}, status=status.HTTP_404_NOT_FOUND)

        loja_id = request.query_params.get('loja_id')
        if loja_id:
            try:
                loja_id = int(loja_id)
            except ValueError:
                loja_id = None

        dados = gerar_matriz_detalhe(fechamento, loja_id=loja_id)
        return Response(dados)

    @action(detail=True, methods=['get'], url_path='resumo-emails-protege')
    def resumo_emails_protege(self, request, pk=None):
        fechamento = self.get_object()
        itens = fechamento.itens.select_related('loja').order_by('ordem', 'loja__ordem', 'loja__nome')

        mes_num = fechamento.mes_referencia
        nome_mes = MESES_NOMES[mes_num] if 1 <= mes_num <= 12 else str(mes_num)
        ano = fechamento.ano_referencia

        lojas_emails = []
        todas_linhas_tabela = []
        todos_emails_set = set()

        for item in itens:
            loja = item.loja
            faltas = item.faltas_computadas
            cargo = item.cargo or ('SEM FALTAS' if faltas == 0 else 'AUX. DE LIMPEZA')
            contato = loja.supervisor or ''
            emails = loja.email_contatos or ''
            
            for e in emails.replace('/', ';').split(';'):
                if '@' in e:
                    todos_emails_set.add(e.strip())

            assunto_loja = f"Fechamento de faltas - Protege/{nome_mes} - {loja.nome}"
            
            if faltas == 0:
                faltas_txt = "0 faltas (SEM FALTAS)"
            elif faltas == 1:
                faltas_txt = f"1 falta ({cargo})"
            else:
                faltas_txt = f"{faltas} faltas ({cargo})"

            todas_linhas_tabela.append(f"• {loja.nome}: {faltas_txt}")

            corpo_loja = (
                f"Boa tarde{', ' + contato if contato else ''},\n\n"
                f"Segue o fechamento das faltas apuradas da filial {loja.nome} para validação:\n"
                f"• Quantidade de faltas e atestados: {faltas_txt}\n\n"
                f"Caso identifiquem alguma divergência, solicitamos a gentileza de nos informar "
                f"o mais breve possível, para que as devidas retificações possam ser realizadas antes do faturamento.\n\n"
                f"Não havendo manifestação, o processo será considerado validado e a nota fiscal será "
                f"encaminhada para faturamento em até 24 horas.\n\n"
                f"Atenciosamente,\n"
                f"Gestão Operacional de Faltas"
            )

            lojas_emails.append({
                "item_id": item.id,
                "loja_id": loja.id,
                "loja_nome": loja.nome,
                "contato": contato,
                "destinatarios": emails,
                "faltas": faltas,
                "cargo": cargo,
                "status_data": item.status_data,
                "respondido": item.respondido_whatsapp,
                "assunto": assunto_loja,
                "corpo": corpo_loja,
                "valor_unitario": float(item.valor_falta_aplicado),
                "desconto_total": float(item.desconto_total)
            })

        tabela_consolidada = "\n".join(todas_linhas_tabela)
        assunto_geral = f"Fechamento de faltas - Protege/{nome_mes}"
        corpo_geral = (
            f"Boa tarde,\n\n"
            f"Segue o fechamento das faltas apuradas ({nome_mes}/{ano}) para validação:\n\n"
            f"{tabela_consolidada}\n\n"
            f"-----------------------------------------\n"
            f"Total de Faltas Apuradas: {fechamento.total_faltas}\n"
            f"-----------------------------------------\n\n"
            f"Caso identifiquem alguma divergência, solicitamos a gentileza de nos informar "
            f"o mais breve possível, para que as devidas retificações possam ser realizadas antes do faturamento.\n\n"
            f"Não havendo manifestação, o processo será considerado validado e a nota fiscal será "
            f"encaminhada para faturamento em até 24 horas.\n\n"
            f"Atenciosamente,\n"
            f"Gestão Operacional de Faltas"
        )

        return Response({
            "fechamento_id": fechamento.id,
            "cliente": fechamento.cliente.nome,
            "mes": mes_num,
            "nome_mes": nome_mes,
            "ano": ano,
            "total_faltas": fechamento.total_faltas,
            "consolidado": {
                "destinatarios": "; ".join(sorted(list(todos_emails_set))),
                "assunto": assunto_geral,
                "corpo": corpo_geral,
            },
            "lojas": lojas_emails
        })

    @action(detail=True, methods=['get'], url_path='exportar-protege-excel')
    def exportar_protege_excel(self, request, pk=None):
        fechamento = self.get_object()
        buffer = exportar_excel_protege(fechamento)
        mes_num = fechamento.mes_referencia
        nome_mes = MESES_NOMES[mes_num] if 1 <= mes_num <= 12 else str(mes_num)
        nome_arquivo = f"Faltas_Protege_{nome_mes}_{fechamento.ano_referencia}.xlsx"

        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response['Content-Disposition'] = f'attachment; filename="{nome_arquivo}"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response


class ItemFechamentoViewSet(viewsets.ModelViewSet):
    queryset = ItemFechamento.objects.all()
    serializer_class = ItemFechamentoSerializer
    permission_classes = [AllowAny]

    def perform_update(self, serializer):
        item = serializer.save()
        item.fechamento.recalcular_totais()

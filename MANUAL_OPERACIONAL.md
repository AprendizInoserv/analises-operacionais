# 📘 Manual de Operação e Manutenção do Sistema
## Sistema de Análises Operacionais (Django + React)

Este manual destina-se aos novos responsáveis e mantenedores do sistema após a transição técnica.

---

## 🏗️ 1. Arquitetura do Sistema

* **Backend:** Django 5.2 com Django REST Framework, servido pelo servidor multi-thread **Waitress** (12 threads ativas) na porta `8000`.
* **Frontend:** React 19 desacoplado com Vite e Tailwind CSS. Pode ser servido via build estático compilado diretamente pelo Django (porta `8000`) ou via servidor de desenvolvimento Vite (porta `5173`).
* **Banco de Dados:** SQLite 3 em modo **WAL (Write-Ahead Logging)** com timeout de concorrência de 30 segundos, permitindo leituras simultâneas sem bloqueio durante importações pesadas.
* **Logs:** Gravados rotativamente em `logs/app.log` (rotinas e operações) e `logs/errors.log` (exceções e falhas).
* **Backups:** Gravados com carimbo de data/hora em `backups/db_backup_YYYY-MM-DD_HHMMSS.sqlite3` com validação de integridade física (`PRAGMA integrity_check`).

---

## 🛠️ 2. Scripts Operacionais (Como Gerenciar)

Todos os scripts estão disponíveis na raiz do projeto:

| Arquivo | Função |
| :--- | :--- |
| `iniciar_sistema.bat` | Faz backup preventivo automático, roda migrações e inicia o backend na porta 8000. |
| `menu_emergencia.bat` | Menu interativo no terminal com opções de 1 clique (Iniciar, Parar, Reiniciar, Backup, Restore, Diagnóstico). |
| `restaurar_backup.bat` | Restaura o backup válido mais recente caso ocorra corrupção de dados ou falha de disco. |
| `diagnostico.bat` | Verifica rede, portas, banco, VENV e gera o relatório `diagnostico.txt` pronto para envio. |
| `watchdog.py` | Supervisor de auto-recuperação que monitora a saúde da API (`/api/health/`) e reinicia processos travados. |

---

## 🛡️ 3. Política de Backup e Rotação Automática

O sistema possui uma política de auto-gestão de espaço em disco:
* **Frequência:** O backup é executado na inicialização e pode ser agendado no Windows Task Scheduler.
* **Validação:** Cada cópia é testada via `PRAGMA integrity_check`. Backups corrompidos são descartados imediatamente.
* **Rotação:** O sistema retém automaticamente as **14 cópias mais recentes** na pasta local `backups/`. Arquivos excedentes mais antigos são excluídos automaticamente para evitar que o disco fique cheio.
* **Espelho de Rede:** Se a variável `SQLITE_BACKUP_PATH` estiver configurada no `.env` e o servidor de rede estiver acessível, uma cópia adicional é enviada à rede. Se a rede cair, o backup local continua funcionando normalmente.

---

## 🔄 4. Monitoramento e Auto-Recuperação (Watchdog)

O script `watchdog.py` monitora o endpoint:
`http://127.0.0.1:8000/api/health/`

Se o backend não responder por **3 verificações consecutivas** (90 segundos):
1. O Watchdog localiza os PIDs presos na porta 8000 e força o encerramento.
2. Executa teste rápido de integridade no `db.sqlite3`. Se houver corrupção física, aciona a restauração automática do último backup válido.
3. Reinicia o servidor Waitress.
4. Registra todas as ações em `logs/watchdog.log`.

Para deixar o Watchdog ativo permanentemente, execute a **Opção [7]** do `menu_emergencia.bat` ou crie uma tarefa agendada no Windows.

---

## 🚀 5. Procedimento Seguro de Atualização de Código

Nunca execute `git pull` diretamente em produção sem seguir este roteiro:

1. **Faça um backup antes de atualizar:**
   ```cmd
   python manage.py backup_db
   ```
2. **Baixe as atualizações do Git:**
   ```cmd
   git pull origin main
   ```
3. **Instale dependências caso `requirements.txt` tenha mudado:**
   ```cmd
   pip install -r requirements.txt
   ```
4. **Aplique as migrações do banco de dados:**
   ```cmd
   python manage.py migrate
   ```
5. **Se houver alterações no frontend React:**
   ```cmd
   cd frontend
   yarn build
   cd ..
   ```
6. **Reinicie o sistema:**
   Utilize a opção `[3] Reiniciar Sistema` no `menu_emergencia.bat`.

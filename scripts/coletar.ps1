# Coleta do Radar da Black com o Claude Code.
# O Agendador de Tarefas do Windows roda este arquivo duas vezes por dia (8h e 20h).
# O relatório fica em logs\coleta-AAAA-MM-DD-manha.log ou logs\coleta-AAAA-MM-DD-noite.log.
# Para rodar na mão: powershell -ExecutionPolicy Bypass -File scripts\coletar.ps1
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$raiz = Split-Path $PSScriptRoot -Parent
Set-Location $raiz

$hoje = node -e "console.log(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Fortaleza'}).format(new Date()))"
$turno = if ((Get-Date).Hour -lt 14) { 'manha' } else { 'noite' }
$log = Join-Path $raiz "logs\coleta-$hoje-$turno.log"
function Anotar($texto) { $texto | Out-File $log -Append -Encoding utf8 }
"Início: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" | Out-File $log -Encoding utf8

# Impede o Windows de voltar a suspender enquanto a coleta roda
# (quando o Agendador acorda o PC, ele dormiria de novo em ~2 minutos).
# Vale até este script terminar.
try {
  Add-Type -Namespace Radar -Name Energia -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'
  [void][Radar.Energia]::SetThreadExecutionState([uint32]'0x80000001')  # ES_CONTINUOUS | ES_SYSTEM_REQUIRED
} catch { Anotar "Aviso: não consegui impedir a suspensão: $_" }

# Acha o Claude Code onde quer que esteja instalado (instalador nativo, npm ou PATH).
$claude = @(
  (Join-Path $env:USERPROFILE '.local\bin\claude.exe'),
  (Join-Path $env:APPDATA 'npm\claude.cmd')
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $claude) { $claude = (Get-Command claude -ErrorAction SilentlyContinue).Source }
if (-not $claude) {
  Anotar 'ERRO: Claude Code não encontrado. Instale ou ajuste o caminho em scripts\coletar.ps1.'
  Anotar "Fim: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
  exit 1
}

$pedido = 'Faça a coleta diária do Radar da Black seguindo a seção Rotina diária do CLAUDE.md, da etapa 1 à 5.'
$ferramentas = 'Read Edit Write Glob Grep WebFetch WebSearch Bash(node *) PowerShell(node *)'
$argumentos = "-p `"$pedido`" --permission-mode dontAsk --allowedTools `"$ferramentas`""

# O Claude roda num processo próprio, com a saída indo direto para arquivo.
# Assim, se o console do Agendador for fechado, a coleta não morre junto.
# Se a tentativa falhar, tenta de novo uma vez.
for ($tentativa = 1; $tentativa -le 2; $tentativa++) {
  $saida = Join-Path $env:TEMP "radar-coleta-saida.txt"
  $erros = Join-Path $env:TEMP "radar-coleta-erros.txt"
  Anotar "--- Tentativa $tentativa ($(Get-Date -Format 'HH:mm'))"
  try {
    $p = Start-Process -FilePath $claude -ArgumentList $argumentos -WorkingDirectory $raiz `
      -RedirectStandardOutput $saida -RedirectStandardError $erros -WindowStyle Hidden -PassThru -Wait
    $codigo = $p.ExitCode
  } catch {
    Anotar "ERRO ao iniciar o Claude: $_"
    $codigo = -1
  }
  if (Test-Path $saida) { Get-Content $saida -Encoding utf8 | Out-File $log -Append -Encoding utf8 }
  if ((Test-Path $erros) -and (Get-Item $erros).Length -gt 0) { Anotar '[erros]'; Get-Content $erros -Encoding utf8 | Out-File $log -Append -Encoding utf8 }
  Anotar "Código de saída: $codigo"
  if ($codigo -eq 0) { break }
  Start-Sleep -Seconds 60
}
Anotar "Fim: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"

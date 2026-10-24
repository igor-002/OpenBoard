# Sincroniza o 009.txt da pasta kali009 com a pagina publica /arquivo-txt do OpenBoard.
# Roda em loop no PC (tarefa agendada no logon): a cada 15s pergunta se ha versao
# nova; se houver, baixa, guarda backup do arquivo antigo e grava por cima.
# Depois confirma pro servidor, e a pagina mostra "Gravado na pasta".
#
# Instalar (uma vez, PowerShell normal, sem admin):
#   powershell -ExecutionPolicy Bypass -File scripts\arquivo-txt-sync.ps1 -Instalar `
#     -Url https://crm.opensuite.com.br -Chave <ARQUIVO_TXT_TOKEN>
# Desinstalar: ... -File scripts\arquivo-txt-sync.ps1 -Desinstalar
# Log, backups e config: %LOCALAPPDATA%\arquivo-txt-sync\
param(
  [switch]$Instalar,
  [switch]$Desinstalar,
  [switch]$UmaVez,
  [string]$Url,
  [string]$Chave,
  [string]$Destino = "$env:USERPROFILE\Documents\kali009\009.txt",
  [int]$IntervaloSeg = 15
)

$ErrorActionPreference = "Stop"
$NomeTarefa = "OpenBoard arquivo-txt sync"
$Dir = Join-Path $env:LOCALAPPDATA "arquivo-txt-sync"
$ConfigPath = Join-Path $Dir "config.json"
$VersaoPath = Join-Path $Dir "versao.txt"
$LogPath = Join-Path $Dir "sync.log"
$BackupDir = Join-Path $Dir "backup"
New-Item -ItemType Directory -Force $Dir, $BackupDir | Out-Null

function Log([string]$msg) {
  $linha = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
  Write-Host $linha
  Add-Content -Path $LogPath -Value $linha -Encoding UTF8
  # Log nao cresce sem limite: corta pras ultimas 2000 linhas quando passa de 1 MB.
  if ((Get-Item $LogPath).Length -gt 1MB) {
    $ultimas = Get-Content $LogPath -Tail 2000
    Set-Content -Path $LogPath -Value $ultimas -Encoding UTF8
  }
}

if ($Desinstalar) {
  Unregister-ScheduledTask -TaskName $NomeTarefa -Confirm:$false -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
    Where-Object { $_.CommandLine -like "*arquivo-txt-sync.ps1*" -and $_.ProcessId -ne $PID } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Write-Host "Tarefa removida. Config/backups ficam em $Dir"
  exit 0
}

if ($Instalar) {
  if (-not $Url -or -not $Chave) { throw "Informe -Url e -Chave." }
  @{ url = $Url.TrimEnd("/"); chave = $Chave; destino = $Destino } | ConvertTo-Json | Set-Content $ConfigPath -Encoding UTF8
  # Copia o script pra pasta local: a tarefa nao depende do repo continuar no lugar.
  $alvo = Join-Path $Dir "arquivo-txt-sync.ps1"
  if ($PSCommandPath -ne $alvo) { Copy-Item $PSCommandPath $alvo -Force }
  $acao = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$alvo`""
  $gatilho = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
  # Reinicia sozinho se cair; sem limite de duracao (roda o dia todo).
  $cfg = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $NomeTarefa -Action $acao -Trigger $gatilho -Settings $cfg -Force | Out-Null
  Start-ScheduledTask -TaskName $NomeTarefa
  Write-Host "Instalado. Tarefa '$NomeTarefa' rodando. Log: $LogPath"
  Write-Host "Link da pagina de upload: $($Url.TrimEnd('/'))/arquivo-txt?key=$Chave"
  exit 0
}

if (-not (Test-Path $ConfigPath)) { throw "Sem config. Rode com -Instalar -Url ... -Chave ... primeiro." }
$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$Base = $config.url
$Key = [uri]::EscapeDataString($config.chave)
$Destino = $config.destino

Add-Type -AssemblyName System.Net.Http
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$http = New-Object System.Net.Http.HttpClient
$http.Timeout = [TimeSpan]::FromSeconds(60)

function Sincroniza {
  $versaoLocal = if (Test-Path $VersaoPath) { (Get-Content $VersaoPath -Raw).Trim() } else { "" }
  $resp = $http.GetAsync("$Base/api/arquivo-txt/download?key=$Key&versao=$versaoLocal").Result
  $status = [int]$resp.StatusCode
  if ($status -eq 304 -or $status -eq 204) { return }
  if ($status -ne 200) { Log "Servidor respondeu $status"; return }

  $versao = ($resp.Headers.GetValues("X-Versao") | Select-Object -First 1)
  $bytes = $resp.Content.ReadAsByteArrayAsync().Result
  if ($bytes.Length -eq 0) { Log "Versao $versao veio vazia; ignorada"; return }

  $pasta = Split-Path $Destino -Parent
  if (-not (Test-Path $pasta)) { New-Item -ItemType Directory -Force $pasta | Out-Null }
  # Grava num temporario e troca de uma vez: o 009.txt nunca fica pela metade.
  $tmp = Join-Path $Dir "novo.tmp"
  [IO.File]::WriteAllBytes($tmp, $bytes)
  if (Test-Path $Destino) {
    $backup = Join-Path $BackupDir ("009_{0}.txt" -f (Get-Date -Format "yyyyMMdd_HHmmss"))
    Copy-Item $Destino $backup -Force
    Copy-Item $tmp $Destino -Force
    # Mantem os 30 backups mais novos.
    Get-ChildItem $BackupDir -Filter *.txt | Sort-Object LastWriteTime -Descending |
      Select-Object -Skip 30 | Remove-Item -Force
  } else {
    Copy-Item $tmp $Destino -Force
  }
  Remove-Item $tmp -Force
  Set-Content -Path $VersaoPath -Value $versao -NoNewline
  Log "Gravado $Destino ($($bytes.Length) bytes, versao $versao)"

  $json = @{ versao = $versao; host = $env:COMPUTERNAME } | ConvertTo-Json -Compress
  $body = New-Object System.Net.Http.StringContent($json, [Text.Encoding]::UTF8, "application/json")
  $conf = $http.PostAsync("$Base/api/arquivo-txt/aplicado?key=$Key", $body).Result
  if (-not $conf.IsSuccessStatusCode) { Log "Confirmacao falhou: $([int]$conf.StatusCode)" }
}

Log "Iniciado (destino $Destino, a cada ${IntervaloSeg}s)"
while ($true) {
  try { Sincroniza }
  catch {
    # Arquivo aberto por outro programa, sem internet etc.: tenta de novo no proximo ciclo.
    $m = $_.Exception
    while ($m.InnerException) { $m = $m.InnerException }
    Log "Erro: $($m.Message)"
  }
  if ($UmaVez) { break }
  Start-Sleep -Seconds $IntervaloSeg
}

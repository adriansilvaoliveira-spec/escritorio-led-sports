# Botão da área de trabalho: se o escritório estiver desligado, liga sem
# nenhuma janela de cmd e abre o navegador; se estiver ligado, desliga.
# Os sistemas dos agentes continuam de pé (o escritório reencontra cada um
# pelo pid quando volta).
$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = 'http://localhost:4321'
$porta = 4321
$wsh = New-Object -ComObject WScript.Shell

function NoAr {
  try { (Invoke-WebRequest "$url/" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch { $false }
}

$supervisor = Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" |
  Where-Object { $_.CommandLine -like '*INICIAR ESCRITORIO.cmd*' }
$servidor = Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique

if ($supervisor -or $servidor) {
  # primeiro o laço do cmd, senão ele sobe o node de novo
  foreach ($p in $supervisor) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
  foreach ($id in $servidor) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
  $wsh.Popup('Escritório desligado.', 3, 'LED SPORTS ATIBAIA', 64) | Out-Null
  exit
}

$si = ([wmiclass]'Win32_ProcessStartup').CreateInstance()
$si.ShowWindow = 0   # SW_HIDE: o cmd e o node rodam sem janela
$cmd = 'cmd /c "' + (Join-Path $pasta 'INICIAR ESCRITORIO.cmd') + '"'
([wmiclass]'Win32_Process').Create($cmd, $pasta, $si) | Out-Null
for ($i = 0; $i -lt 40 -and -not (NoAr); $i++) { Start-Sleep -Milliseconds 750 }

if (NoAr) { Start-Process $url }
else { $wsh.Popup('O escritório não respondeu em 30s.', 0, 'LED SPORTS ATIBAIA', 48) | Out-Null }

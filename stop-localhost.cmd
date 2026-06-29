@echo off
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if (-not $conn) { Write-Host 'ARI Finance server is not running on port 3000.'; exit 0 }; $targetPid = $conn.OwningProcess; $proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue; if (-not $proc) { Write-Host ('Port 3000 is owned by PID ' + $targetPid + ', but the process was not found.'); exit 1 }; if ($proc.ProcessName -ne 'node') { Write-Host ('Port 3000 is used by ' + $proc.ProcessName + ' PID ' + $targetPid + '. Not stopping it.'); exit 2 }; Stop-Process -Id $targetPid -Force; Write-Host ('Stopped ARI Finance server on port 3000, PID ' + $targetPid + '.')"

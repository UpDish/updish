param([switch]$StopDatabase)
$ErrorActionPreference='Stop';$project=Split-Path -Parent $PSScriptRoot
$file=Join-Path $project '.runtime/processes.json'
if(Test-Path -LiteralPath $file) {
    foreach($saved in @(Get-Content -Raw -LiteralPath $file|ConvertFrom-Json)) {
        $p=Get-Process -Id $saved.pid -ErrorAction SilentlyContinue
        if($p -and $p.StartTime.ToUniversalTime() -eq ([DateTimeOffset]$saved.startedAt).UtcDateTime) {
            $info=Get-CimInstance Win32_Process -Filter "ProcessId = $($p.Id)"
            if($info.CommandLine.Contains($project)) {Stop-Process -Id $p.Id}
        }
    }
}
if($StopDatabase) {docker compose --env-file "$project/.env" -f "$project/infra/compose.yaml" stop}
Write-Output '이 스크립트가 시작한 앱만 종료했습니다. DB 데이터는 삭제하지 않았습니다.'

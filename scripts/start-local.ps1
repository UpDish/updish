param([switch]$SkipBuild,[ValidateSet('dev','production')][string]$WebMode='dev')
$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $project
foreach($path in @('.env','.env.local','services/agent-api/.env.local')) {
    if(Test-Path -LiteralPath $path) {
        foreach($line in [IO.File]::ReadAllLines((Join-Path $project $path))) {
            if($line -match '^([A-Z][A-Z0-9_]*)=(.*)$') {[Environment]::SetEnvironmentVariable($Matches[1],$Matches[2].Trim().Trim('"').Trim("'"),'Process')}
        }
    }
}
if(-not $env:AGENT_SHARED_TOKEN) {
    $secretBytes=[byte[]]::new(32);[Security.Cryptography.RandomNumberGenerator]::Fill($secretBytes)
    $env:AGENT_SHARED_TOKEN=[Convert]::ToHexString($secretBytes).ToLowerInvariant()
    Add-Content -LiteralPath (Join-Path $project '.env.local') -Value ("AGENT_SHARED_TOKEN="+$env:AGENT_SHARED_TOKEN)
}
docker info --format '{{.ServerVersion}}' *> $null
if($LASTEXITCODE -ne 0) {throw 'Docker Desktop을 먼저 실행해 주세요.'}
docker compose --env-file .env -f infra/compose.yaml up -d --wait
if($LASTEXITCODE -ne 0) {throw 'PostgreSQL 시작 실패'}
if(-not $SkipBuild) {
    pnpm.cmd install --frozen-lockfile
    if($LASTEXITCODE -ne 0) {throw 'Node 의존성 설치 실패'}
    uv sync --directory services/agent-api --frozen
    if($LASTEXITCODE -ne 0) {throw 'Python 의존성 설치 실패'}
    & "$project/services/core-api/gradlew.bat" -p "$project/services/core-api" bootJar
    if($LASTEXITCODE -ne 0) {throw 'Core 빌드 실패'}
    if($WebMode -eq 'production') {pnpm.cmd build:web;if($LASTEXITCODE -ne 0){throw 'Web 빌드 실패'}}
}
$runtime=Join-Path $project '.runtime';New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$started=@()
if(Test-Path -LiteralPath "$runtime/processes.json") {
    foreach($saved in @(Get-Content -Raw -LiteralPath "$runtime/processes.json"|ConvertFrom-Json)) {
        $existing=Get-Process -Id $saved.pid -ErrorAction SilentlyContinue
        if($existing -and $existing.StartTime.ToUniversalTime().ToString('o') -eq $saved.startedAt) {$started+=$saved}
    }
}
function Launch([int]$Port,[string]$Name,[string]$File,[string[]]$Arguments,[string]$Directory) {
    if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {Write-Output "$Name 포트 $Port 사용 중: 기존 프로세스를 유지합니다.";return}
    $p=Start-Process -FilePath $File -ArgumentList $Arguments -WorkingDirectory $Directory -WindowStyle Hidden -PassThru -RedirectStandardOutput "$runtime/$Name.stdout.log" -RedirectStandardError "$runtime/$Name.stderr.log"
    $script:started += @{name=$Name;pid=$p.Id;startedAt=$p.StartTime.ToUniversalTime().ToString('o')}
}
Launch 8080 'core' (Get-Command java.exe).Source @('-jar',('"'+$project+'/services/core-api/build/libs/core-api-0.0.1-SNAPSHOT.jar"')) "$project/services/core-api"
Launch 8000 'agent' "$project/services/agent-api/.venv/Scripts/python.exe" @('-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000') "$project/services/agent-api"
$next=(Resolve-Path -LiteralPath "$project/apps/web/node_modules/next/dist/bin/next").Path
$mode=if($WebMode -eq 'production') {'start'} else {'dev'}
Launch 3000 'web' (Get-Command node.exe).Source @(('"'+$next+'"'),$mode,'--hostname','127.0.0.1') "$project/apps/web"
$started|ConvertTo-Json|Set-Content -LiteralPath "$runtime/processes.json"
Write-Output '로컬 앱: http://127.0.0.1:3000 / 로그: .runtime/'

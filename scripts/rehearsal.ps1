param([ValidateSet('Start','Stop','RestartWeb','RestartCore')][string]$Action='Start')
$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $project
$stateFile=Join-Path $project '.runtime/rehearsal.json'
if($Action -eq 'Stop') {
    if(Test-Path -LiteralPath $stateFile) {
        $state=Get-Content -Raw -LiteralPath $stateFile|ConvertFrom-Json
        foreach($saved in $state.processes) {
            $process=Get-Process -Id $saved.pid -ErrorAction SilentlyContinue
            if($process -and $process.StartTime.ToUniversalTime() -eq ([DateTimeOffset]$saved.startedAt).UtcDateTime) {
                $info=Get-CimInstance Win32_Process -Filter "ProcessId=$($saved.pid)"
                if($info.CommandLine.Contains($project) -or ($saved.name -eq 'anvil' -and $info.CommandLine.Contains('--port 8545'))) {Stop-Process -Id $saved.pid}
            }
        }
        Write-Output "리허설 프로세스만 중지했습니다. 별도 DB $($state.database)는 보존했습니다."
    }
    exit
}
if($Action -eq 'RestartCore') {
    $state=Get-Content -Raw -LiteralPath $stateFile|ConvertFrom-Json
    if(Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue){throw '리허설 Core가 실행 중입니다.'}
    foreach($path in '.env','.env.local'){if(Test-Path -LiteralPath $path){foreach($line in [IO.File]::ReadAllLines((Join-Path $project $path))){if($line -match '^(POSTGRES_USER|POSTGRES_PASSWORD|AGENT_SHARED_TOKEN)=(.*)$'){[Environment]::SetEnvironmentVariable($Matches[1],$Matches[2].Trim(),'Process')}}}}
    $env:DATABASE_URL="jdbc:postgresql://127.0.0.1:55432/$($state.database)";$env:GIWA_RPC_URL='http://127.0.0.1:8545';$env:UPDISH_ALLOWED_ORIGINS='http://127.0.0.1:3001';$env:SESSION_COOKIE_SECURE='false'
    $env:DEMO_OPERATOR_WALLET=(Invoke-RestMethod -Uri 'http://127.0.0.1:8545' -Method Post -ContentType 'application/json' -Body '{"jsonrpc":"2.0","id":1,"method":"eth_accounts","params":[]}').result[0]
    $p=Start-Process -FilePath (Get-Command java.exe).Source -ArgumentList @('-Xmx384m','-jar',('"'+$project+'/services/core-api/build/libs/core-api-0.0.1-SNAPSHOT.jar"'),'--server.port=8081') -WorkingDirectory "$project/services/core-api" -WindowStyle Hidden -PassThru -RedirectStandardOutput "$project/.runtime/rehearsal-core.stdout.log" -RedirectStandardError "$project/.runtime/rehearsal-core.stderr.log"
    $state.processes=@($state.processes|Where-Object name -ne core)+@(@{name='core';pid=$p.Id;startedAt=$p.StartTime.ToUniversalTime().ToString('o')})
    $state|ConvertTo-Json -Depth 4|Set-Content -LiteralPath $stateFile
    Write-Output '별도 리허설 Core만 다시 시작했습니다.';exit
}
if($Action -eq 'RestartWeb') {
    $state=Get-Content -Raw -LiteralPath $stateFile|ConvertFrom-Json
    if(Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue){throw '리허설 Web이 실행 중입니다. 기존 프로세스를 덮어쓰지 않습니다.'}
    $env:CORE_API_URL='http://127.0.0.1:8081';$env:UPDISH_ALLOWED_ORIGINS='http://127.0.0.1:3001'
    $next=(Resolve-Path -LiteralPath 'apps/web/node_modules/next/dist/bin/next').Path
    $p=Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @(('"'+$next+'"'),'start','--hostname','127.0.0.1','--port','3001') -WorkingDirectory "$project/apps/web" -WindowStyle Hidden -PassThru -RedirectStandardOutput "$project/.runtime/rehearsal-web.stdout.log" -RedirectStandardError "$project/.runtime/rehearsal-web.stderr.log"
    $state.processes=@($state.processes|Where-Object name -ne web)+@(@{name='web';pid=$p.Id;startedAt=$p.StartTime.ToUniversalTime().ToString('o')})
    $state|ConvertTo-Json -Depth 4|Set-Content -LiteralPath $stateFile
    Write-Output '별도 리허설 Web만 다시 시작했습니다.';exit
}
foreach($port in 8545,8081,3001) {if(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue){throw "리허설 포트 $port 사용 중입니다. 기존 프로세스를 덮어쓰지 않습니다."}}
if(Test-Path -LiteralPath '.env') {foreach($line in [IO.File]::ReadAllLines((Join-Path $project '.env'))){if($line -match '^(POSTGRES_USER|POSTGRES_PASSWORD)=(.*)$'){[Environment]::SetEnvironmentVariable($Matches[1],$Matches[2].Trim(),'Process')}}}
$dbName='updish_rehearsal_'+[DateTime]::UtcNow.ToString('yyyyMMddHHmmss')
docker exec updish-postgres-1 psql -U updish -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $dbName"
if($LASTEXITCODE -ne 0){throw '별도 리허설 DB 생성 실패'}
$processes=@()
function Launch([string]$Name,[string]$File,[string[]]$Arguments,[string]$Directory,[int]$Port) {
    $p=Start-Process -FilePath $File -ArgumentList $Arguments -WorkingDirectory $Directory -WindowStyle Hidden -PassThru -RedirectStandardOutput "$project/.runtime/rehearsal-$Name.stdout.log" -RedirectStandardError "$project/.runtime/rehearsal-$Name.stderr.log"
    $saved=@{name=$Name;pid=$p.Id;startedAt=$p.StartTime.ToUniversalTime().ToString('o')}
    $script:processes+=$saved
    @{database=$dbName;processes=$script:processes}|ConvertTo-Json -Depth 4|Set-Content -LiteralPath $stateFile
    for($i=0;$i -lt 120;$i++) {if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){return};if($p.HasExited){throw "$Name 시작 실패. .runtime/rehearsal-$Name.stderr.log 확인"};Start-Sleep -Milliseconds 500}
    throw "$Name 포트가 준비되지 않았습니다."
}
try {
    Launch 'anvil' "$env:USERPROFILE/.foundry/bin/anvil.exe" @('--host','127.0.0.1','--port','8545','--chain-id','91342','--silent') $project 8545
    $accounts=(Invoke-RestMethod -Uri 'http://127.0.0.1:8545' -Method Post -ContentType 'application/json' -Body '{"jsonrpc":"2.0","id":1,"method":"eth_accounts","params":[]}').result
    $env:DATABASE_URL="jdbc:postgresql://127.0.0.1:55432/$dbName"
    $env:GIWA_RPC_URL='http://127.0.0.1:8545'
    $env:DEMO_OPERATOR_WALLET=$accounts[0]
    $env:UPDISH_ALLOWED_ORIGINS='http://127.0.0.1:3001'
    $env:SESSION_COOKIE_SECURE='false'
    if(Test-Path -LiteralPath '.env.local') {foreach($line in [IO.File]::ReadAllLines((Join-Path $project '.env.local'))){if($line -match '^AGENT_SHARED_TOKEN=(.*)$'){$env:AGENT_SHARED_TOKEN=$Matches[1].Trim()}}}
    Launch 'core' (Get-Command java.exe).Source @('-Xmx384m','-jar',('"'+$project+'/services/core-api/build/libs/core-api-0.0.1-SNAPSHOT.jar"'),'--server.port=8081') "$project/services/core-api" 8081
    $env:CORE_API_URL='http://127.0.0.1:8081'
    $next=(Resolve-Path -LiteralPath 'apps/web/node_modules/next/dist/bin/next').Path
    Launch 'web' (Get-Command node.exe).Source @(('"'+$next+'"'),'start','--hostname','127.0.0.1','--port','3001') "$project/apps/web" 3001
    Write-Output "LOCAL ANVIL ONLY · 별도 DB $dbName · Web 3001 / Core 8081 / RPC 8545. GIWA 거래가 아닙니다."
} catch {
    Write-Output '부분 기동 상태는 .runtime/rehearsal.json에 보관했습니다. -Action Stop으로 이 리허설만 중지할 수 있습니다.'
    throw
}

param(
    [ValidateSet('Status','Stop','Start','Reboot','Backup','RestoreCheck')][string]$Action='Status'
)
$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
$instance='i-09bd2c718ace1bedc'
$region='ap-northeast-2'
function AwsJson([string[]]$Arguments) {
    $result=& aws @Arguments --region $region --output json
    if($LASTEXITCODE -ne 0) {throw 'AWS 작업에 실패했습니다.'}
    return ($result | ConvertFrom-Json)
}
function Remote([string]$Operation) {
    # This checked-in maintenance script contains no credentials. Never print server .env files.
    $script=[IO.File]::ReadAllText((Join-Path $project 'infra/maintenance-ec2.sh')).Replace("`r`n","`n")
    $encoded=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($script))
    $commands=@("printf '%s' '$encoded' | base64 -d > /tmp/updish-maintenance.sh","bash /tmp/updish-maintenance.sh $Operation")
    $runtime=Join-Path $project '.runtime';New-Item -ItemType Directory -Force -Path $runtime | Out-Null
    $parameters=Join-Path $runtime 'aws-maintenance.json'
    @{commands=$commands}|ConvertTo-Json -Depth 5|Set-Content -LiteralPath $parameters -Encoding utf8NoBOM
    $command=AwsJson @('ssm','send-command','--instance-ids',$instance,'--document-name','AWS-RunShellScript','--parameters',("file://"+$parameters))
    Write-Output ("SSM command: "+$command.Command.CommandId)
    Write-Output ('결과 확인: aws ssm get-command-invocation --region '+$region+' --instance-id '+$instance+' --command-id '+$command.Command.CommandId+' --query ''{Status:Status,Output:StandardOutputContent,Error:StandardErrorContent}''')
}
$details=AwsJson @('ec2','describe-instances','--instance-ids',$instance,'--query','Reservations[0].Instances[0].{State:State.Name,Ip:PublicIpAddress,Type:InstanceType}')
switch($Action) {
    'Status' {$details|ConvertTo-Json;if($details.State -eq 'running'){Remote 'status'}}
    'Stop' {AwsJson @('ec2','stop-instances','--instance-ids',$instance)|Out-Null;Write-Output '중지를 요청했습니다. EBS·S3 보관 비용은 남습니다.'}
    'Start' {
        if($details.State -ne 'running') {
            AwsJson @('ec2','start-instances','--instance-ids',$instance)|Out-Null
            Write-Output '기동을 요청했습니다. 실행 상태와 SSM 연결을 확인한 뒤 Start를 다시 실행해 주소를 갱신하세요.'
        } else {
            Remote 'domain'
            Write-Output ('Vercel CORE_API_URL을 https://'+$details.Ip+'.sslip.io 로 갱신하고 재배포하세요. 웹 Origin은 기존 주소를 유지합니다.')
        }
    }
    'Reboot' {AwsJson @('ec2','reboot-instances','--instance-ids',$instance)|Out-Null;Write-Output '재부팅을 요청했습니다. 자동 공인 IP는 재부팅 동안 유지됩니다.'}
    'Backup' {Remote 'backup'}
    'RestoreCheck' {Remote 'restore-check'}
}

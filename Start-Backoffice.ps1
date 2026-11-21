$ErrorActionPreference = 'Stop'
$exitCode = 1
try {
    Set-Location -LiteralPath $PSScriptRoot
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $nodeCommand) { throw 'Zainstaluj Node.js 22 lub nowszy z https://nodejs.org.' }
    $env:POLKURIER_LOGIN = (Read-Host 'ID konta Polkurier').Trim()
    $tokenSecret = Read-Host 'Token API Polkurier' -AsSecureString
    $env:POLKURIER_TOKEN = ([System.Net.NetworkCredential]::new('', $tokenSecret).Password).Trim()
    $env:POLKURIER_SANDBOX = '0'
    & $nodeCommand.Source (Join-Path $PSScriptRoot 'polkurier-server.cjs')
    $exitCode = $LASTEXITCODE
}
catch { Write-Host $_.Exception.Message -ForegroundColor Red }
finally {
    Remove-Item Env:POLKURIER_TOKEN -ErrorAction SilentlyContinue
    Remove-Item Env:POLKURIER_LOGIN -ErrorAction SilentlyContinue
}
exit $exitCode


param(
  [Parameter(Mandatory = $true, Position = 0)][string]$PreviousBill,
  [Parameter(Mandatory = $true, Position = 1)][string]$CurrentBill
)

$ErrorActionPreference = 'Stop'
$keyFile = Join-Path $PSScriptRoot '.openrouter-key.dpapi'

if (-not (Test-Path -LiteralPath $keyFile)) {
  $secureKey = Read-Host 'OpenRouter API key' -AsSecureString
  $encryptedKey = ConvertFrom-SecureString -SecureString $secureKey
  [System.IO.File]::WriteAllText($keyFile, $encryptedKey)
}

$encryptedKey = [System.IO.File]::ReadAllText($keyFile)
$secureKey = ConvertTo-SecureString -String $encryptedKey
$key = [System.Net.NetworkCredential]::new('', $secureKey).Password
if ([string]::IsNullOrWhiteSpace($key)) {
  throw 'The stored OpenRouter key is empty. Delete .openrouter-key.dpapi and run again.'
}

$previousKey = $env:OPENROUTER_API_KEY
try {
  $env:OPENROUTER_API_KEY = $key
  Push-Location -LiteralPath $PSScriptRoot
  try {
    & node compare.js $PreviousBill $CurrentBill
    $resultCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }
} finally {
  $env:OPENROUTER_API_KEY = $previousKey
  $key = $null
}

exit $resultCode

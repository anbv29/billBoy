param(
  [Parameter(Mandatory = $true, Position = 0)][string]$PreviousBill,
  [Parameter(Mandatory = $true, Position = 1)][string]$CurrentBill
)

$ErrorActionPreference = 'Stop'
$secureKey = Read-Host 'Gemini API key' -AsSecureString
$key = [System.Net.NetworkCredential]::new('', $secureKey).Password
if ([string]::IsNullOrWhiteSpace($key)) {
  throw 'A Gemini API key is required.'
}

$previousKey = $env:GEMINI_API_KEY
try {
  $env:GEMINI_API_KEY = $key
  Push-Location -LiteralPath $PSScriptRoot
  try {
    & node compare.js $PreviousBill $CurrentBill
    $resultCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }
} finally {
  $env:GEMINI_API_KEY = $previousKey
  $key = $null
}

exit $resultCode

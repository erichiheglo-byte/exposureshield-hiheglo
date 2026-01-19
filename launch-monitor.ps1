param(
  [Parameter(Mandatory=$false)]
  [string]$Secret
)

$baseUrl = "https://www.exposureshield.com"
$price = 19.99

if (-not $Secret -or $Secret.Trim().Length -eq 0) {
  $Secret = Read-Host "Enter CRON_SECRET (admin bearer token)"
}

function Get-EssentialStatus {
  try {
    return Invoke-RestMethod -Method GET `
      -Uri "$baseUrl/api/monitoring/status" `
      -Headers @{ Authorization = "Bearer $Secret" } `
      -TimeoutSec 20
  } catch {
    return $null
  }
}

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "   ESSENTIAL LAUNCH MONITOR ($19.99/month)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Time: $(Get-Date)" -ForegroundColor White
Write-Host "URL:  $baseUrl" -ForegroundColor White

$status = Get-EssentialStatus

if ($status) {
  $subscribers = 0
  if ($status.stats -and $status.stats.activeSubscribers -ne $null) {
    $subscribers = [int]$status.stats.activeSubscribers
  }

  $monthlyRevenue = $subscribers * $price
  $yearlyRevenue  = $monthlyRevenue * 12

  Write-Host "`nCURRENT METRICS:" -ForegroundColor Green
  Write-Host "• Active subscribers: $subscribers" -ForegroundColor White
  Write-Host ("• Monthly revenue: {0:C2}" -f $monthlyRevenue) -ForegroundColor White
  Write-Host ("• Yearly revenue:  {0:C2}" -f $yearlyRevenue) -ForegroundColor White

  if ($status.stats) {
    if ($status.stats.plan) { Write-Host "• Plan: $($status.stats.plan)" -ForegroundColor White }
    if ($status.stats.cronSchedule) { Write-Host "• Cron schedule: $($status.stats.cronSchedule)" -ForegroundColor White }
  }

  Write-Host "`nGOALS:" -ForegroundColor Yellow
  Write-Host "• Week 1: 5–10 subscribers (`$99.95 – `$199.90/month)" -ForegroundColor White
  Write-Host "• Month 1: 10–25 subscribers (`$199.90 – `$499.75/month)" -ForegroundColor White

} else {
  Write-Host "`n❌ Could not fetch status." -ForegroundColor Red
  Write-Host "Check one of these:" -ForegroundColor Red
  Write-Host "1) CRON_SECRET is correct" -ForegroundColor Red
  Write-Host "2) Endpoint exists: $baseUrl/api/monitoring/status" -ForegroundColor Red
  Write-Host "3) Your handler expects Authorization: Bearer <secret>" -ForegroundColor Red
}

Write-Host "`n==============================================" -ForegroundColor Green
Write-Host "   ✅ SYSTEM CHECK COMPLETE" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host "Pricing page: https://www.exposureshield.com/essential-pricing" -ForegroundColor Cyan


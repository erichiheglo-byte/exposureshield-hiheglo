# ExposureShield API Monitor
# Run this periodically to ensure API is healthy

$baseUrl = "https://www.exposureshield.com"
$endpoints = @(
    "/api/health",
    "/api/stats",
    "/api/check-email?email=test@example.com"
)

$results = @()

foreach ($endpoint in $endpoints) {
    $url = "$baseUrl$endpoint"
    $startTime = Get-Date
    
    try {
        $response = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 10
        $duration = (Get-Date) - $startTime
        
        $results += [PSCustomObject]@{
            Endpoint = $endpoint
            Status = "✅ OK"
            ResponseTime = "$([math]::Round($duration.TotalMilliseconds))ms"
            OK = $response.ok
            Timestamp = $response.timestamp
        }
    }
    catch {
        $results += [PSCustomObject]@{
            Endpoint = $endpoint
            Status = "❌ ERROR"
            ResponseTime = "N/A"
            OK = $false
            Error = $_.Exception.Message
            Timestamp = (Get-Date).ToString("o")
        }
    }
}

# Display results
Write-Host "`nExposureShield API Health Check" -ForegroundColor Cyan
Write-Host "=====================================`n" -ForegroundColor Cyan

$results | Format-Table -AutoSize

# Check if all endpoints are OK
$allOk = ($results | Where-Object { $_.OK -ne $true }).Count -eq 0

if ($allOk) {
    Write-Host "`n✅ All endpoints are healthy!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Some endpoints are failing:" -ForegroundColor Red
    $results | Where-Object { $_.OK -ne $true } | ForEach-Object {
        Write-Host "  - $($_.Endpoint): $($_.Error)" -ForegroundColor Red
    }
}

Write-Host "🔍 LegacyShield Deployment Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if all files exist
$files = @(
    "api/_lib/auth.js",
    "api/legacy/get.js",
    "api/legacy/save.js",
    "legacy/index.html",
    "legacy/legacy.js",
    "legacy/legacy.css"
)

$allGood = $true
foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "✓ $file exists" -ForegroundColor Green
    } else {
        Write-Host "✗ $file MISSING" -ForegroundColor Red
        $allGood = $false
    }
}

# Test API endpoints
Write-Host "`n🌐 Testing API endpoints..." -ForegroundColor Cyan
try {
    # Test if get.js exports correctly
    $getContent = Get-Content "api/legacy/get.js" -Raw
    if ($getContent -match "verifySession") {
        Write-Host "✓ get.js uses cookie auth" -ForegroundColor Green
    } else {
        Write-Host "✗ get.js doesn't use cookie auth" -ForegroundColor Red
        $allGood = $false
    }
    
    # Test if save.js exports correctly
    $saveContent = Get-Content "api/legacy/save.js" -Raw
    if ($saveContent -match "verifySession") {
        Write-Host "✓ save.js uses cookie auth" -ForegroundColor Green
    } else {
        Write-Host "✗ save.js doesn't use cookie auth" -ForegroundColor Red
        $allGood = $false
    }
} catch {
    Write-Host "✗ Error testing files: $_" -ForegroundColor Red
}

# Check legacy frontend
Write-Host "`n🎨 Checking frontend files..." -ForegroundColor Cyan
if (Test-Path "legacy/index.html") {
    $legacyHtml = Get-Content "legacy/index.html" -Raw
    if ($legacyHtml -match "legacy.js") {
        Write-Host "✓ index.html loads legacy.js" -ForegroundColor Green
    }
    if ($legacyHtml -match "legacy.css") {
        Write-Host "✓ index.html loads legacy.css" -ForegroundColor Green
    }
}

# Summary
Write-Host "`n📊 DEPLOYMENT SUMMARY" -ForegroundColor Cyan
Write-Host "====================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "✅ Deployment looks good!" -ForegroundColor Green
    Write-Host "`n🚀 Next steps:" -ForegroundColor Yellow
    Write-Host "1. Update your login.js to set session cookies" -ForegroundColor White
    Write-Host "2. Deploy to your server/hosting" -ForegroundColor White
    Write-Host "3. Test the flow:" -ForegroundColor White
    Write-Host "   - Homepage → LegacyShield → Login → Legacy Dashboard" -ForegroundColor White
    Write-Host "   - Dashboard → Open LegacyShield" -ForegroundColor White
} else {
    Write-Host "❌ Some files are missing or incorrect" -ForegroundColor Red
    Write-Host "Please check the missing files above and run the deployment script again." -ForegroundColor Yellow
}

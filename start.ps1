Write-Host "🚀 Starting LegacyShield Enterprise Platform..." -ForegroundColor Green

# Check if Node.js is installed
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "❌ Node.js is not installed!" -ForegroundColor Red
    Write-Host "Download from https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Node.js $nodeVersion detected" -ForegroundColor Green

# Check if dependencies are installed
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Start the server
Write-Host "🚀 Launching LegacyShield..." -ForegroundColor Cyan
Write-Host "🌐 Dashboard: http://localhost:3000" -ForegroundColor Cyan
Write-Host "🔧 API Base: http://localhost:3000/api" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray

node api/index.js

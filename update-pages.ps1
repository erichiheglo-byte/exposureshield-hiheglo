# update-pages.ps1 - Update all HTML pages with shared.js reference
# Run this in PowerShell from your project folder

Write-Host "Updating all HTML pages with shared.js reference..." -ForegroundColor Yellow
Write-Host "Working directory: $(Get-Location)" -ForegroundColor Gray

# List of all HTML files to update
$htmlFiles = Get-ChildItem *.html | Where-Object { 
    $_.Name -notin @('login.html', 'register.html', 'dashboard.html', 'vault.html') 
}

$updatedCount = 0
$alreadyUpdated = 0
$failedCount = 0

foreach ($file in $htmlFiles) {
    Write-Host "Processing: $($file.Name)" -ForegroundColor White
    
    $content = Get-Content $file.FullName -Raw
    
    # Check if already has shared.js reference
    if ($content -match 'shared\.js') {
        Write-Host "  Already has shared.js" -ForegroundColor Gray
        $alreadyUpdated++
        continue
    }
    
    # Check if has closing body tag
    if ($content -match '</body>') {
        # Add shared.js before closing </body> tag
        $newContent = $content -replace '</body>', '<script src="/shared.js" defer></script></body>'
        
        # Save the file
        try {
            Set-Content -Path $file.FullName -Value $newContent -Encoding UTF8 -Force
            Write-Host "  Added shared.js reference" -ForegroundColor Green
            $updatedCount++
        } catch {
            Write-Host "  Failed to update: $_" -ForegroundColor Red
            $failedCount++
        }
    } else {
        Write-Host "  No closing body tag found" -ForegroundColor Yellow
        $failedCount++
    }
}

# Summary report
Write-Host ""
Write-Host "=================================================="
Write-Host "UPDATE COMPLETE - Summary Report" -ForegroundColor Cyan
Write-Host "=================================================="
Write-Host "Total files processed: $($htmlFiles.Count)" -ForegroundColor White
Write-Host "Already had shared.js: $alreadyUpdated" -ForegroundColor Gray
Write-Host "Successfully updated: $updatedCount" -ForegroundColor Green
Write-Host "Failed to update: $failedCount" -ForegroundColor Red

if ($failedCount -gt 0) {
    Write-Host "Some files need manual updating:" -ForegroundColor Yellow
    Write-Host "Add this line before closing body tag:" -ForegroundColor White
    Write-Host '<script src="/shared.js" defer></script>' -ForegroundColor Cyan
}

Write-Host "Update complete!" -ForegroundColor Green
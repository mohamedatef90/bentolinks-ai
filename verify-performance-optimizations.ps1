# Performance Optimization Verification Script
# Run this to verify all optimizations are in place

Write-Host "Verifying Performance Optimizations..." -ForegroundColor Cyan
Write-Host ""

$errors = 0

# 1. Check useDebounce hook exists
Write-Host "1. Checking useDebounce hook..." -NoNewline
if (Test-Path "hooks\useDebounce.ts") {
    $content = Get-Content "hooks\useDebounce.ts" -Raw
    if ($content -match "useDebounce" -and $content -match "setTimeout") {
        Write-Host " PASS" -ForegroundColor Green
    } else {
        Write-Host " FAIL - Hook exists but missing debounce logic" -ForegroundColor Red
        $errors++
    }
} else {
    Write-Host " FAIL - File not found" -ForegroundColor Red
    $errors++
}

# 2. Check VirtualLinkList component exists
Write-Host "2. Checking VirtualLinkList component..." -NoNewline
if (Test-Path "components\VirtualLinkList.tsx") {
    $content = Get-Content "components\VirtualLinkList.tsx" -Raw
    if ($content -match "VirtualLinkList" -and $content -match "visibleRange") {
        Write-Host " PASS" -ForegroundColor Green
    } else {
        Write-Host " FAIL - Component exists but missing virtual scroll logic" -ForegroundColor Red
        $errors++
    }
} else {
    Write-Host " FAIL - File not found" -ForegroundColor Red
    $errors++
}

# 3. Check App.tsx imports useDebounce
Write-Host "3. Checking App.tsx imports useDebounce..." -NoNewline
$appContent = Get-Content "App.tsx" -Raw
if ($appContent -match "import.*useDebounce.*from.*hooks/useDebounce") {
    Write-Host " PASS" -ForegroundColor Green
} else {
    Write-Host " FAIL - useDebounce not imported" -ForegroundColor Red
    $errors++
}

# 4. Check App.tsx uses debouncedSearch
Write-Host "4. Checking App.tsx uses debouncedSearch..." -NoNewline
if ($appContent -match "debouncedSearch\s*=\s*useDebounce") {
    Write-Host " PASS" -ForegroundColor Green
} else {
    Write-Host " FAIL - debouncedSearch not declared" -ForegroundColor Red
    $errors++
}

# 5. Check linksByCategory memoization
Write-Host "5. Checking linksByCategory memoization..." -NoNewline
if ($appContent -match "linksByCategory\s*=\s*useMemo") {
    Write-Host " PASS" -ForegroundColor Green
} else {
    Write-Host " FAIL - linksByCategory not memoized" -ForegroundColor Red
    $errors++
}

# 6. Check LinkCard.tsx has lazy loading
Write-Host "6. Checking LinkCard lazy loading..." -NoNewline
$linkCardContent = Get-Content "components\LinkCard.tsx" -Raw
if ($linkCardContent -match 'loading="lazy"' -and $linkCardContent -match 'decoding="async"') {
    Write-Host " PASS" -ForegroundColor Green
} else {
    Write-Host " FAIL - Lazy loading attributes not found" -ForegroundColor Red
    $errors++
}

# 7. Check vite.config.ts has bundle optimization
Write-Host "7. Checking vite.config.ts bundle optimization..." -NoNewline
$viteContent = Get-Content "vite.config.ts" -Raw
if ($viteContent -match "manualChunks" -and $viteContent -match "vendor.*react") {
    Write-Host " PASS" -ForegroundColor Green
} else {
    Write-Host " FAIL - Manual chunks not configured" -ForegroundColor Red
    $errors++
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Gray

if ($errors -eq 0) {
    Write-Host "All optimizations verified successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Run npm run dev to test in development"
    Write-Host "  2. Run npm run build to check bundle sizes"
    Write-Host "  3. Test search debouncing by typing rapidly"
    Write-Host "  4. Import 100+ links to test virtual scrolling"
} else {
    Write-Host "Found $errors errors - please review above" -ForegroundColor Red
    exit 1
}

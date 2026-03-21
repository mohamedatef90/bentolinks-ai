# Component Polish Verification Script
# Checks that all visual polish changes are properly implemented

Write-Host "🎨 Component Polish Verification" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

$errors = 0
$warnings = 0

# Check 1: Button.tsx exists
Write-Host "✓ Checking Button component..." -NoNewline
if (Test-Path "components\Button.tsx") {
    $content = Get-Content "components\Button.tsx" -Raw
    if ($content -match "ButtonVariant.*primary.*secondary.*ghost.*danger" -and $content -match "isLoading") {
        Write-Host " ✅ PASS" -ForegroundColor Green
    } else {
        Write-Host " ⚠️  INCOMPLETE" -ForegroundColor Yellow
        $warnings++
    }
} else {
    Write-Host " ❌ MISSING" -ForegroundColor Red
    $errors++
}

# Check 2: LoadingSkeleton.tsx exists
Write-Host "✓ Checking LoadingSkeleton component..." -NoNewline
if (Test-Path "components\LoadingSkeleton.tsx") {
    $content = Get-Content "components\LoadingSkeleton.tsx" -Raw
    if ($content -match "LinkCardSkeleton" -and $content -match "animate-pulse") {
        Write-Host " ✅ PASS" -ForegroundColor Green
    } else {
        Write-Host " ⚠️  INCOMPLETE" -ForegroundColor Yellow
        $warnings++
    }
} else {
    Write-Host " ❌ MISSING" -ForegroundColor Red
    $errors++
}

# Check 3: index.css exists
Write-Host "✓ Checking index.css (global styles)..." -NoNewline
if (Test-Path "index.css") {
    $content = Get-Content "index.css" -Raw
    if ($content -match "shimmer" -and $content -match "shadow-neon" -and $content -match "prefers-reduced-motion") {
        Write-Host " ✅ PASS" -ForegroundColor Green
    } else {
        Write-Host " ⚠️  INCOMPLETE" -ForegroundColor Yellow
        $warnings++
    }
} else {
    Write-Host " ❌ MISSING" -ForegroundColor Red
    $errors++
}

# Check 4: LinkCard.tsx has gradient border
Write-Host "✓ Checking LinkCard gradient border..." -NoNewline
if (Test-Path "components\LinkCard.tsx") {
    $content = Get-Content "components\LinkCard.tsx" -Raw
    if ($content -match "before:absolute.*before:inset-0" -and $content -match "shadow-neon") {
        Write-Host " ✅ PASS" -ForegroundColor Green
    } else {
        Write-Host " ⚠️  NOT APPLIED" -ForegroundColor Yellow
        $warnings++
    }
} else {
    Write-Host " ❌ MISSING" -ForegroundColor Red
    $errors++
}

# Check 5: AddLinkModal.tsx has enhanced backdrop
Write-Host "✓ Checking AddLinkModal backdrop..." -NoNewline
if (Test-Path "components\AddLinkModal.tsx") {
    $content = Get-Content "components\AddLinkModal.tsx" -Raw
    if ($content -match "backdrop-blur-sm" -and $content -match "stopPropagation") {
        Write-Host " ✅ PASS" -ForegroundColor Green
    } else {
        Write-Host " ⚠️  NOT APPLIED" -ForegroundColor Yellow
        $warnings++
    }
} else {
    Write-Host " ❌ MISSING" -ForegroundColor Red
    $errors++
}

# Check 6: Documentation exists
Write-Host "✓ Checking documentation..." -NoNewline
if (Test-Path "COMPONENT-POLISH.md") {
    Write-Host " ✅ PASS" -ForegroundColor Green
} else {
    Write-Host " ⚠️  MISSING" -ForegroundColor Yellow
    $warnings++
}

Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Errors: $errors" -ForegroundColor $(if ($errors -eq 0) { "Green" } else { "Red" })
Write-Host "  Warnings: $warnings" -ForegroundColor $(if ($warnings -eq 0) { "Green" } else { "Yellow" })
Write-Host ""

if ($errors -eq 0 -and $warnings -eq 0) {
    Write-Host "✨ All visual polish components verified!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Run 'npm run dev' to test in browser" -ForegroundColor Gray
    Write-Host "  2. Import Button and LoadingSkeleton in your components" -ForegroundColor Gray
    Write-Host "  3. Test LinkCard hover effects" -ForegroundColor Gray
    Write-Host "  4. Open AddLinkModal to see new backdrop" -ForegroundColor Gray
    exit 0
} else {
    Write-Host "⚠️  Some issues detected. Review output above." -ForegroundColor Yellow
    exit 1
}

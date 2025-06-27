# Vercel Deployment Script for Thanksgiving Calendar (PowerShell)
Write-Host "🚀 Starting Vercel deployment for Thanksgiving Calendar..." -ForegroundColor Green

# Check if Vercel CLI is installed
try {
    $null = Get-Command vercel -ErrorAction Stop
    Write-Host "✅ Vercel CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ Vercel CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g vercel
}

# Check if user is logged in
try {
    $null = vercel whoami 2>$null
    Write-Host "✅ Already logged in to Vercel" -ForegroundColor Green
} catch {
    Write-Host "🔐 Please log in to Vercel..." -ForegroundColor Yellow
    vercel login
}

# Deploy to Vercel
Write-Host "📦 Deploying to Vercel..." -ForegroundColor Green
vercel --prod

Write-Host "✅ Deployment completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Set up environment variables in Vercel dashboard:" -ForegroundColor White
Write-Host "   - GITHUB_TOKEN" -ForegroundColor Gray
Write-Host "   - GITHUB_REPO" -ForegroundColor Gray
Write-Host "   - GITHUB_BRANCH" -ForegroundColor Gray
Write-Host "2. Test your application" -ForegroundColor White
Write-Host "3. Update your domain if needed" -ForegroundColor White
Write-Host ""
Write-Host "📖 For more information, see VERCEL-DEPLOYMENT.md" -ForegroundColor Cyan 
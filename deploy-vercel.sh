#!/bin/bash

# Vercel Deployment Script for Thanksgiving Calendar
echo "🚀 Starting Vercel deployment for Thanksgiving Calendar..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Check if user is logged in
if ! vercel whoami &> /dev/null; then
    echo "🔐 Please log in to Vercel..."
    vercel login
fi

# Deploy to Vercel
echo "📦 Deploying to Vercel..."
vercel --prod

echo "✅ Deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. Set up environment variables in Vercel dashboard:"
echo "   - GITHUB_TOKEN"
echo "   - GITHUB_REPO"
echo "   - GITHUB_BRANCH"
echo "2. Test your application"
echo "3. Update your domain if needed"
echo ""
echo "📖 For more information, see VERCEL-DEPLOYMENT.md" 
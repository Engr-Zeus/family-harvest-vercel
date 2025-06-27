# GitHub Setup for Vercel Deployment

This guide will help you set up the GitHub integration for your Vercel deployment.

## Step 1: Create GitHub Personal Access Token

### 1. Go to GitHub Settings
1. Log in to your GitHub account
2. Click your profile picture in the top right
3. Select **Settings**

### 2. Navigate to Developer Settings
1. Scroll down to the bottom of the left sidebar
2. Click **Developer settings**

### 3. Create Personal Access Token
1. Click **Personal access tokens**
2. Click **Tokens (classic)**
3. Click **Generate new token (classic)**

### 4. Configure Token
1. **Note**: Enter a descriptive name like "Thanksgiving Calendar Vercel"
2. **Expiration**: Choose an expiration (recommended: 90 days or custom)
3. **Scopes**: Select the following scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Action workflows)

### 5. Generate Token
1. Click **Generate token**
2. **IMPORTANT**: Copy the token immediately - you won't see it again!
3. Save it securely (password manager recommended)

## Step 2: Get Repository Information

### Repository Name
Your repository name should be in the format: `username/repository-name`

For example:
- If your GitHub username is `johndoe` and your repo is `thanksgiving-calendar`
- The repository name would be: `johndoe/thanksgiving-calendar`

### Branch Name
The default branch is usually `main` or `master`. You can check this:
1. Go to your repository on GitHub
2. Look at the branch dropdown (usually shows "main" or "master")

## Step 3: Set Environment Variables in Vercel

### Option A: Using Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit [vercel.com/dashboard](https://vercel.com/dashboard)
   - Select your project

2. **Navigate to Settings**
   - Click on your project
   - Go to **Settings** tab
   - Click **Environment Variables**

3. **Add Environment Variables**
   Add these three variables:

   ```
   Name: GITHUB_TOKEN
   Value: [Your GitHub Personal Access Token]
   Environment: Production, Preview, Development
   ```

   ```
   Name: GITHUB_REPO
   Value: [Your GitHub username]/[Your repository name]
   Environment: Production, Preview, Development
   ```

   ```
   Name: GITHUB_BRANCH
   Value: main
   Environment: Production, Preview, Development
   ```

4. **Save and Redeploy**
   - Click **Save** for each variable
   - Go to **Deployments** tab
   - Click **Redeploy** on your latest deployment

### Option B: Using Vercel CLI

1. **Create .env.local file** (for local development):
   ```
   GITHUB_TOKEN=your_github_token_here
   GITHUB_REPO=your-username/your-repo-name
   GITHUB_BRANCH=main
   ```

2. **Set environment variables**:
   ```bash
   vercel env add GITHUB_TOKEN
   vercel env add GITHUB_REPO
   vercel env add GITHUB_BRANCH
   ```

3. **Redeploy**:
   ```bash
   vercel --prod
   ```

## Step 4: Test the Integration

### Test Health Endpoint
Visit: `https://your-project.vercel.app/api/health`

You should see:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "github_configured": true,
  "github_repo": "your-username/your-repo-name",
  "environment": "production",
  "platform": "Vercel"
}
```

### Test Adding an Attendee
1. Go to your application
2. Add a new attendee
3. Check your GitHub repository for new CSV files

## Troubleshooting

### Common Issues

1. **"github_configured": false**
   - Check that GITHUB_TOKEN is set correctly
   - Verify the token has the correct permissions

2. **"Repository not found"**
   - Check GITHUB_REPO format (should be `username/repo-name`)
   - Verify the repository exists and is accessible

3. **"Branch not found"**
   - Check GITHUB_BRANCH value
   - Verify the branch exists in your repository

4. **"Permission denied"**
   - Check that the token has `repo` scope
   - Verify the token hasn't expired

### Security Notes

- **Never commit your token** to version control
- **Use environment variables** for all sensitive data
- **Rotate tokens regularly** (every 90 days recommended)
- **Use minimal permissions** - only grant what's needed

## Example Configuration

Here's what your environment variables should look like:

```
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_REPO=johndoe/thanksgiving-calendar
GITHUB_BRANCH=main
```

## Next Steps

After setting up the environment variables:

1. **Test the application** by adding a new attendee
2. **Check your GitHub repository** for CSV files
3. **Monitor the Vercel function logs** for any errors
4. **Update your documentation** with the new deployment URL

Your Thanksgiving Calendar is now fully integrated with GitHub for data persistence! 🎉 
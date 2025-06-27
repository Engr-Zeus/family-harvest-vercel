# Vercel Deployment Guide

This guide will help you deploy your Thanksgiving Calendar application to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Account**: Your code should be in a GitHub repository
3. **Node.js**: Version 18.x or higher

## Project Structure

The project has been restructured for Vercel deployment:

```
├── api/                    # Serverless functions
│   ├── calendar.js        # GET /api/calendar
│   ├── calendar/
│   │   └── public.js      # GET /api/calendar/public
│   ├── attendee.js        # POST /api/attendee
│   ├── attendees/
│   │   └── [dateKey].js   # GET /api/attendees/:dateKey
│   ├── health.js          # GET /api/health
│   ├── download/
│   │   ├── backend.js     # GET /api/download/backend
│   │   └── public.js      # GET /api/download/public
│   └── csv/
│       ├── backend.js     # GET /api/csv/backend
│       └── public.js      # GET /api/csv/public
├── vercel.json            # Vercel configuration
├── package.json           # Dependencies and scripts
├── index.html             # Frontend application
├── styles.css             # Frontend styles
├── script.js              # Frontend JavaScript
└── calendar-data.json     # Data storage (will be created automatically)
```

## Deployment Steps

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Login to Vercel

```bash
vercel login
```

### 3. Deploy to Vercel

From your project directory:

```bash
vercel
```

Follow the prompts:
- Set up and deploy? `Y`
- Which scope? Select your account
- Link to existing project? `N`
- What's your project's name? `thanksgiving-calendar` (or your preferred name)
- In which directory is your code located? `./` (current directory)
- Want to override the settings? `N`

### 4. Set Environment Variables

After deployment, set up your environment variables in the Vercel dashboard:

1. Go to your project dashboard on Vercel
2. Navigate to Settings → Environment Variables
3. Add the following variables:

```
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_REPO=your-username/your-repo-name
GITHUB_BRANCH=main
```

### 5. Redeploy with Environment Variables

```bash
vercel --prod
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_TOKEN` | GitHub Personal Access Token for CSV file storage | No (but recommended) |
| `GITHUB_REPO` | GitHub repository (format: username/repo-name) | No (defaults to placeholder) |
| `GITHUB_BRANCH` | GitHub branch name | No (defaults to 'main') |

## API Endpoints

After deployment, your API will be available at:
- Production: `https://your-project-name.vercel.app/api/*`
- Preview: `https://your-project-name-git-branch-username.vercel.app/api/*`

### Available Endpoints

- `GET /api/health` - Health check
- `GET /api/calendar` - Get all calendar data
- `GET /api/calendar/public` - Get public data (no phone numbers)
- `POST /api/attendee` - Add new attendee
- `GET /api/attendees/:dateKey` - Get attendees for specific date
- `GET /api/download/backend` - Download backend JSON
- `GET /api/download/public` - Download public JSON
- `GET /api/csv/backend` - Download backend CSV
- `GET /api/csv/public` - Download public CSV

## Data Storage

**Important**: Vercel serverless functions use ephemeral storage, meaning:
- Data stored in `calendar-data.json` will be lost between function invocations
- For persistent storage, consider using:
  - Vercel KV (Redis)
  - Vercel Postgres
  - External database (MongoDB, PostgreSQL, etc.)
  - GitHub integration (already implemented)

## GitHub Integration

The application includes GitHub integration for CSV file storage:
- CSV files are automatically uploaded to your GitHub repository
- Files are named with the current date
- Both backend (with phone numbers) and public (without phone numbers) versions are created

## Local Development

For local development, you can still use the original Express server:

```bash
npm run dev
```

## Troubleshooting

### Common Issues

1. **Function timeout**: Increase `maxDuration` in `vercel.json`
2. **CORS errors**: CORS headers are already configured in all API functions
3. **File system errors**: Remember that Vercel functions have read-only file system except for `/tmp`

### Debugging

1. Check Vercel function logs in the dashboard
2. Use the health endpoint: `GET /api/health`
3. Test locally with `vercel dev`

## Migration from Heroku

If migrating from Heroku:

1. Export your data from the old deployment
2. Update your frontend URLs to point to the new Vercel deployment
3. Set up environment variables in Vercel
4. Test all functionality before switching over

## Support

For Vercel-specific issues:
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Community](https://github.com/vercel/vercel/discussions)

For application-specific issues:
- Check the function logs in Vercel dashboard
- Test the health endpoint
- Verify environment variables are set correctly 
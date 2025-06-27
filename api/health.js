module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method === 'GET') {
        const githubRepo = process.env.GITHUB_REPO || 'Engr-Zeus/family-harvest-vercel';
        const githubBranch = process.env.GITHUB_BRANCH || 'main';
        
        res.json({ 
            status: 'OK', 
            timestamp: new Date().toISOString(),
            github_configured: !!process.env.GITHUB_TOKEN,
            github_repo: githubRepo,
            github_branch: githubBranch,
            environment: process.env.NODE_ENV || 'development',
            platform: 'Vercel'
        });
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}; 
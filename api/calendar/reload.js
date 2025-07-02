const fs = require('fs');
const https = require('https');

let GITHUB_REPO = process.env.GITHUB_REPO || 'Engr-Zeus/family-harvest-vercel';
GITHUB_REPO = GITHUB_REPO.replace('https://github.com/', '').replace('.git', '');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const DATA_FILE = '/tmp/calendar-data.json';

function makeGitHubRequest(url, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: url.replace('https://api.github.com', ''),
            method: method,
            headers: {
                'User-Agent': 'Thanksgiving-Calendar-App',
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        };
        if (body) options.headers['Content-Type'] = 'application/json';
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, data }); }
            });
        });
        req.on('error', (error) => reject(error));
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    if (!GITHUB_TOKEN) {
        res.status(500).json({ error: 'GitHub token not configured' });
        return;
    }
    try {
        const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/calendar-data.json`;
        const response = await makeGitHubRequest(url, 'GET');
        if (response.status === 200) {
            const content = Buffer.from(response.data.content, 'base64').toString('utf8');
            fs.writeFileSync(DATA_FILE, content, 'utf8');
            res.json({ success: true, message: 'Cache reloaded from GitHub', data: JSON.parse(content) });
        } else {
            res.status(500).json({ error: 'Failed to fetch from GitHub', details: response.data });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error reloading from GitHub', details: error.message });
    }
}; 
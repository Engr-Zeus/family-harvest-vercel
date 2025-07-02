const fs = require('fs');
const path = require('path');
const https = require('https');

// Data file path - use /tmp for Vercel serverless functions
const DATA_FILE = '/tmp/calendar-data.json';

// GitHub configuration - clean up repository format
let GITHUB_REPO = process.env.GITHUB_REPO || 'Engr-Zeus/family-harvest-vercel';
// Remove URL and .git extension if present
GITHUB_REPO = GITHUB_REPO.replace('https://github.com/', '').replace('.git', '');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

// Helper function to make GitHub API requests
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

        if (body) {
            options.headers['Content-Type'] = 'application/json';
        }

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({
                        status: res.statusCode,
                        data: jsonData
                    });
                } catch (error) {
                    resolve({
                        status: res.statusCode,
                        data: data
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (body) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
}

// Helper function to read data from cache
function readDataFromCache() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const cached = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(cached);
        }
    } catch (err) {
        console.error('Error reading from cache:', err.message);
    }
    return {};
}

// Helper function to read data from GitHub
async function readDataFromGitHubWithCache() {
    if (!GITHUB_TOKEN) {
        console.log('GitHub token not configured, using cache or empty data');
        return readDataFromCache();
    }
    try {
        console.log('Reading data from GitHub repository:', GITHUB_REPO);
        const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/calendar-data.json`;
        console.log('GitHub API URL:', url);
        const response = await makeGitHubRequest(url, 'GET');
        console.log('GitHub API response status:', response.status);
        if (response.status === 200) {
            const content = Buffer.from(response.data.content, 'base64').toString('utf8');
            console.log('Successfully read data from GitHub');
            // Update cache
            try {
                fs.writeFileSync(DATA_FILE, content, 'utf8');
            } catch (err) {
                console.error('Error writing to cache:', err.message);
            }
            return JSON.parse(content);
        } else if (response.status === 404) {
            console.log('No existing data file found, starting fresh');
            return {};
        } else {
            console.error('GitHub API error:', response.status, response.data);
            // Try cache
            return readDataFromCache();
        }
    } catch (error) {
        console.error('Error reading from GitHub:', error.message);
        // Try cache
        return readDataFromCache();
    }
}

// Helper function to write data to GitHub
async function writeDataToGitHub(data) {
    if (!GITHUB_TOKEN) {
        console.log('GitHub token not configured, skipping data write');
        return false;
    }

    try {
        console.log('Writing data to GitHub repository:', GITHUB_REPO);
        
        // First, get the current file SHA (if it exists)
        const getFileUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/calendar-data.json`;
        const getFileResponse = await makeGitHubRequest(getFileUrl, 'GET');
        
        let sha = null;
        if (getFileResponse.status === 200) {
            sha = getFileResponse.data.sha;
            console.log('Found existing file, will update');
        } else {
            console.log('No existing file, will create new');
        }

        // Prepare the file content
        const fileContent = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
        
        // Create the request body
        const requestBody = {
            message: `Update calendar data - ${new Date().toISOString()}`,
            content: fileContent,
            branch: GITHUB_BRANCH
        };

        if (sha) {
            requestBody.sha = sha;
        }

        // Write the file to GitHub
        const writeFileUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/calendar-data.json`;
        const writeResponse = await makeGitHubRequest(writeFileUrl, 'PUT', requestBody);

        if (writeResponse.status === 200 || writeResponse.status === 201) {
            console.log('✅ Calendar data written to GitHub successfully');
            return true;
        } else {
            console.error('❌ Failed to write calendar data to GitHub:', writeResponse.status, writeResponse.data);
            return false;
        }
    } catch (error) {
        console.error('❌ Error writing calendar data to GitHub:', error.message);
        return false;
    }
}

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method === 'GET') {
        try {
            console.log('Calendar API called - reading data from GitHub (with cache fallback)');
            const data = await readDataFromGitHubWithCache();
            console.log('Data retrieved:', Object.keys(data).length, 'dates');
            res.json(data);
        } catch (error) {
            console.error('Error in calendar API:', error);
            res.status(500).json({ error: 'Failed to read calendar data', details: error.message });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}; 
const fs = require('fs');
const path = require('path');
const https = require('https');

// Data file path - use /tmp for Vercel serverless functions
const DATA_FILE = '/tmp/calendar-data.json';

// GitHub configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'Engr-Zeus/family-harvest-vercel';
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

// Helper function to read data from GitHub
async function readDataFromGitHub() {
    if (!GITHUB_TOKEN) {
        console.log('GitHub token not configured, using empty data');
        return {};
    }

    try {
        const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/calendar-data.json`;
        const response = await makeGitHubRequest(url, 'GET');
        
        if (response.status === 200) {
            const content = Buffer.from(response.data.content, 'base64').toString('utf8');
            return JSON.parse(content);
        } else {
            console.log('No existing data file found, starting fresh');
            return {};
        }
    } catch (error) {
        console.error('Error reading from GitHub:', error.message);
        return {};
    }
}

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
        try {
            const data = await readDataFromGitHub();
            const publicData = {};
            
            for (const [dateKey, attendees] of Object.entries(data)) {
                publicData[dateKey] = attendees.map(attendee => ({
                    name: attendee.name,
                    mass: attendee.mass
                }));
            }
            
            res.json(publicData);
        } catch (error) {
            res.status(500).json({ error: 'Failed to read public calendar data' });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}; 
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

// Data file paths - prefer a shared project-level file so bookings are visible across devices
const PROJECT_DATA_FILE = path.join(process.cwd(), 'calendar-data.json');
const TMP_DATA_FILE = path.join(os.tmpdir(), 'calendar-data.json');
const FALLBACK_DATA_FILE = path.join(__dirname, '..', 'calendar-data.json');

// GitHub configuration - clean up repository format
function normalizeGitHubRepo(repo) {
    return String(repo || 'Engr-Zeus/family-harvest-vercel')
        .trim()
        .replace(/^https?:\/\/github\.com\//i, '')
        .replace(/^https?:\/\/www\.github\.com\//i, '')
        .replace(/\.git$/i, '')
        .replace(/\/+$/, '')
        .replace(/^\//, '');
}

let GITHUB_REPO = normalizeGitHubRepo(process.env.GITHUB_REPO || 'Engr-Zeus/family-harvest-vercel');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

// Helper function to read the raw request body from Vercel/serverless requests
function getRequestBody(req) {
    if (req.body !== undefined) {
        return Promise.resolve(req.body);
    }

    if (req.rawBody !== undefined) {
        return Promise.resolve(req.rawBody);
    }

    return new Promise((resolve, reject) => {
        let data = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => {
            data += chunk;
        });
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
}

// Helper function to read data from the local cache
function readDataFromCache() {
    const candidates = [PROJECT_DATA_FILE, FALLBACK_DATA_FILE, TMP_DATA_FILE];

    for (const filePath of candidates) {
        try {
            if (fs.existsSync(filePath)) {
                const cached = fs.readFileSync(filePath, 'utf8');
                if (cached) {
                    return JSON.parse(cached);
                }
            }
        } catch (error) {
            console.error('Error reading from cache:', error.message);
        }
    }

    return {};
}

// Helper function to write data to the local cache
function writeDataToCache(data) {
    const serializedData = JSON.stringify(data, null, 2);
    const candidates = [PROJECT_DATA_FILE, FALLBACK_DATA_FILE, TMP_DATA_FILE];

    for (const filePath of candidates) {
        try {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, serializedData);
        } catch (error) {
            console.error('Error writing to cache file:', filePath, error.message);
        }
    }
}

// Helper function to convert JSON to CSV
function jsonToCSV(data, includePhone = true) {
    const csvRows = [];
    
    // Add header row
    if (includePhone) {
        csvRows.push('Date,Name,Phone,Mass,Added At');
    } else {
        csvRows.push('Date,Name,Mass');
    }
    
    // Add data rows
    for (const [dateKey, attendees] of Object.entries(data)) {
        for (const attendee of attendees) {
            const date = new Date(dateKey).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            if (includePhone) {
                csvRows.push(`"${date}","${attendee.name}","${attendee.phone}","${attendee.mass}","${attendee.addedAt}"`);
            } else {
                csvRows.push(`"${date}","${attendee.name}","${attendee.mass}"`);
            }
        }
    }
    
    return csvRows.join('\n');
}

// Helper function to make GitHub API requests
function makeGitHubRequest(url, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: url.replace('https://api.github.com', ''),
            method: method,
            headers: {
                'User-Agent': 'Thanksgiving-Calendar-App',
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'X-GitHub-Api-Version': '2022-11-28'
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

// Helper function to read data from GitHub with a local cache fallback
async function readDataFromGitHubWithCache() {
    const cachedData = readDataFromCache();

    if (!GITHUB_TOKEN) {
        console.log('GitHub token not configured, using cached data');
        return cachedData;
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
            const parsedData = JSON.parse(content);
            writeDataToCache(parsedData);
            return parsedData;
        } else if (response.status === 404) {
            console.log('No existing data file found, starting fresh');
            return cachedData;
        } else {
            console.error('GitHub API error:', response.status, response.data);
            return cachedData;
        }
    } catch (error) {
        console.error('Error reading from GitHub:', error.message);
        return cachedData;
    }
}

// Helper function to write data to GitHub
async function writeDataToGitHub(data) {
    if (!GITHUB_TOKEN) {
        console.log('GitHub token not configured, skipping data write');
        throw new Error('GitHub token not configured');
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
        }

        const detail = typeof writeResponse.data === 'string'
            ? writeResponse.data
            : (writeResponse.data && writeResponse.data.message ? writeResponse.data.message : JSON.stringify(writeResponse.data));
        console.error('❌ Failed to write calendar data to GitHub:', writeResponse.status, detail);
        throw new Error(`GitHub calendar write failed (${writeResponse.status}): ${detail}`);
    } catch (error) {
        console.error('❌ Error writing calendar data to GitHub:', error.message);
        throw error;
    }
}

// Helper function to write CSV to GitHub
async function writeCSVToGitHub(csvContent, filename, commitMessage) {
    if (!GITHUB_TOKEN) {
        console.log('GitHub token not configured, skipping GitHub write');
        throw new Error('GitHub token not configured');
    }

    try {
        // First, get the current file SHA (if it exists)
        const getFileUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filename}`;
        const getFileResponse = await makeGitHubRequest(getFileUrl, 'GET');
        
        let sha = null;
        if (getFileResponse.status === 200) {
            sha = getFileResponse.data.sha;
        }

        // Prepare the file content
        const fileContent = Buffer.from(csvContent).toString('base64');
        
        // Create the request body
        const requestBody = {
            message: commitMessage,
            content: fileContent,
            branch: GITHUB_BRANCH
        };

        if (sha) {
            requestBody.sha = sha;
        }

        // Write the file to GitHub
        const writeFileUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filename}`;
        const writeResponse = await makeGitHubRequest(writeFileUrl, 'PUT', requestBody);

        if (writeResponse.status === 200 || writeResponse.status === 201) {
            console.log(`✅ CSV file ${filename} written to GitHub successfully`);
            return true;
        }

        const detail = typeof writeResponse.data === 'string'
            ? writeResponse.data
            : (writeResponse.data && writeResponse.data.message ? writeResponse.data.message : JSON.stringify(writeResponse.data));
        console.error(`❌ Failed to write ${filename} to GitHub:`, writeResponse.status, detail);
        throw new Error(`GitHub CSV write failed (${writeResponse.status}): ${detail}`);
    } catch (error) {
        console.error(`❌ Error writing ${filename} to GitHub:`, error.message);
        throw error;
    }
}

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method === 'POST') {
        try {
            const rawBody = await getRequestBody(req);
            let body = rawBody || {};

            if (Buffer.isBuffer(body)) {
                body = body.toString('utf8');
            }

            if (typeof body === 'string') {
                const trimmed = body.trim();
                if (!trimmed) {
                    body = {};
                } else {
                    try {
                        body = JSON.parse(trimmed);
                    } catch (error) {
                        const parsed = new URLSearchParams(trimmed);
                        body = Object.fromEntries(parsed.entries());
                    }
                }
            }

            const { dateKey, name, phone, mass } = body;
            
            if (!dateKey || !name || !phone || !mass) {
                return res.status(400).json({ error: 'Missing required fields' });
            }
            
            // Read existing data from cache/GitHub
            const data = await readDataFromGitHubWithCache();
            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                data = {};
            }
            
            if (!data[dateKey]) {
                data[dateKey] = [];
            }
            
            // Check for duplicate names
            if (data[dateKey].some(attendee => attendee.name.toLowerCase() === name.toLowerCase())) {
                return res.status(400).json({ error: 'Name already exists for this date' });
            }
            
            data[dateKey].push({
                name,
                phone,
                mass,
                addedAt: new Date().toISOString()
            });
            
            // Persist locally so the calendar can read it immediately
            writeDataToCache(data);
            
            let githubUpdated = false;
            let githubSyncError = null;
            let csvSyncError = null;

            // Sync to GitHub when configured, but do not block the booking flow if it fails
            try {
                githubUpdated = await writeDataToGitHub(data);
            } catch (error) {
                githubSyncError = error.message;
                console.error('GitHub sync failed, but local cache was updated:', error.message);
            }
            
            // Generate CSV content
            const today = new Date().toISOString().split('T')[0];
            const backendCSV = jsonToCSV(data, true);
            const publicCSV = jsonToCSV(data, false);
            
            // Write to GitHub repository
            const backendFilename = `thanksgiving-calendar-backend-${today}.csv`;
            const publicFilename = `thanksgiving-calendar-public-${today}.csv`;
            
            const backendCommitMessage = `Update backend CSV: ${name} added to ${dateKey}`;
            const publicCommitMessage = `Update public CSV: ${name} added to ${dateKey}`;
            
            // Write both files to GitHub
            try {
                await writeCSVToGitHub(backendCSV, backendFilename, backendCommitMessage);
                await writeCSVToGitHub(publicCSV, publicFilename, publicCommitMessage);
            } catch (error) {
                csvSyncError = error.message;
                console.error('CSV sync failed, but booking was persisted locally:', error.message);
            }
            
            res.json({ 
                success: true, 
                message: 'Attendee added successfully',
                github_updated: githubUpdated,
                persisted_locally: true,
                data,
                github_sync_error: githubSyncError,
                csv_sync_error: csvSyncError
            });
        } catch (error) {
            console.error('Error adding attendee:', error);
            res.status(500).json({ error: 'Failed to add attendee', details: error.message });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}; 
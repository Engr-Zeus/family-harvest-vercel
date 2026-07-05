const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

// Data file path - use a platform-safe temp location with a local fallback
const DATA_FILE = path.join(os.tmpdir(), 'calendar-data.json');
const FALLBACK_DATA_FILE = path.join(__dirname, '..', 'calendar-data.json');

// GitHub configuration - clean up repository format
let GITHUB_REPO = process.env.GITHUB_REPO || 'Engr-Zeus/family-harvest-vercel';
// Remove URL and .git extension if present
GITHUB_REPO = GITHUB_REPO.replace('https://github.com/', '').replace('.git', '');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

// Helper function to read data from the local cache
function readDataFromCache() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const cached = fs.readFileSync(DATA_FILE, 'utf8');
            if (cached) {
                return JSON.parse(cached);
            }
        }

        if (fs.existsSync(FALLBACK_DATA_FILE)) {
            const fallback = fs.readFileSync(FALLBACK_DATA_FILE, 'utf8');
            if (fallback) {
                return JSON.parse(fallback);
            }
        }
    } catch (error) {
        console.error('Error reading from cache:', error.message);
    }

    return {};
}

// Helper function to write data to the local cache
function writeDataToCache(data) {
    try {
        fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error writing to cache:', error.message);
    }

    try {
        fs.mkdirSync(path.dirname(FALLBACK_DATA_FILE), { recursive: true });
        fs.writeFileSync(FALLBACK_DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error writing to fallback data file:', error.message);
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

// Helper function to write CSV to GitHub
async function writeCSVToGitHub(csvContent, filename, commitMessage) {
    if (!GITHUB_TOKEN) {
        console.log('GitHub token not configured, skipping GitHub write');
        return false;
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
        } else {
            console.error(`❌ Failed to write ${filename} to GitHub:`, writeResponse.status);
            return false;
        }
    } catch (error) {
        console.error(`❌ Error writing ${filename} to GitHub:`, error.message);
        return false;
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
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const { dateKey, name, phone, mass } = body;
            
            if (!dateKey || !name || !phone || !mass) {
                return res.status(400).json({ error: 'Missing required fields' });
            }
            
            // Read existing data from cache/GitHub
            const data = await readDataFromGitHubWithCache();
            
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
            
            // Sync to GitHub when configured, but do not block the booking flow if it fails
            try {
                await writeDataToGitHub(data);
            } catch (error) {
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
                console.error('CSV sync failed, but booking was persisted locally:', error.message);
            }
            
            res.json({ 
                success: true, 
                message: 'Attendee added successfully',
                github_updated: !!GITHUB_TOKEN,
                persisted_locally: true
            });
        } catch (error) {
            console.error('Error adding attendee:', error);
            res.status(500).json({ error: 'Failed to add attendee', details: error.message });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}; 
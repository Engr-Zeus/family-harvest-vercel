const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

// Data file paths - prefer a shared project-level file so bookings are visible across devices
const PROJECT_DATA_FILE = path.join(process.cwd(), 'calendar-data.json');
const TMP_DATA_FILE = path.join(os.tmpdir(), 'calendar-data.json');
const FALLBACK_DATA_FILE = path.join(__dirname, '..', 'calendar-data.json');

// GitHub configuration - clean up repository format
let GITHUB_REPO = process.env.GITHUB_REPO || 'Engr-Zeus/family-harvest-vercel';
// Normalize repo format from either 'user/repo' or 'https://github.com/user/repo.git'
GITHUB_REPO = GITHUB_REPO
    .replace('https://github.com/', '')
    .replace('http://github.com/', '')
    .replace(/\.git$/i, '')
    .replace(/^\//, '');
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

function parseCsvLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    values.push(current.trim());
    return values;
}

function deriveDateKey(dateText) {
    if (!dateText) {
        return null;
    }

    const parsed = new Date(dateText);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
    }

    return null;
}

function parseCsvToCalendarData(csvContent) {
    const rows = csvContent
        .split(/\r?\n/)
        .map(row => row.trim())
        .filter(Boolean);

    if (rows.length < 2) {
        return {};
    }

    const headers = parseCsvLine(rows[0]).map(header => header.toLowerCase());
    const headerMap = {};
    headers.forEach((header, index) => {
        headerMap[header] = index;
    });

    const data = {};

    rows.slice(1).forEach((row) => {
        const values = parseCsvLine(row);
        if (!values || values.length < 2) {
            return;
        }

        const dateKey = headerMap.datekey
            ? values[headerMap.datekey] || null
            : null;
        const dateText = headerMap.date
            ? values[headerMap.date]
            : values[0];
        const resolvedDateKey = dateKey || deriveDateKey(dateText) || null;
        const name = values[headerMap.name || 1] || '';
        const phone = headerMap.phone ? values[headerMap.phone] || '' : '';
        const mass = headerMap.mass ? values[headerMap.mass] || '' : values[headerMap.name ? 2 : 2] || '';
        const addedAt = headerMap.addedat ? values[headerMap.addedat] || '' : '';

        if (!resolvedDateKey || !name) {
            return;
        }

        if (!data[resolvedDateKey]) {
            data[resolvedDateKey] = [];
        }

        data[resolvedDateKey].push({
            name,
            phone,
            mass,
            addedAt
        });
    });

    return data;
}

async function readLatestCsvFromGitHub() {
    if (!GITHUB_REPO) {
        return null;
    }

    try {
        console.log('Looking for the latest CSV in GitHub repository:', GITHUB_REPO);
        const listUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents`;
        const listResponse = await makeGitHubRequest(listUrl, 'GET');

        if (listResponse.status !== 200) {
            console.error('Failed to list repository contents:', listResponse.status, listResponse.data);
            return null;
        }

        const files = Array.isArray(listResponse.data) ? listResponse.data : [];
        const csvFiles = files
            .filter(file => file && file.type === 'file' && /thanksgiving-calendar-(public|backend)-\d{4}-\d{2}-\d{2}\.csv$/i.test(file.name))
            .sort((a, b) => b.name.localeCompare(a.name));

        if (csvFiles.length === 0) {
            console.log('No CSV export files found in GitHub repository');
            return null;
        }

        for (const file of csvFiles) {
            const fileUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(file.name)}`;
            const fileResponse = await makeGitHubRequest(fileUrl, 'GET');

            if (fileResponse.status === 200) {
                const content = typeof fileResponse.data === 'string'
                    ? fileResponse.data
                    : (fileResponse.data && fileResponse.data.content
                        ? Buffer.from(fileResponse.data.content, 'base64').toString('utf8')
                        : '');

                const parsedData = parseCsvToCalendarData(content);
                if (Object.keys(parsedData).length > 0) {
                    console.log('Successfully parsed calendar data from GitHub CSV:', file.name);
                    fs.writeFileSync(PROJECT_DATA_FILE, JSON.stringify(parsedData, null, 2), 'utf8');
                    return parsedData;
                }
            }
        }
    } catch (error) {
        console.error('Error reading latest CSV from GitHub:', error.message);
    }

    return null;
}

// Helper function to read data from cache
function readDataFromCache() {
    const candidates = [PROJECT_DATA_FILE, FALLBACK_DATA_FILE, TMP_DATA_FILE];

    for (const filePath of candidates) {
        try {
            if (fs.existsSync(filePath)) {
                const cached = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(cached);
            }
        } catch (err) {
            console.error('Error reading from cache:', err.message);
        }
    }

    return {};
}

// Helper function to read data from GitHub
async function readDataFromGitHubWithCache() {
    try {
        console.log('Reading calendar data from the latest GitHub CSV export');
        const csvData = await readLatestCsvFromGitHub();
        if (csvData) {
            return csvData;
        }

        console.log('No GitHub CSV data found, falling back to cache');
        return readDataFromCache();
    } catch (error) {
        console.error('Error reading from GitHub:', error.message);
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
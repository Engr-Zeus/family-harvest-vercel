const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

// Data file paths - prefer a shared project-level file so bookings are visible across devices
const PROJECT_DATA_FILE = path.join(process.cwd(), 'calendar-data.json');
const TMP_DATA_FILE = path.join(os.tmpdir(), 'calendar-data.json');
const FALLBACK_DATA_FILE = path.join(__dirname, '..', '..', 'calendar-data.json');

// GitHub configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
let GITHUB_REPO = process.env.GITHUB_REPO || 'Engr-Zeus/family-harvest-vercel';
GITHUB_REPO = GITHUB_REPO
    .replace('https://github.com/', '')
    .replace('http://github.com/', '')
    .replace(/\.git$/i, '')
    .replace(/^\//, '');
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

        const dateKey = headerMap.datekey ? values[headerMap.datekey] || null : null;
        const dateText = headerMap.date ? values[headerMap.date] : values[0];
        const resolvedDateKey = dateKey || deriveDateKey(dateText) || null;
        const name = values[headerMap.name || 1] || '';
        const mass = headerMap.mass ? values[headerMap.mass] || '' : values[headerMap.name ? 2 : 2] || '';

        if (!resolvedDateKey || !name) {
            return;
        }

        if (!data[resolvedDateKey]) {
            data[resolvedDateKey] = [];
        }

        data[resolvedDateKey].push({ name, mass });
    });

    return data;
}

async function readLatestCsvFromGitHub() {
    try {
        const listResponse = await makeGitHubRequest(`https://api.github.com/repos/${GITHUB_REPO}/contents`, 'GET');
        if (listResponse.status !== 200) {
            return null;
        }

        const files = Array.isArray(listResponse.data) ? listResponse.data : [];
        const csvFiles = files
            .filter(file => file && file.type === 'file' && /thanksgiving-calendar-(public|backend)-\d{4}-\d{2}-\d{2}\.csv$/i.test(file.name))
            .sort((a, b) => b.name.localeCompare(a.name));

        for (const file of csvFiles) {
            const fileResponse = await makeGitHubRequest(`https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(file.name)}`, 'GET');
            if (fileResponse.status === 200) {
                const content = typeof fileResponse.data === 'string'
                    ? fileResponse.data
                    : (fileResponse.data && fileResponse.data.content
                        ? Buffer.from(fileResponse.data.content, 'base64').toString('utf8')
                        : '');
                const parsedData = parseCsvToCalendarData(content);
                if (Object.keys(parsedData).length > 0) {
                    return parsedData;
                }
            }
        }
    } catch (error) {
        console.error('Error reading latest CSV from GitHub:', error.message);
    }

    return null;
}

function readDataFromCache() {
    const candidates = [PROJECT_DATA_FILE, FALLBACK_DATA_FILE, TMP_DATA_FILE];

    for (const filePath of candidates) {
        try {
            if (fs.existsSync(filePath)) {
                const cached = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(cached);
            }
        } catch (error) {
            console.error('Error reading from cache:', error.message);
        }
    }

    return {};
}

// Helper function to read data from GitHub
async function readDataFromGitHub() {
    try {
        const csvData = await readLatestCsvFromGitHub();
        if (csvData) {
            return csvData;
        }

        return readDataFromCache();
    } catch (error) {
        console.error('Error reading from GitHub:', error.message);
        return readDataFromCache();
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
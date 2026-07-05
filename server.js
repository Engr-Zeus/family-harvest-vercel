const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
        try {
            JSON.parse(buf);
        } catch (e) {
            console.error('JSON parsing error:', e.message);
            console.error('Raw body:', buf.toString());
            throw new Error('Invalid JSON');
        }
    }
}));
app.use(express.static('.')); // Serve static files

// Debug middleware to log requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    if (req.method === 'POST' && req.path === '/api/attendee') {
        console.log('Request headers:', req.headers);
        console.log('Request body:', req.body);
    }
    next();
});

// Data file path
const DATA_FILE = path.join(__dirname, 'calendar-data.json');
const TMP_DATA_FILE = path.join(os.tmpdir(), 'calendar-data.json');

// GitHub configuration
function normalizeGitHubRepo(repo) {
    return String(repo || 'your-username/your-repo-name')
        .trim()
        .replace(/^https?:\/\/github\.com\//i, '')
        .replace(/^https?:\/\/www\.github\.com\//i, '')
        .replace(/\.git$/i, '')
        .replace(/\/+$/, '')
        .replace(/^\//, '');
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = normalizeGitHubRepo(process.env.GITHUB_REPO || 'your-username/your-repo-name');
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
}
if (!fs.existsSync(TMP_DATA_FILE)) {
    fs.writeFileSync(TMP_DATA_FILE, JSON.stringify({}));
}

// Helper function to read data from the local data file
function readDataFromCache() {
    const candidates = [DATA_FILE, TMP_DATA_FILE];

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

// Helper function to write data to the local data file
function writeDataToCache(data) {
    const serializedData = JSON.stringify(data, null, 2);
    const candidates = [DATA_FILE, TMP_DATA_FILE];

    for (const filePath of candidates) {
        try {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, serializedData);
        } catch (error) {
            console.error('Error writing to cache:', error.message);
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

// Helper function to write CSV to file (local backup and repository export)
function writeCSVToFile(data, filename, includePhone = true) {
    const csvContent = jsonToCSV(data, includePhone);
    const repoFilePath = path.join(__dirname, filename);
    const publicFilePath = path.join(__dirname, 'public', filename);

    fs.writeFileSync(repoFilePath, csvContent);

    try {
        fs.mkdirSync(path.dirname(publicFilePath), { recursive: true });
        fs.writeFileSync(publicFilePath, csvContent);
    } catch (error) {
        console.error('Error writing public CSV copy:', error.message);
    }

    return repoFilePath;
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint for Heroku
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        github_configured: !!GITHUB_TOKEN,
        github_repo: GITHUB_REPO
    });
});

// Get all calendar data
app.get('/api/calendar', (req, res) => {
    try {
        const data = readDataFromCache();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read calendar data' });
    }
});

// Get public calendar data (no phone numbers)
app.get('/api/calendar/public', (req, res) => {
    try {
        const data = readDataFromCache();
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
});

// Add new attendee
app.post('/api/attendee', async (req, res) => {
    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { dateKey, name, phone, mass } = body;
        
        if (!dateKey || !name || !phone || !mass) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const data = readDataFromCache();
        
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
        
        writeDataToCache(data);
        
        // Generate CSV content
        const today = new Date().toISOString().split('T')[0];
        const backendCSV = jsonToCSV(data, true);
        const publicCSV = jsonToCSV(data, false);
        
        // Write to GitHub repository
        const backendFilename = `thanksgiving-calendar-backend-${today}.csv`;
        const publicFilename = `thanksgiving-calendar-public-${today}.csv`;
        
        const backendCommitMessage = `Update backend CSV: ${name} added to ${dateKey}`;
        const publicCommitMessage = `Update public CSV: ${name} added to ${dateKey}`;
        
        // Write both files to GitHub when configured, but do not block the booking flow
        try {
            await writeCSVToGitHub(backendCSV, backendFilename, backendCommitMessage);
            await writeCSVToGitHub(publicCSV, publicFilename, publicCommitMessage);
        } catch (error) {
            console.error('CSV sync failed, but booking was persisted locally:', error.message);
        }
        
        // Also write locally as backup
        writeCSVToFile(data, backendFilename, true);
        writeCSVToFile(data, publicFilename, false);
        
        res.json({ 
            success: true, 
            message: 'Attendee added successfully',
            github_updated: !!GITHUB_TOKEN,
            persisted_locally: true
        });
    } catch (error) {
        console.error('Error adding attendee:', error);
        res.status(500).json({ error: 'Failed to add attendee' });
    }
});

// Get attendees for a specific date
app.get('/api/attendees/:dateKey', (req, res) => {
    try {
        const { dateKey } = req.params;
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        
        const attendees = data[dateKey] || [];
        res.json(attendees);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get attendees' });
    }
});

// Download backend data as JSON
app.get('/api/download/backend', (req, res) => {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="thanksgiving-calendar-backend-${new Date().toISOString().split('T')[0]}.json"`);
        res.send(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to download data' });
    }
});

// Download public data as JSON
app.get('/api/download/public', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const publicData = {};
        
        for (const [dateKey, attendees] of Object.entries(data)) {
            publicData[dateKey] = attendees.map(attendee => ({
                name: attendee.name,
                mass: attendee.mass
            }));
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="thanksgiving-calendar-public-${new Date().toISOString().split('T')[0]}.json"`);
        res.send(JSON.stringify(publicData, null, 2));
    } catch (error) {
        res.status(500).json({ error: 'Failed to download public data' });
    }
});

// Generate and download backend CSV (with phone numbers)
app.get('/api/csv/backend', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const csvContent = jsonToCSV(data, true);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="thanksgiving-calendar-backend-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate CSV' });
    }
});

// Generate and download public CSV (no phone numbers)
app.get('/api/csv/public', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const csvContent = jsonToCSV(data, false);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="thanksgiving-calendar-public-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate CSV' });
    }
});

// Write CSV files to server (backend data with phone numbers)
app.post('/api/csv/write/backend', async (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const today = new Date().toISOString().split('T')[0];
        const filename = `thanksgiving-calendar-backend-${today}.csv`;
        const csvContent = jsonToCSV(data, true);
        
        const success = await writeCSVToGitHub(csvContent, filename, `Manual backend CSV update - ${today}`);
        
        res.json({ 
            success: true, 
            message: 'Backend CSV file written successfully',
            filename: filename,
            github_updated: success
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to write CSV file' });
    }
});

// Write CSV files to server (public data without phone numbers)
app.post('/api/csv/write/public', async (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const today = new Date().toISOString().split('T')[0];
        const filename = `thanksgiving-calendar-public-${today}.csv`;
        const csvContent = jsonToCSV(data, false);
        
        const success = await writeCSVToGitHub(csvContent, filename, `Manual public CSV update - ${today}`);
        
        res.json({ 
            success: true, 
            message: 'Public CSV file written successfully',
            filename: filename,
            github_updated: success
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to write CSV file' });
    }
});

// List all CSV files on server
app.get('/api/csv/files', (req, res) => {
    try {
        const files = fs.readdirSync(__dirname)
            .filter(file => file.endsWith('.csv'))
            .map(file => {
                const stats = fs.statSync(path.join(__dirname, file));
                return {
                    filename: file,
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime
                };
            })
            .sort((a, b) => b.modified - a.modified); // Sort by most recent
        
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: 'Failed to list CSV files' });
    }
});

// Download specific CSV file from server
app.get('/api/csv/download/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(__dirname, filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.sendFile(filePath);
    } catch (error) {
        res.status(500).json({ error: 'Failed to download CSV file' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
    console.log(`🚀 Thanksgiving Calendar Server running on port ${PORT}`);
    console.log(`📊 API Endpoints:`);
    console.log(`   GET  / - Main application`);
    console.log(`   GET  /health - Health check`);
    console.log(`   GET  /api/calendar - Get all data`);
    console.log(`   GET  /api/calendar/public - Get public data (no phones)`);
    console.log(`   POST /api/attendee - Add new attendee`);
    console.log(`   GET  /api/attendees/:dateKey - Get attendees for date`);
    console.log(`   GET  /api/download/backend - Download backend JSON`);
    console.log(`   GET  /api/download/public - Download public JSON`);
    console.log(`   GET  /api/csv/backend - Download backend CSV`);
    console.log(`   GET  /api/csv/public - Download public CSV`);
    console.log(`   POST /api/csv/write/backend - Write backend CSV to server`);
    console.log(`   POST /api/csv/write/public - Write public CSV to server`);
    console.log(`   GET  /api/csv/files - List all CSV files`);
    console.log(`   GET  /api/csv/download/:filename - Download specific CSV file`);
    console.log(`🔧 GitHub Integration: ${GITHUB_TOKEN ? 'Enabled' : 'Disabled'}`);
    if (GITHUB_TOKEN) {
        console.log(`📁 Repository: ${GITHUB_REPO}`);
        console.log(`🌿 Branch: ${GITHUB_BRANCH}`);
    }
}); 
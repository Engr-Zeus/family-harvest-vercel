const fs = require('fs');
const path = require('path');
const https = require('https');

// Data file path - use /tmp for Vercel serverless functions
const DATA_FILE = '/tmp/calendar-data.json';

// GitHub configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'your-username/your-repo-name';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
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
            const { dateKey, name, phone, mass } = req.body;
            
            if (!dateKey || !name || !phone || !mass) {
                return res.status(400).json({ error: 'Missing required fields' });
            }
            
            // Read existing data or initialize empty object
            let data = {};
            try {
                if (fs.existsSync(DATA_FILE)) {
                    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
                }
            } catch (error) {
                console.log('No existing data file, starting fresh');
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
            
            // Write to temporary file
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            
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
            await writeCSVToGitHub(backendCSV, backendFilename, backendCommitMessage);
            await writeCSVToGitHub(publicCSV, publicFilename, publicCommitMessage);
            
            res.json({ 
                success: true, 
                message: 'Attendee added successfully',
                github_updated: !!GITHUB_TOKEN
            });
        } catch (error) {
            console.error('Error adding attendee:', error);
            res.status(500).json({ error: 'Failed to add attendee', details: error.message });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}; 
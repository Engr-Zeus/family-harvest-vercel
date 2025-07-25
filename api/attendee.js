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

// Helper function to read data from GitHub
async function readDataFromGitHub() {
    if (!GITHUB_TOKEN) {
        console.log('GitHub token not configured, using empty data');
        return {};
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
            return JSON.parse(content);
        } else if (response.status === 404) {
            console.log('No existing data file found, starting fresh');
            return {};
        } else {
            console.error('GitHub API error:', response.status, response.data);
            return {};
        }
    } catch (error) {
        console.error('Error reading from GitHub:', error.message);
        return {};
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
            const { dateKey, name, phone, mass } = req.body;
            
            if (!dateKey || !name || !phone || !mass) {
                return res.status(400).json({ error: 'Missing required fields' });
            }
            
            // Read existing data from GitHub
            const data = await readDataFromGitHub();
            
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
            
            // Write updated data back to GitHub
            await writeDataToGitHub(data);
            
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
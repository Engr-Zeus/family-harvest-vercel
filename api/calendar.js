const fs = require('fs');
const path = require('path');

// Data file path
const DATA_FILE = path.join(process.cwd(), 'calendar-data.json');

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
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
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: 'Failed to read calendar data' });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}; 
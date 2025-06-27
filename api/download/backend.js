const fs = require('fs');
const path = require('path');

// Data file path - use /tmp for Vercel serverless functions
const DATA_FILE = '/tmp/calendar-data.json';

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
            let data = {};
            if (fs.existsSync(DATA_FILE)) {
                data = fs.readFileSync(DATA_FILE, 'utf8');
            } else {
                data = JSON.stringify({});
            }
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="thanksgiving-calendar-backend-${new Date().toISOString().split('T')[0]}.json"`);
            res.send(data);
        } catch (error) {
            res.status(500).json({ error: 'Failed to download data' });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}; 
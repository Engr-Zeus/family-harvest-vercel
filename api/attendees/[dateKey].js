const fs = require('fs');
const path = require('path');
const os = require('os');

// Data file path - use a platform-safe temp location with a local fallback
const DATA_FILE = path.join(os.tmpdir(), 'calendar-data.json');
const FALLBACK_DATA_FILE = path.join(__dirname, '..', '..', 'calendar-data.json');

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
            const { dateKey } = req.query;
            let data = {};
            if (fs.existsSync(DATA_FILE)) {
                data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            } else if (fs.existsSync(FALLBACK_DATA_FILE)) {
                data = JSON.parse(fs.readFileSync(FALLBACK_DATA_FILE, 'utf8'));
            }
            
            const attendees = data[dateKey] || [];
            res.json(attendees);
        } catch (error) {
            res.status(500).json({ error: 'Failed to get attendees' });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}; 
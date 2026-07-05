const fs = require('fs');
const path = require('path');
const os = require('os');

// Data file paths - prefer a shared project-level file so bookings are visible across devices
const PROJECT_DATA_FILE = path.join(process.cwd(), 'calendar-data.json');
const TMP_DATA_FILE = path.join(os.tmpdir(), 'calendar-data.json');
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
            const candidates = [PROJECT_DATA_FILE, FALLBACK_DATA_FILE, TMP_DATA_FILE];
            for (const filePath of candidates) {
                if (fs.existsSync(filePath)) {
                    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    break;
                }
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
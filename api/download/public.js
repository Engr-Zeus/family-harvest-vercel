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
                data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            }
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
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}; 
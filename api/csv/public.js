const fs = require('fs');
const path = require('path');

// Data file path - use /tmp for Vercel serverless functions
const DATA_FILE = '/tmp/calendar-data.json';

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
                csvRows.push(`"${date}","${attendee.name}","${attendee.phone}","${attendee.mass}"`);
            } else {
                csvRows.push(`"${date}","${attendee.name}","${attendee.mass}"`);
            }
        }
    }
    
    return csvRows.join('\n');
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
            let data = {};
            if (fs.existsSync(DATA_FILE)) {
                data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            }
            const csvContent = jsonToCSV(data, false);
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="thanksgiving-calendar-public-${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csvContent);
        } catch (error) {
            res.status(500).json({ error: 'Failed to generate CSV' });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}; 
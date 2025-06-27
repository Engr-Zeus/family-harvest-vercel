# 🦃 Family Thanksgiving Calendar

A beautiful, interactive web application for coordinating family Thanksgiving celebrations on Sundays. Users can view available Sundays, see who's already signed up, and add their name, phone number, and mass preference to any date.

## ✨ Features

- **Sunday-only Calendar**: Shows all Sundays from now until December 31st
- **Interactive Calendar**: Click any Sunday to see details and add your name
- **Real-time Updates**: See how many people are attending each date
- **Simple Form**: Enter name, phone number, and mass preference
- **Privacy-Focused**: Phone numbers collected but not displayed publicly
- **Beautiful UI**: Modern, responsive design with Thanksgiving theme
- **Backend Ready**: Full Node.js backend with CSV export functionality
- **Mobile Friendly**: Works perfectly on phones and tablets
- **Vercel Ready**: Optimized for serverless deployment on Vercel

## 🚀 Quick Start

### Frontend Only (No Backend Required)
1. Clone this repository
2. Open `index.html` in any modern web browser
3. Start adding family members to your preferred Sundays!

### With Backend (Full Features)
1. Install Node.js from [nodejs.org](https://nodejs.org/)
2. Install dependencies: `npm install`
3. Start the server: `npm start`
4. Visit `http://localhost:3000`

### Deploy to Vercel (Recommended)
1. Install Vercel CLI: `npm install -g vercel`
2. Login to Vercel: `vercel login`
3. Deploy: `vercel --prod`
4. Set environment variables in Vercel dashboard
5. See [VERCEL-DEPLOYMENT.md](VERCEL-DEPLOYMENT.md) for detailed instructions

## 📱 How to Use

1. **View Available Sundays**: The calendar shows all Sundays from today until December
2. **Click a Date**: Click on any Sunday to see who's already signed up
3. **Add Your Name**: Fill out the form with your name, phone number, and mass preference
4. **Submit**: Your information will be added to that date for others to see

## 🛠️ Technical Details

### Frontend
- **Pure HTML/CSS/JavaScript**: No frameworks required
- **Local Storage**: Data persists between sessions (frontend-only mode)
- **Responsive Design**: Works on all devices
- **Modern UI**: Smooth animations and hover effects

### Backend (Optional)
- **Node.js/Express**: RESTful API server
- **Vercel Serverless**: Optimized for Vercel deployment
- **CSV Export**: Automatic CSV file generation with every form submission
- **Data Persistence**: JSON and CSV files stored on server
- **API Endpoints**: Full CRUD operations for calendar data
- **GitHub Integration**: Automatic CSV uploads to GitHub repository

## 📊 Backend API Endpoints

When using the backend server:

```
GET  /api/health            - Health check
GET  /api/calendar          - Get all data (with phone numbers)
GET  /api/calendar/public   - Get public data (no phone numbers)
POST /api/attendee          - Add new attendee
GET  /api/attendees/:date   - Get attendees for specific date
GET  /api/download/backend  - Download backend JSON
GET  /api/download/public   - Download public JSON
GET  /api/csv/backend       - Download backend CSV
GET  /api/csv/public        - Download public CSV
```

## 🎨 Design Features

- **Thanksgiving Theme**: Warm colors and turkey emoji
- **Modern UI**: Clean, professional design with smooth animations
- **Responsive**: Works on desktop, tablet, and mobile devices
- **Accessible**: Good contrast and readable fonts
- **Interactive**: Hover effects and visual feedback

## 📁 Project Structure

```
Family Thanksgiving/
├── api/                    # Vercel serverless functions
│   ├── calendar.js        # GET /api/calendar
│   ├── calendar/
│   │   └── public.js      # GET /api/calendar/public
│   ├── attendee.js        # POST /api/attendee
│   ├── attendees/
│   │   └── [dateKey].js   # GET /api/attendees/:dateKey
│   ├── health.js          # GET /api/health
│   ├── download/
│   │   ├── backend.js     # GET /api/download/backend
│   │   └── public.js      # GET /api/download/public
│   └── csv/
│       ├── backend.js     # GET /api/csv/backend
│       └── public.js      # GET /api/csv/public
├── index.html              # Main HTML file
├── styles.css              # CSS styles and animations
├── script.js               # Frontend JavaScript
├── server.js               # Backend server (Node.js/Express) - for local development
├── package.json            # Dependencies and scripts
├── vercel.json             # Vercel configuration
├── .gitignore              # Git ignore rules
├── README.md               # This file
├── VERCEL-DEPLOYMENT.md    # Vercel deployment guide
├── GITHUB-SETUP-VERCEL.md  # GitHub integration guide
├── BACKEND-SETUP.md        # Detailed backend setup guide
├── sample-backend-data.json # Example backend data
├── sample-public-data.json # Example public data
├── sample-backend-data.csv # Example backend CSV
└── sample-public-data.csv  # Example public CSV
```

## 🔧 Customization

### Mass Times
Edit the mass options in `script.js`:
```javascript
<option value="6:00 AM">6:00 AM</option>
<option value="8:00 AM">8:00 AM</option>
<option value="10:00 AM">10:00 AM</option>
<option value="6:00 PM">6:00 PM</option>
```

### Colors
Main colors in `styles.css`:
- Primary: `#8B4513` (Saddle Brown)
- Secondary: `#D2691E` (Chocolate)
- Accent: `#CD853F` (Peru)

### Date Range
Modify the `generateSundays()` function in `script.js` to change the date range.

## 🌐 Deployment Options

### Frontend Only
- **GitHub Pages**: Push to GitHub and enable Pages
- **Netlify**: Drag and drop the folder
- **Vercel**: Connect GitHub repository
- **Any Web Host**: Upload HTML, CSS, and JS files

### Full Stack (Frontend + Backend)
- **Vercel** (Recommended): `vercel --prod` - Serverless deployment
- **Railway**: Connect GitHub repository
- **DigitalOcean**: Deploy Node.js app
- **AWS**: Deploy to EC2 or Lambda

## 🔒 Privacy & Security

- **Phone Numbers**: Collected for backend use but not displayed publicly
- **Local Storage**: Data stored locally in browser (frontend-only mode)
- **Server Storage**: Data stored in JSON/CSV files on server (backend mode)
- **No Tracking**: No analytics or external tracking
- **HTTPS Ready**: Configure for production deployment
- **Environment Variables**: Secure storage of API keys and tokens

## 🎯 Perfect For

- Family Thanksgiving coordination
- Church group scheduling
- Community event planning
- Any Sunday-based event coordination

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🆘 Support

For issues or questions:
1. Check the [VERCEL-DEPLOYMENT.md](VERCEL-DEPLOYMENT.md) for Vercel deployment
2. Check the [GITHUB-SETUP-VERCEL.md](GITHUB-SETUP-VERCEL.md) for GitHub integration
3. Check the [BACKEND-SETUP.md](BACKEND-SETUP.md) for detailed setup instructions
4. Review the browser console for errors
5. Ensure all dependencies are installed (for backend)
6. Verify Node.js version 18+ is installed (for backend)

---

**Happy Thanksgiving! 🦃🍁**

*Built with ❤️ for family coordination* 
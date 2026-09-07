const express = require('express');
const cors = require('cors');
const { searchTracks, addTrackToPlaylist } = require('./spotifyService');
require('dotenv').config();

const app = express();

// Crucial: Allows your public Vercel app to hit this local server
app.use(cors());
app.use(express.json());

// In-Memory map to track IPs and prevent spam
const activeCooldowns = new Map();
const COOLDOWN_MINUTES = process.env.RATE_LIMIT_MINUTES || 5;

app.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ error: 'Query is required' });

        const tracks = await searchTracks(query);
        res.json(tracks);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Failed to search tracks' });
    }
});

app.post('/add', async (req, res) => {
    // Get IP (handles requests coming through ngrok/proxies)
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const { uri } = req.body;

    if (!uri) return res.status(400).json({ error: 'Track URI is required' });

    // 1. Check if user is in timeout
    if (activeCooldowns.has(ip)) {
        const timeRemaining = activeCooldowns.get(ip) - Date.now();
        if (timeRemaining > 0) {
            const mins = Math.ceil(timeRemaining / 60000);
            return res.status(429).json({ error: `Slow down! Please wait ${mins} minutes before adding another song.` });
        }
    }

    // 2. Add the track to Spotify
    try {
        const success = await addTrackToPlaylist(uri);

        if (success) {
            // 3. Put user in timeout
            activeCooldowns.set(ip, Date.now() + (COOLDOWN_MINUTES * 60 * 1000));
            res.json({ message: 'Added to queue!' });
        } else {
            res.status(500).json({ error: 'Failed to add track to Spotify' });
        }
    } catch (error) {
        console.error('Add track error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 Mediator Backend running on port ${PORT}`);
    console.log(`Waiting for ngrok tunnel...`);
});
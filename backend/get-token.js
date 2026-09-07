const express = require('express');
const querystring = require('querystring');
require('dotenv').config(); // Make sure your .env has CLIENT_ID and CLIENT_SECRET

const app = express();
const port = process.env.PORT;

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
// Make sure this exact URI is added in your Spotify Developer Dashboard!
const REDIRECT_URI = 'http://127.0.0.1:3000/callback';

app.get('/login', (req, res) => {
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: CLIENT_ID,
            scope: 'playlist-modify-public playlist-modify-private',
            redirect_uri: REDIRECT_URI,
            show_dialog: true
        }));
});

app.get('/callback', async (req, res) => {
    const code = req.query.code || null;

    // Exchange the authorization code for the tokens
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + (Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'))
        },
        body: new URLSearchParams({
            code: code,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code'
        })
    });

    const data = await response.json();

    if (data.refresh_token) {
        console.log('\n\n🎯 SUCCESS! Copy this into your .env file:\n');
        console.log(`SPOTIFY_REFRESH_TOKEN=${data.refresh_token}\n\n`);
        res.send('Success! Check your WSL terminal. You can close this browser tab and kill the server (Ctrl+C).');
    } else {
        res.send('Something went wrong. Check the terminal.');
        console.error('Error fetching token:', data);
    }
});

app.listen(port, () => {
    console.log(`Burner server running! Go to http://localhost:${port}/login`);
});
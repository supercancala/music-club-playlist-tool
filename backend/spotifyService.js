require('dotenv').config();

const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN, TARGET_PLAYLIST_ID } = process.env;

// Automatically grabs a fresh access token using your offline refresh token
async function getAccessToken() {
    const auth = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: process.env.SPOTIFY_REFRESH_TOKEN.trim() // Force-clean any hidden spaces
        })
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("❌ TOKEN EXCHANGE FAILED:", JSON.stringify(data, null, 2));
    } else {
        // 🔍 Let's see what scopes Spotify actually gave this specific access token
        console.log("🔑 Fresh Access Token Generated. Scopes granted by Spotify:", data.scope || "NONE");
    }

    return data.access_token;
}

// Searches Spotify and cleans up the messy JSON response
async function searchTracks(query) {
    const token = await getAccessToken();
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    console.log("Spotify Search Raw Response:", JSON.stringify(data, null, 2));

    // Use optional chaining so it doesn't crash if tracks is undefined
    const items = data.tracks?.items || [];

    return items.map(track => ({
        id: track.id,
        uri: track.uri,
        name: track.name,
        artist: track.artists[0].name,
        image: track.album.images[2]?.url || track.album.images[0]?.url
    }));
}

// Pushes the track to your club playlist
async function addTrackToPlaylist(uri) {
    const token = await getAccessToken();
    const cleanPlaylistId = process.env.TARGET_PLAYLIST_ID.trim();

    // 🕵️ Check who owns the playlist
    const playlistRes = await fetch(`https://api.spotify.com/v1/playlists/${cleanPlaylistId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const playlistData = await playlistRes.json();
    console.log("📂 Playlist Owner ID:", playlistData.owner?.id);

    // Check who the token belongs to
    const meRes = await fetch('https://api.spotify.com/v1/me', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const meData = await meRes.json();
    console.log("👤 Token User ID:", meData.id);


    const response = await fetch(`https://api.spotify.com/v1/playlists/${cleanPlaylistId}/items`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            uris: [uri]
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ SPOTIFY API REJECTED THE REQUEST:", JSON.stringify(errorData, null, 2));
    } else {
        console.log("SUCCESS! Track added to playlist.");
    }

    return response.ok;
}
module.exports = { searchTracks, addTrackToPlaylist };
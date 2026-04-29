// ═══════════════════════════════════════════════════════
// EURO54 - Express Server (Render compatible)
// ═══════════════════════════════════════════════════════
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Static files (images, css, js, etc.) ───
app.use(express.static(publicDir));

// ─── Page Rewrites (same as vercel.json) ───
// These routes serve HTML pages from /public
app.get('/predictions', (req, res) => {
    res.sendFile(path.join(publicDir, 'predictions.html'));
});
app.get('/access', (req, res) => {
    res.sendFile(path.join(publicDir, 'access.html'));
});
app.get('/admin', (req, res) => {
    res.sendFile(path.join(publicDir, 'admin.html'));
});

// ─── Game Pages ───
app.get('/lucky', (req, res) => {
    res.sendFile(path.join(publicDir, 'lucky.html'));
});
app.get('/aviator', (req, res) => {
    res.sendFile(path.join(publicDir, 'aviator.html'));
});
app.get('/gmine', (req, res) => {
    res.sendFile(path.join(publicDir, 'gmine.html'));
});
app.get('/speed', (req, res) => {
    res.sendFile(path.join(publicDir, 'speed.html'));
});

// ─── API Routes ───
const webhook = require('./api/webhook');
const admin = require('./api/admin');
const adminActions = require('./api/admin-actions');
const claim = require('./api/claim');
const postbackRegister = require('./api/postback-register');
const postbackDeposit = require('./api/postback-deposit');
const verify1win = require('./api/verify-1win');

app.all('/api/webhook', (req, res) => webhook(req, res));
app.all('/api/admin', (req, res) => admin(req, res));
app.all('/api/admin-actions', (req, res) => adminActions(req, res));
app.all('/api/claim', (req, res) => claim(req, res));
app.all('/api/postback-register', (req, res) => postbackRegister(req, res));
app.all('/api/postback-deposit', (req, res) => postbackDeposit(req, res));
app.all('/api/verify-1win', (req, res) => verify1win(req, res));

// ─── Fallback: serve index.html for any unmatched route ───
app.get('*', (req, res) => {
    const filePath = path.join(publicDir, req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Not Found');
    }
});

// ─── Start server ───
app.listen(PORT, () => {
    console.log(`EURO54 Bot running on port ${PORT}`);
});

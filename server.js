// ═══════════════════════════════════════════════════════
// EURO54 - Express Server (Render compatible)
// ═══════════════════════════════════════════════════════
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Static files ───
app.use(express.static(path.join(__dirname, 'public')));

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

// ─── Start server ───
app.listen(PORT, () => {
    console.log(`EURO54 Bot running on port ${PORT}`);
});

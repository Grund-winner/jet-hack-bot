// ═══════════════════════════════════════════════════════
// JET HACK BOT - Express Server (Render compatible)
// ═══════════════════════════════════════════════════════
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || '';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Static files (images) ───
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ───
const webhook = require('./api/webhook');
const postbackRegister = require('./api/postback-register');
const postbackDeposit = require('./api/postback-deposit');

app.all('/api/webhook', (req, res) => webhook(req, res));
app.all('/api/postback-register', (req, res) => postbackRegister(req, res));
app.all('/api/postback-deposit', (req, res) => postbackDeposit(req, res));

// ─── Health check ───
app.get('/', (req, res) => res.status(200).send('JET HACK Bot is running!'));

// ─── Start server & set webhook ───
app.listen(PORT, async () => {
    console.log(`JET HACK Bot running on port ${PORT}`);
    // Auto-set Telegram webhook on startup
    if (BOT_TOKEN) {
        const baseUrl = process.env.BASE_URL || `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`;
        if (baseUrl && baseUrl.includes('https://')) {
            const webhookUrl = `${baseUrl}/api/webhook`;
            console.log(`Setting webhook: ${webhookUrl}`);
            try {
                const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: webhookUrl,
                        allowed_updates: ['message', 'callback_query']
                    })
                });
                const data = await res.json();
                console.log('Webhook set:', data.ok ? 'SUCCESS' : 'FAILED', data.description || '');
            } catch (e) {
                console.error('Failed to set webhook:', e.message);
            }
        }
    }
});

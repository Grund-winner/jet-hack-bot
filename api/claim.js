// ═══════════════════════════════════════════════════════
// EURO54 - Claim (Telegram one-time links)
// Vérifie le HMAC → check deposit >= 8.5$ → redirect HTML
// Route : GET /api/claim?token=XXX
// Utilise un redirect HTML/JS au lieu de HTTP 307 pour
// une meilleure compatibilité avec le WebView Telegram
// ═══════════════════════════════════════════════════════
const crypto = require('crypto');
const { query } = require('../lib/db');
const LINK_SECRET = process.env.ADMIN_PASSWORD || 'euro54secret';
const MIN_DEPOSIT = parseFloat(process.env.MIN_DEPOSIT) || 8.5;

// Redirect via HTML + JS (compatible Telegram WebView)
function htmlRedirect(url) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:,">
<script>window.location.replace("${url}");</script>
<meta http-equiv="refresh" content="0;url=${url}">
</head><body><p>Redirection...</p><script>window.location.replace("${url}");</script></body></html>`;
}

module.exports = async function handler(req, res) {
    try {
        const token = req.query.token;
        if (!token) {
            res.setHeader('Content-Type', 'text/html');
            return res.status(200).send(htmlRedirect('/access'));
        }

        // Decode base64url token
        let decoded;
        try {
            decoded = Buffer.from(token, 'base64url').toString('utf8');
        } catch (e) {
            res.setHeader('Content-Type', 'text/html');
            return res.status(200).send(htmlRedirect('/access'));
        }

        const parts = decoded.split(':');
        if (parts.length !== 3) {
            res.setHeader('Content-Type', 'text/html');
            return res.status(200).send(htmlRedirect('/access'));
        }

        const [telegramId, expiresAt, sig] = parts;

        // Verify HMAC signature
        const expectedSig = crypto.createHmac('sha256', LINK_SECRET)
            .update(`${telegramId}:${expiresAt}`)
            .digest('hex').substring(0, 12);

        if (sig !== expectedSig) {
            console.error('[CLAIM] HMAC mismatch for user', telegramId);
            res.setHeader('Content-Type', 'text/html');
            return res.status(200).send(htmlRedirect('/access'));
        }

        // Verify expiry (10 minutes for one-time link)
        if (parseInt(expiresAt) < Date.now()) {
            console.error('[CLAIM] Token expired for user', telegramId);
            res.setHeader('Content-Type', 'text/html');
            return res.status(200).send(htmlRedirect('/access'));
        }

        // Find user by telegram_id
        const users = await query('SELECT * FROM users WHERE telegram_id = $1', [parseInt(telegramId)]);
        if (users.length === 0) {
            console.error('[CLAIM] User not found:', telegramId);
            res.setHeader('Content-Type', 'text/html');
            return res.status(200).send(htmlRedirect('/access'));
        }

        const user = users[0];

        // Check total deposits (deposit_amount is cumulative)
        const totalDep = parseFloat(user.deposit_amount) || 0;

        if (totalDep < MIN_DEPOSIT) {
            console.log('[CLAIM] Deposit insufficient for user', telegramId, ':', totalDep, '<', MIN_DEPOSIT);
            res.setHeader('Content-Type', 'text/html');
            return res.status(200).send(htmlRedirect('/access?msg=deposit&amount=' + totalDep.toFixed(2)));
        }

        // All good → redirect to predictions with auth flag
        console.log('[CLAIM] Access granted for user', telegramId);
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(htmlRedirect('/predictions?auth=ok'));
    } catch (error) {
        console.error('[CLAIM ERROR]', error);
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(htmlRedirect('/access'));
    }
};

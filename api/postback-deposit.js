// ═══════════════════════════════════════════════════════
// EURO54 - Postback Deposit
// 1Win appelle cette URL quand un utilisateur fait un dépôt
// Route : GET /api/postback-deposit
// ═══════════════════════════════════════════════════════
const { query } = require('../lib/db');
const MIN_DEPOSIT = parseFloat(process.env.MIN_DEPOSIT) || 8.5;

module.exports = async function handler(req, res) {
    try {
        const clickid = req.query.clickid || null;
        const userId1win = req.query.user_id;
        const amount = parseFloat(req.query.amount) || 0;
        const transactionId = req.query.transactionid;

        if (!userId1win) return res.status(400).send('Missing user_id');
        console.log(`[POSTBACK DEP] clickid=${clickid}, user_id=${userId1win}, amount=${amount}, txn=${transactionId}`);

        if (clickid) {
            // Utilisateur Telegram (sub1 présent)
            const existing = await query('SELECT * FROM users WHERE telegram_id = $1', [clickid]);
            if (existing.length > 0) {
                const user = existing[0];
                const total = parseFloat(user.deposit_amount || 0) + amount;
                const ok = total >= MIN_DEPOSIT;
                await query(
                    'UPDATE users SET is_deposited = $1, deposit_amount = $2, one_win_user_id = $3, is_registered = TRUE, deposited_at = CASE WHEN $1 THEN NOW() ELSE deposited_at END, updated_at = NOW() WHERE telegram_id = $4',
                    [ok, total, userId1win, clickid]
                );
            } else {
                const ok = amount >= MIN_DEPOSIT;
                await query(
                    'INSERT INTO users (telegram_id, one_win_user_id, is_registered, is_deposited, deposit_amount, deposited_at, created_at, updated_at) VALUES ($1, $2, TRUE, $3, $4, CASE WHEN $3 THEN NOW() ELSE NULL END, NOW(), NOW())',
                    [clickid, userId1win, ok, amount]
                );
            }
        } else {
            // Utilisateur WhatsApp → on identifie par 1Win user_id
            const existing = await query('SELECT * FROM users WHERE one_win_user_id = $1', [userId1win]);
            if (existing.length > 0) {
                const user = existing[0];
                const total = parseFloat(user.deposit_amount || 0) + amount;
                const ok = total >= MIN_DEPOSIT;
                await query(
                    'UPDATE users SET is_deposited = $1, deposit_amount = $2, is_registered = TRUE, deposited_at = CASE WHEN $1 THEN NOW() ELSE deposited_at END, updated_at = NOW() WHERE one_win_user_id = $3',
                    [ok, total, userId1win]
                );
            } else {
                const ok = amount >= MIN_DEPOSIT;
                await query(
                    'INSERT INTO users (one_win_user_id, is_registered, is_deposited, deposit_amount, deposited_at, created_at, updated_at) VALUES ($1, TRUE, $2, $3, CASE WHEN $2 THEN NOW() ELSE NULL END, NOW(), NOW())',
                    [userId1win, ok, amount]
                );
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('[POSTBACK DEP ERROR]', error);
        res.status(500).send('Error');
    }
};

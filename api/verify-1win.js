// ═══════════════════════════════════════════════════════
// EURO54 - Verify 1Win ID (WhatsApp / External access)
// Route : POST /api/verify-1win
// Simple system: checks deposit_amount >= MIN_DEPOSIT
// No tokens, no sessions — just verify on each page load
// ═══════════════════════════════════════════════════════
const { query } = require('../lib/db');
const MIN_DEPOSIT = parseFloat(process.env.MIN_DEPOSIT) || 8.5;

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { one_win_id } = req.body || {};
        if (!one_win_id || !one_win_id.toString().trim()) {
            return res.status(400).json({ success: false, message: 'Identifiant 1Win requis.' });
        }

        const winId = one_win_id.toString().trim();

        // Find user by one_win_user_id
        const users = await query('SELECT * FROM users WHERE one_win_user_id = $1', [winId]);

        if (users.length === 0) {
            return res.status(200).json({ success: false, message: 'Identifiant non reconnu. Assurez-vous d\'être inscrit avec le code promo EURO54.' });
        }

        const user = users[0];

        if (!user.is_registered) {
            return res.status(200).json({ success: false, message: 'Inscription non encore confirmée. Veuillez patienter quelques minutes puis réessayez.' });
        }

        // Check total deposits (sum of all deposits stored in deposit_amount)
        const totalDep = parseFloat(user.deposit_amount) || 0;

        if (totalDep < MIN_DEPOSIT) {
            const remaining = (MIN_DEPOSIT - totalDep).toFixed(2);
            if (totalDep > 0) {
                return res.status(200).json({
                    success: false,
                    message: 'Dépôt total insuffisant : ' + totalDep.toFixed(2) + '$. Il vous manque ' + remaining + '$ (soit environ ' + Math.ceil(parseFloat(remaining) * 588.24) + ' FCFA) pour atteindre le minimum de ' + MIN_DEPOSIT + '$.'
                });
            }
            return res.status(200).json({
                success: false,
                message: 'Aucun dépôt détecté. Effectuez un dépôt minimum de ' + MIN_DEPOSIT + '$ (5000 FCFA) sur votre compte 1Win.'
            });
        }

        // All good — access granted
        return res.status(200).json({
            success: true,
            message: 'Accès accordé !'
        });

    } catch (error) {
        console.error('[VERIFY 1WIN ERROR]', error);
        return res.status(500).json({ success: false, message: 'Erreur serveur. Réessayez.' });
    }
};

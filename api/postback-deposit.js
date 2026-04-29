// ═══════════════════════════════════════════════════════════════
// JET HACK BOT - Postback Deposit
// 1Win appelle cette URL quand un utilisateur fait un dépôt
// Gère aussi le crédit automatique de signaux (15 à l'inscription, 20 tous les 34$)
// Route : GET /api/postback-deposit
// ═══════════════════════════════════════════════════════════════
const { query } = require('../lib/db');

const MIN_DEPOSIT = parseFloat(process.env.MIN_DEPOSIT) || 8.5;
const FCFA_PER_DOLLAR = 588.24;
const MILESTONE_FCFA = 20000; // Palier en FCFA
const MILESTONE_SIGNALS = 20; // Signaux offerts par palier
const WELCOME_SIGNALS = 15;   // Signaux offerts à la première recharge valide

// Assure que les tables de signaux existent
async function ensureSignalTables() {
    await query(`CREATE TABLE IF NOT EXISTS user_signals (
        telegram_id BIGINT PRIMARY KEY,
        signals INTEGER DEFAULT 0,
        pref_range TEXT DEFAULT '10-20',
        last_signal_time TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await query(`CREATE TABLE IF NOT EXISTS deposit_milestones (
        telegram_id BIGINT,
        milestone_level INTEGER,
        fcfa_threshold NUMERIC,
        rewarded BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (telegram_id, milestone_level)
    )`);
}

async function addSignals(tid, amount) {
    await query('INSERT INTO user_signals (telegram_id, signals, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (telegram_id) DO UPDATE SET signals = user_signals.signals + $2, updated_at = NOW()', [tid, amount]);
}

// Vérifie et crédite les signaux pour les paliers atteints
async function checkAndCreditMilestones(telegramId, totalDepositUSD) {
    // Convertir le dépôt total en FCFA
    const totalFCFA = totalDepositUSD * FCFA_PER_DOLLAR;
    const currentLevel = Math.floor(totalFCFA / MILESTONE_FCFA);

    console.log(`[MILESTONE] telegram=${telegramId}, totalUSD=${totalDepositUSD}, totalFCFA=${totalFCFA.toFixed(0)}, level=${currentLevel}`);

    if (currentLevel < 1) return; // Pas encore atteint le premier palier

    // Vérifier chaque palier de 1 à currentLevel
    for (let level = 1; level <= currentLevel; level++) {
        const fcfaThreshold = level * MILESTONE_FCFA;
        const existing = await query(
            'SELECT rewarded FROM deposit_milestones WHERE telegram_id = $1 AND milestone_level = $2',
            [telegramId, level]
        );

        if (existing.length === 0) {
            // Nouveau palier atteint → créditer
            await query(
                'INSERT INTO deposit_milestones (telegram_id, milestone_level, fcfa_threshold, rewarded, created_at) VALUES ($1, $2, $3, TRUE, NOW())',
                [telegramId, level, fcfaThreshold]
            );
            await addSignals(telegramId, MILESTONE_SIGNALS);
            console.log(`[MILESTONE] Palier ${level} atteint (${fcfaThreshold} FCFA) → +${MILESTONE_SIGNALS} signaux pour ${telegramId}`);

            // Notifier l'utilisateur
            try {
                const BOT_TOKEN = process.env.BOT_TOKEN;
                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: telegramId,
                        text: `🎁 <b>RÉCOMPENSE DE DÉPÔT !</b>\n\nVous avez atteint le palier de <b>${fcfaThreshold} FCFA</b> de dépôts cumulés.\n\n+<b>${MILESTONE_SIGNALS} signaux gratuits</b> ont été crédités sur votre compte !\n\nMerci pour votre fidélité 🚀`,
                        parse_mode: 'HTML'
                    })
                });
            } catch (e) {
                console.error('[MILESTONE] Erreur notification:', e.message);
            }
        }
    }
}

// Vérifie si c'est la première fois que le seuil minimum est atteint → 15 signaux de bienvenue
async function checkWelcomeSignals(telegramId, wasPreviouslyDeposited) {
    if (wasPreviouslyDeposited) return; // Déjà reçu les signaux de bienvenue

    const BOT_TOKEN = process.env.BOT_TOKEN;
    await addSignals(telegramId, WELCOME_SIGNALS);
    console.log(`[WELCOME] +${WELCOME_SIGNALS} signaux pour ${telegramId}`);

    try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: telegramId,
                text: `🎉 <b>Bienvenue sur JET HACK !</b>\n\nVotre premier dépôt a été confirmé.\nVous avez reçu <b>${WELCOME_SIGNALS} signaux gratuits</b> !\n\nCliquez sur /start pour commencer à générer vos signaux 🚀`,
                parse_mode: 'HTML'
            })
        });
    } catch (e) {
        console.error('[WELCOME] Erreur notification:', e.message);
    }
}

module.exports = async function handler(req, res) {
    try {
        await ensureSignalTables();

        const clickid = req.query.clickid || null;
        const userId1win = req.query.user_id;
        const amount = parseFloat(req.query.amount) || 0;
        const transactionId = req.query.transactionid;

        if (!userId1win) return res.status(400).send('Missing user_id');
        console.log(`[POSTBACK DEP] clickid=${clickid}, user_id=${userId1win}, amount=${amount}, txn=${transactionId}`);

        let telegramId = null;

        if (clickid) {
            // Utilisateur Telegram (sub1 présent)
            telegramId = clickid;
            const existing = await query('SELECT * FROM users WHERE telegram_id = $1', [clickid]);
            if (existing.length > 0) {
                const user = existing[0];
                const wasDeposited = user.is_deposited;
                const total = parseFloat(user.deposit_amount || 0) + amount;
                const ok = total >= MIN_DEPOSIT;
                await query(
                    'UPDATE users SET is_deposited = $1, deposit_amount = $2, one_win_user_id = $3, is_registered = TRUE, deposited_at = CASE WHEN $1 THEN NOW() ELSE deposited_at END, updated_at = NOW() WHERE telegram_id = $4',
                    [ok, total, userId1win, clickid]
                );
                // Signaux de bienvenue
                if (ok && !wasDeposited) {
                    await checkWelcomeSignals(clickid, wasDeposited);
                }
                // Vérifier les paliers
                await checkAndCreditMilestones(clickid, total);
            } else {
                const ok = amount >= MIN_DEPOSIT;
                await query(
                    'INSERT INTO users (telegram_id, one_win_user_id, is_registered, is_deposited, deposit_amount, deposited_at, created_at, updated_at) VALUES ($1, $2, TRUE, $3, $4, CASE WHEN $3 THEN NOW() ELSE NULL END, NOW(), NOW())',
                    [clickid, userId1win, ok, amount]
                );
                if (ok) {
                    await checkWelcomeSignals(clickid, false);
                    await checkAndCreditMilestones(clickid, amount);
                }
            }
        } else {
            // Utilisateur WhatsApp → on identifie par 1Win user_id
            const existing = await query('SELECT * FROM users WHERE one_win_user_id = $1', [userId1win]);
            if (existing.length > 0) {
                const user = existing[0];
                const wasDeposited = user.is_deposited;
                telegramId = user.telegram_id;
                const total = parseFloat(user.deposit_amount || 0) + amount;
                const ok = total >= MIN_DEPOSIT;
                await query(
                    'UPDATE users SET is_deposited = $1, deposit_amount = $2, is_registered = TRUE, deposited_at = CASE WHEN $1 THEN NOW() ELSE deposited_at END, updated_at = NOW() WHERE one_win_user_id = $3',
                    [ok, total, userId1win]
                );
                if (telegramId) {
                    if (ok && !wasDeposited) {
                        await checkWelcomeSignals(telegramId, wasDeposited);
                    }
                    await checkAndCreditMilestones(telegramId, total);
                }
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

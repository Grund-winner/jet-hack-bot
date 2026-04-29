// ═══════════════════════════════════════════════════════
// EURO54 - Webhook Telegram Bot
// Route : POST /api/webhook
// ═══════════════════════════════════════════════════════
const crypto = require('crypto');
const { query } = require('../lib/db');

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const REG_LINK = process.env.REG_LINK || '';
// Utilise VERCEL_URL (auto-détection du domaine Vercel) sinon BASE_URL, sinon fallback
const BASE_URL = process.env.BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
const MIN_DEPOSIT = parseFloat(process.env.MIN_DEPOSIT) || 8.5;
const LINK_SECRET = process.env.ADMIN_PASSWORD || 'euro54secret';

const V = Date.now();
const IMG = {
    default: `${BASE_URL}/images/default.png?v=${V}`,
    register: `${BASE_URL}/images/register.png?v=${V}`,
    deposit: `${BASE_URL}/images/deposit.png?v=${V}`,
    instructions: `${BASE_URL}/images/instructions.png?v=${V}`
};

const M = {
    welcome: `<b>Bienvenue sur le meilleur bot de prédictions 1win</b>

Pour accéder à l'ensemble des prédictions et en profiter pleinement :`

    + `\n\n• Créez un nouveau compte 1win avec le code promo <b>EURO54</b>`

    + `\n\n• Après l'inscription, effectuez un rechargement montant minimum de <b>8.5$ (5000 FCFA)</b> et vous aurez accès à toute les prédictions sur tout les jeux`,

    menu: `

Sélectionnez une option ci-dessous :`,

    instructions: `<b>Comment ça marche ?</b>

Nos membres réalisent entre <b>15% et 25%</b> de profit journalier !

<b>1.</b> <b>Inscrivez-vous</b> sur 1Win en utilisant le code promo <b>EURO54</b>
<b>2.</b> <b>Rechargez</b> minimum <b>8.5$ (5000 FCFA)</b> sur votre compte
<b>3.</b> <b>Accédez</b> aux prédictions en direct !`,

    register: `<b>Étape 1 : Inscription</b>

Inscrivez-vous sur 1Win en utilisant le code promo <b>EURO54</b>.

Une fois inscrit, revenez ici et cliquez sur <b>ACCÉDER AUX PRÉDICTIONS</b>.`,

    deposit: `<b>Étape 2 : Rechargement</b>

Votre inscription est <b>confirmée</b>.

Effectuez un <b>dépôt minimum de 8.5$ (5000 FCFA)</b> sur votre compte 1Win.

Revenez ensuite cliquer sur <b>ACCÉDER AUX PRÉDICTIONS</b>.`,

    deposit_small: `<b>Dépôt insuffisant</b>

Un dépôt de <b>{amount}$</b> a été détecté.

Le montant minimum requis est de <b>8.5$ (5000 FCFA)</b>.

Veuillez effectuer un dépôt complémentaire.`,

    not_registered: `<b>Inscription non détectée</b>

Assurez-vous de vous être inscrit en utilisant le code promo <b>EURO54</b>.

Patientez quelques minutes puis réessayez.`,

    access_granted: `<b>Accès VIP accordé !</b>

Votre inscription et votre dépôt ont été confirmés.

Cliquez ci-dessous pour accéder aux prédictions :`,

    already_registered: `<b>Déjà inscrit(e)</b>

Envoyez l'ID de votre compte 1Win pour la vérification.

Assurez-vous d'être inscrit avec le code promo <b>EURO54</b> et que vous avez effectué un rechargement minimum de <b>8.5$ (5000 FCFA)</b>.`,

    already_registered_success: `<b>Compte lié avec succès !</b>

Votre ID 1Win a été associé à votre compte Telegram.`,

    already_registered_already: `Cet ID 1Win est déjà lié à un autre compte Telegram.`,

    already_registered_notfound: `<b>ID non trouvé</b>

Assurez-vous d'être inscrit(e) avec le code promo <b>EURO54</b> via notre lien d'inscription.`
};

async function tgAPI(method, data) {
    try {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await res.json();
    } catch (e) {
        console.error('tgAPI error:', e);
        return { ok: false };
    }
}

async function deleteMsg(chatId, msgId) {
    if (!msgId) return;
    try { await tgAPI('deleteMessage', { chat_id: chatId, message_id: msgId }); } catch (e) {}
}

async function sendPhoto(chatId, userId, img, text, btns, prevMsgId) {
    if (prevMsgId) {
        await deleteMsg(chatId, prevMsgId);
    }
    const res = await tgAPI('sendPhoto', {
        chat_id: chatId, photo: img, caption: text,
        parse_mode: 'HTML', reply_markup: { inline_keyboard: btns }
    });
    if (res.ok) {
        try { await query('UPDATE users SET last_message_id = $1, updated_at = NOW() WHERE telegram_id = $2', [res.result.message_id, userId]); } catch (e) {}
        return res;
    }
    // Fallback : si sendPhoto échoue (image introuvable, etc.), envoyer en texte
    console.error('[sendPhoto] échec, fallback sendMessage:', JSON.stringify(res).substring(0, 200));
    const fb = await tgAPI('sendMessage', {
        chat_id: chatId, text: text,
        parse_mode: 'HTML', reply_markup: { inline_keyboard: btns }
    });
    if (fb.ok) {
        try { await query('UPDATE users SET last_message_id = $1, updated_at = NOW() WHERE telegram_id = $2', [fb.result.message_id, userId]); } catch (e) {}
    }
    return fb;
}

async function getUser(tid) {
    const r = await query('SELECT * FROM users WHERE telegram_id = $1', [tid]);
    return r[0] || null;
}

// Vérifie si le dépôt total est >= MIN_DEPOSIT
function hasValidDeposit(user) {
    return (parseFloat(user.deposit_amount) || 0) >= MIN_DEPOSIT;
}

async function createUser(tid, username, fn, ln) {
    const r = await query(
        'INSERT INTO users (telegram_id, username, first_name, last_name, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *',
        [tid, username, fn, ln]
    );
    return r[0] || null;
}

// Token HMAC (zéro DB) : base64(telegramId:expiry:hmac)
function generateToken(telegramId) {
    const exp = Date.now() + 10 * 60 * 1000;
    const payload = `${telegramId}:${exp}`;
    const sig = crypto.createHmac('sha256', LINK_SECRET).update(payload).digest('hex').substring(0, 12);
    return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function regLink(tid) { return `${REG_LINK}&sub1=${tid}`; }
function depLink(tid) { return `${REG_LINK}&sub1=${tid}`; }

// ─── Sessions (pour la vérification ID 1Win) ───
async function ensureSessionsTable() {
    await query(`CREATE TABLE IF NOT EXISTS bot_sessions (
        bot_type TEXT NOT NULL,
        admin_id BIGINT NOT NULL,
        action TEXT,
        step INTEGER DEFAULT 0,
        temp_data TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (bot_type, admin_id)
    )`);
}
async function setTempState(tid, action) {
    await query(`INSERT INTO bot_sessions (bot_type, admin_id, action, step, temp_data, updated_at) VALUES ('main', $1, $2, 1, '{}', NOW()) ON CONFLICT (bot_type, admin_id) DO UPDATE SET action = $2, step = 1, temp_data = '{}', updated_at = NOW()`, [tid, action]);
}
async function getTempState(tid) {
    const r = await query("SELECT * FROM bot_sessions WHERE bot_type = 'main' AND admin_id = $1", [tid]);
    return r[0] || null;
}
async function clearTempState(tid) {
    await query("DELETE FROM bot_sessions WHERE bot_type = 'main' AND admin_id = $1", [tid]);
}

const BTN_MENU = [
    [{ text: "S'inscrire sur 1Win", callback_data: 'register' }, { text: "Comment ça marche ?", callback_data: 'instructions' }],
    [{ text: "Déjà inscrit(e)", callback_data: 'already_registered' }],
    [{ text: "ACCÉDER AUX PRÉDICTIONS", callback_data: 'predictions' }]
];
const BTN_BACK = [[{ text: "Retour", callback_data: 'back' }]];

// Génère les boutons avec Web App pour les utilisateurs VIP
function vipButtons(userId) {
    const token = generateToken(userId);
    const webAppUrl = `${BASE_URL}/api/claim?token=${token}`;
    return [
        [{ text: "ACCÉDER AUX PRÉDICTIONS", web_app: { url: webAppUrl } }],
        BTN_BACK[0]
    ];
}

// Supprime l'ancien message et envoie un nouveau avec le bouton Web App
async function sendVIPMessage(chatId, userId, currentMsgId) {
    if (currentMsgId) await deleteMsg(chatId, currentMsgId);

    const res = await tgAPI('sendPhoto', {
        chat_id: chatId,
        photo: IMG.default,
        caption: M.access_granted,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: vipButtons(userId) }
    });

    if (res.ok) {
        try {
            await query('UPDATE users SET last_message_id = $1, updated_at = NOW() WHERE telegram_id = $2', [res.result.message_id, userId]);
        } catch (e) {}
    } else {
        // Fallback : si sendPhoto échoue, envoyer un message texte avec bouton web_app
        console.error('[VIP] sendPhoto failed, trying sendMessage fallback:', JSON.stringify(res));
        const fb = await tgAPI('sendMessage', {
            chat_id: chatId,
            text: M.access_granted,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: vipButtons(userId) }
        });
        if (fb.ok) {
            try { await query('UPDATE users SET last_message_id = $1, updated_at = NOW() WHERE telegram_id = $2', [fb.result.message_id, userId]); } catch (e) {}
        }
    }
}

async function handleText(chatId, from, text) {
    try {
    const session = await getTempState(from.id);
    console.log('[handleText] user=' + from.id + ' session=' + JSON.stringify(session) + ' text=' + text);
    if (session && session.action === 'already_registered') {
        const winId = text.trim();
        await clearTempState(from.id);

        // 1. Chercher un utilisateur existant avec cet ID 1Win
        const found = await query('SELECT * FROM users WHERE one_win_user_id = $1', [winId]);
        if (found.length === 0) {
            const user = await getUser(from.id);
            await sendPhoto(chatId, from.id, IMG.default, M.already_registered_notfound, [[{ text: "S'inscrire", url: regLink(from.id) }], BTN_BACK[0]], user?.last_message_id);
            return;
        }

        const targetUser = found[0]; // Ligne qui a l'ID 1Win

        // 2. Si cet ID 1Win est déjà lié à un AUTRE compte Telegram
        if (targetUser.telegram_id && String(targetUser.telegram_id) !== String(from.id)) {
            const user = await getUser(from.id);
            await sendPhoto(chatId, from.id, IMG.default, M.already_registered_already, BTN_BACK, user?.last_message_id);
            return;
        }

        // 3. Fusionner : associer le compte Telegram à la ligne 1Win existante
        const telegramUser = await getUser(from.id);

        if (telegramUser && String(telegramUser.id) !== String(targetUser.id)) {
            // Il existe une ligne Telegram séparée → fusionner
            // D'ABORD supprimer l'ancienne ligne Telegram (sinon contrainte UNIQUE telegram_id)
            await query('DELETE FROM users WHERE id = $1', [telegramUser.id]);
            // PUIS copier les infos Telegram sur la ligne 1Win
            await query(
                `UPDATE users SET telegram_id = $1, username = COALESCE($2, username), first_name = COALESCE($3, first_name), last_name = COALESCE($4, last_name),
                 is_registered = TRUE, updated_at = NOW() WHERE id = $5`,
                [from.id, from.username, from.first_name, from.last_name, targetUser.id]
            );
        } else if (!telegramUser || String(telegramUser.id) === String(targetUser.id)) {
            // Pas de ligne Telegram, ou c'est déjà la même ligne → juste mettre à jour
            await query(
                `UPDATE users SET telegram_id = $1, username = COALESCE($2, username), first_name = COALESCE($3, first_name), last_name = COALESCE($4, last_name),
                 is_registered = TRUE, updated_at = NOW() WHERE id = $5`,
                [from.id, from.username, from.first_name, from.last_name, targetUser.id]
            );
        }

        // 4. Récupérer l'utilisateur fusionné
        const user = await getUser(from.id);
        if (!user) {
            await tgAPI('sendMessage', { chat_id: chatId, text: 'Erreur interne. Réessayez.', parse_mode: 'HTML' });
            return;
        }

        // 5. Répondre selon le statut
        if (user.is_registered && hasValidDeposit(user)) {
            await sendPhoto(chatId, from.id, IMG.default, M.already_registered_success, vipButtons(from.id), user.last_message_id);
        } else if (user.is_registered) {
            const dep = parseFloat(user.deposit_amount) || 0;
            let extraMsg;
            if (dep > 0 && dep < MIN_DEPOSIT) {
                const remaining = (MIN_DEPOSIT - dep).toFixed(2);
                const fcfa = Math.ceil(parseFloat(remaining) * 588.24);
                extraMsg = M.already_registered_success + '\n\n' + M.deposit_small.replace('{amount}', dep) + '\n\nIl vous manque <b>' + remaining + '$ (environ ' + fcfa + ' FCFA)</b>.';
            } else {
                extraMsg = M.already_registered_success + '\n\n' + M.deposit;
            }
            await sendPhoto(chatId, from.id, IMG.deposit, extraMsg, [[{ text: "Effectuer un depot", url: depLink(from.id) }], BTN_BACK[0]], user.last_message_id);
        } else {
            await sendPhoto(chatId, from.id, IMG.register, M.already_registered_success + '\n\n' + M.register, [[{ text: "S'inscrire maintenant", url: regLink(from.id) }], BTN_BACK[0]], user.last_message_id);
        }
    }
    } catch(err) {
        console.error('[handleText ERROR]', err);
        await tgAPI('sendMessage', { chat_id: chatId, text: 'Erreur, veuillez reessayer.', parse_mode: 'HTML' }).catch(function(){});
    }
}

async function handleUpdate(update) {
    try {
        await ensureSessionsTable();
        if (update.message && update.message.text === '/start') {
            const chatId = update.message.chat.id;
            const from = update.message.from;
            let user = await getUser(from.id);
            if (!user) user = await createUser(from.id, from.username, from.first_name, from.last_name);
            if (user.is_registered && hasValidDeposit(user)) {
                await sendVIPMessage(chatId, from.id, user.last_message_id);
            } else {
                await sendPhoto(chatId, from.id, IMG.default, M.welcome + '\n' + M.menu, BTN_MENU, user.last_message_id);
            }
            return;
        }
        if (update.message && update.message.text && update.message.text !== '/start') {
            return await handleText(update.message.chat.id, update.message.from, update.message.text);
        }

        if (update.callback_query) {
            const q = update.callback_query;
            const chatId = q.message.chat.id;
            const userId = q.from.id;
            const data = q.data;
            const msgId = q.message.message_id;

            let user = await getUser(userId);
            if (!user) user = await createUser(userId, q.from.username, q.from.first_name, q.from.last_name);

            // ─── ACCÉDER AUX PRÉDICTIONS (depuis le menu) ───
            if (data === 'predictions') {
                if (!user.is_registered) {
                    await tgAPI('answerCallbackQuery', { callback_query_id: q.id, text: "Inscrivez-vous d'abord.", show_alert: true });
                } else if (!hasValidDeposit(user)) {
                    // Dépôt insuffisant → message clair avec montant restant
                    const dep = parseFloat(user.deposit_amount) || 0;
                    let msg;
                    if (dep > 0 && dep < MIN_DEPOSIT) {
                        const remaining = (MIN_DEPOSIT - dep).toFixed(2);
                        const fcfa = Math.ceil(parseFloat(remaining) * 588.24);
                        msg = '<b>Dépôt insuffisant</b>\n\n'
                            + 'Votre dépôt total : <b>' + dep.toFixed(2) + '$</b>\n'
                            + 'Montant requis : <b>' + MIN_DEPOSIT + '$ (5000 FCFA)</b>\n\n'
                            + 'Il vous manque <b>' + remaining + '$ (environ ' + fcfa + ' FCFA)</b>.\n\n'
                            + 'Veuillez compléter votre dépôt pour accéder aux prédictions.';
                    } else {
                        msg = '<b>Dépôt requis</b>\n\n'
                            + 'Aucun dépôt détecté sur votre compte.\n\n'
                            + 'Effectuez un dépôt minimum de <b>8.5$ (5000 FCFA)</b> pour accéder aux prédictions.';
                    }
                    await tgAPI('answerCallbackQuery', { callback_query_id: q.id });
                    await sendPhoto(chatId, userId, IMG.deposit, msg, [[{ text: 'Effectuer un dépôt', url: depLink(userId) }], BTN_BACK[0]], msgId);
                } else {
                    await tgAPI('answerCallbackQuery', { callback_query_id: q.id });
                    await sendVIPMessage(chatId, userId, msgId);
                }
                return;
            }

            // ─── go_predictions (ancien flux, garde pour compatibilité) ───
            if (data === 'go_predictions') {
                await tgAPI('answerCallbackQuery', { callback_query_id: q.id });
                if (!user.is_registered || !hasValidDeposit(user)) {
                    await tgAPI('sendMessage', { chat_id: chatId, text: 'Accès non autorisé.', parse_mode: 'HTML' });
                    return;
                }
                await sendVIPMessage(chatId, userId, msgId);
                return;
            }

            // ─── INSCRIPTION ───
            if (data === 'register') {
                await tgAPI('answerCallbackQuery', { callback_query_id: q.id });
                await sendPhoto(chatId, userId, IMG.register, M.register, [[{ text: "S'inscrire maintenant", url: regLink(userId) }], BTN_BACK[0]], msgId);
                return;
            }

            // ─── INSTRUCTIONS ───
            if (data === 'instructions') {
                await tgAPI('answerCallbackQuery', { callback_query_id: q.id });
                await sendPhoto(chatId, userId, IMG.instructions, M.instructions, BTN_BACK, msgId);
                return;
            }

            // ─── DÉJÀ INSCRIT(E) ───
            if (data === 'already_registered') {
                await tgAPI('answerCallbackQuery', { callback_query_id: q.id });
                await setTempState(userId, 'already_registered');
                await sendPhoto(chatId, userId, IMG.default, M.already_registered, BTN_BACK, msgId);
                return;
            }

            // ─── RETOUR ───
            if (data === 'back') {
                await tgAPI('answerCallbackQuery', { callback_query_id: q.id });
                await clearTempState(userId);
                if (user.is_registered && hasValidDeposit(user)) {
                    await sendVIPMessage(chatId, userId, msgId);
                } else {
                    await sendPhoto(chatId, userId, IMG.default, M.welcome + '\n' + M.menu, BTN_MENU, msgId);
                }
                return;
            }

            await tgAPI('answerCallbackQuery', { callback_query_id: q.id });
        }
    } catch (error) {
        console.error('handleUpdate error:', error);
    }
}

module.exports = async function handler(req, res) {
    if (req.method === 'GET') return res.status(200).send('EURO54 Bot est en ligne !');
    if (req.method === 'POST') {
        try {
            const text = req.body?.message?.text || 'no text';
            const chatId = req.body?.message?.chat?.id || 'no chat';
            await handleUpdate(req.body);
            return res.status(200).send('OK');
        }
        catch (e) { console.error('Webhook error:', e); return res.status(500).send('Error'); }
    }
    res.status(405).send('Method not allowed');
};

// ═══════════════════════════════════════════════════════════════
// JET HACK BOT - Webhook Telegram Bot
// Menu Lucky Jet + Signaux gérés en base de données
// Route : POST /api/webhook
// ═══════════════════════════════════════════════════════════════
const { query } = require('../lib/db');

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const REG_LINK = process.env.REG_LINK || '';
const BASE_URL = process.env.BASE_URL || '';
const MIN_DEPOSIT = parseFloat(process.env.MIN_DEPOSIT) || 8.5;
const LINK_SECRET = process.env.ADMIN_PASSWORD || 'euro54secret';

// ─── Vidéos hébergées sur le serveur ───
const VIDEO_MENU = `${BASE_URL}/videos/menu.MP4`;
const VIDEO_SIGNAL = `${BASE_URL}/videos/signaux.MP4`;

const V = Date.now();
const IMG = {
    default: `${BASE_URL}/images/default.png?v=${V}`,
    register: `${BASE_URL}/images/register.png?v=${V}`,
    deposit: `${BASE_URL}/images/deposit.png?v=${V}`,
    instructions: `${BASE_URL}/images/instructions.png?v=${V}`
};

// ─── Messages ───
const M = {
    welcome: `<b>Bienvenue sur JET HACK 🚀</b>\n\nLe bot de signaux Lucky Jet le plus performant.\n\nPour accéder aux signaux :`,
    menu: `\n\n<b>Conditions :</b>\n• Inscrivez-vous avec le code promo <b>EURO54</b>\n• Rechargez minimum <b>8.5$ (5000 FCFA)</b>\n• Recevez <b>15 signaux gratuits</b> !\n\n<b>🎁 Bonus :</b> Chaque 34$ cumulés en dépôts = 20 signaux gratuits supplémentaires.`,
    instructions: `<b>Comment ça marche ?</b>\n\n<b>1.</b> <b>Inscrivez-vous</b> sur 1Win avec le code promo <b>EURO54</b>\n<b>2.</b> <b>Rechargez</b> minimum <b>8.5$ (5000 FCFA)</b>\n<b>3.</b> Recevez vos <b>15 signaux gratuits</b>\n<b>4.</b> Générez des signaux et jouez !\n\n<b>💰 Récompense automatique :</b> À chaque 34$ cumulés en dépôts, vous recevez 20 signaux gratuits !`,
    register: `<b>Étape 1 : Inscription</b>\n\nInscrivez-vous sur 1Win avec le code promo <b>EURO54</b>.\n\nRevenez ici après l'inscription.`,
    deposit: `<b>Étape 2 : Rechargement</b>\n\nVotre inscription est <b>confirmée</b>.\n\nEffectuez un dépôt minimum de <b>8.5$ (5000 FCFA)</b> pour recevoir vos 15 signaux gratuits.`,
    deposit_small: `<b>Dépôt insuffisant</b>\n\nDépôt détecté : <b>{amount}$</b>\nMontant requis : <b>8.5$ (5000 FCFA)</b>.\n\nVeuillez effectuer un dépôt complémentaire.`,
    not_registered: `<b>Inscription non détectée</b>\n\nAssurez-vous d'être inscrit avec le code promo <b>EURO54</b>.`,
    already_registered: `<b>Déjà inscrit(e)</b>\n\nEnvoyez l'ID de votre compte 1Win pour vérification.`,
    already_registered_success: `<b>Compte lié avec succès !</b>\n\nVotre ID 1Win a été associé à votre compte Telegram.`,
    already_registered_notfound: `<b>ID non trouvé</b>\n\nAssurez-vous d'être inscrit avec le code promo <b>EURO54</b>.`,
    access_granted: `<b>Accès aux Signaux accordé !</b> 🎉\n\nVotre dépôt a été confirmé.\nVous avez reçu vos <b>15 signaux gratuits</b> !\n\nCliquez ci-dessous pour générer vos signaux :`
};

// ─── Telegram API ───
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
    if (prevMsgId) await deleteMsg(chatId, prevMsgId);
    const res = await tgAPI('sendPhoto', {
        chat_id: chatId, photo: img, caption: text,
        parse_mode: 'HTML', reply_markup: { inline_keyboard: btns }
    });
    if (res.ok) {
        try { await query('UPDATE users SET last_message_id = $1, updated_at = NOW() WHERE telegram_id = $2', [res.result.message_id, userId]); } catch (e) {}
        return res;
    }
    const fb = await tgAPI('sendMessage', {
        chat_id: chatId, text: text,
        parse_mode: 'HTML', reply_markup: { inline_keyboard: btns }
    });
    if (fb.ok) {
        try { await query('UPDATE users SET last_message_id = $1, updated_at = NOW() WHERE telegram_id = $2', [fb.result.message_id, userId]); } catch (e) {}
    }
    return fb;
}

// ─── Envoyer une vidéo hébergée (avec caption + boutons) ───
async function sendVideo(chatId, userId, videoUrl, caption, btns, prevMsgId) {
    if (prevMsgId) await deleteMsg(chatId, prevMsgId);
    const res = await tgAPI('sendVideo', {
        chat_id: chatId, video: videoUrl,
        caption: caption, parse_mode: 'HTML',
        reply_markup: btns ? { inline_keyboard: btns } : undefined
    });
    if (res.ok) {
        try { await query('UPDATE users SET last_message_id = $1, updated_at = NOW() WHERE telegram_id = $2', [res.result.message_id, userId]); } catch (e) {}
        return res;
    }
    // Fallback: envoyer en texte si la vidéo échoue
    console.error('sendVideo failed, falling back to sendMessage:', JSON.stringify(res));
    const fb = await tgAPI('sendMessage', {
        chat_id: chatId, text: caption,
        parse_mode: 'HTML', reply_markup: btns ? { inline_keyboard: btns } : undefined
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

function hasValidDeposit(user) {
    return (parseFloat(user.deposit_amount) || 0) >= MIN_DEPOSIT;
}

async function createUser(tid, username, fn, ln) {
    const r = await query(
        'INSERT INTO users (telegram_id, username, first_name, last_name, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) ON CONFLICT (telegram_id) DO UPDATE SET updated_at = NOW() RETURNING *',
        [tid, username, fn, ln]
    );
    return r[0] || null;
}

function regLink(tid) { return `${REG_LINK}&sub1=${tid}`; }

// ─── Signaux DB ───
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

async function getSignals(tid) {
    const r = await query('SELECT signals, pref_range FROM user_signals WHERE telegram_id = $1', [tid]);
    if (r.length === 0) return { signals: 0, range: null };
    return { signals: parseInt(r[0].signals) || 0, range: r[0].pref_range };
}

async function addSignals(tid, amount) {
    await query('INSERT INTO user_signals (telegram_id, signals, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (telegram_id) DO UPDATE SET signals = user_signals.signals + $2, updated_at = NOW()', [tid, amount]);
}

async function removeSignals(tid, amount) {
    await query('UPDATE user_signals SET signals = GREATEST(0, signals - $1), updated_at = NOW() WHERE telegram_id = $2', [amount, tid]);
}

async function setPrefRange(tid, range) {
    await query('INSERT INTO user_signals (telegram_id, pref_range, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (telegram_id) DO UPDATE SET pref_range = $2, updated_at = NOW()', [tid, range]);
}

async function getLastSignalTime(tid) {
    const r = await query('SELECT last_signal_time FROM user_signals WHERE telegram_id = $1', [tid]);
    return r.length > 0 ? r[0].last_signal_time : null;
}

async function setLastSignalTime(tid) {
    await query('UPDATE user_signals SET last_signal_time = NOW(), updated_at = NOW() WHERE telegram_id = $1', [tid]);
}

// ─── Sessions ───
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
    await query(`INSERT INTO bot_sessions (bot_type, admin_id, action, step, temp_data, updated_at) VALUES ('jethack', $1, $2, 1, '{}', NOW()) ON CONFLICT (bot_type, admin_id) DO UPDATE SET action = $2, step = 1, temp_data = '{}', updated_at = NOW()`, [tid, action]);
}
async function getTempState(tid) {
    const r = await query("SELECT * FROM bot_sessions WHERE bot_type = 'jethack' AND admin_id = $1", [tid]);
    return r[0] || null;
}
async function clearTempState(tid) {
    await query("DELETE FROM bot_sessions WHERE bot_type = 'jethack' AND admin_id = $1", [tid]);
}

// ─── Signal Generator ───
function generateSignal(range = null) {
    let minCote = 10.0, maxCote = 20.0, duration = 1;

    if (range === "10-20") { minCote = 10.0; maxCote = 20.0; duration = 1; }
    else if (range === "20-50") { minCote = 20.0; maxCote = 50.0; duration = 1; }
    else if (range === "50-100") { minCote = 50.0; maxCote = 100.0; duration = 2; }
    else if (range === "100-200") { minCote = 100.0; maxCote = 200.0; duration = 3; }

    let mult1 = (Math.random() * (maxCote - minCote) + minCote);
    let mult2 = mult1 + 3 + (Math.random() * 5);
    let assure = mult1 / 2;

    let d = new Date();
    let utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    let now = new Date(utc);

    let startTime = new Date(now.getTime() + 120000);
    let endTime = new Date(startTime.getTime() + (duration * 60000));

    let hStart = ("0" + startTime.getHours()).slice(-2);
    let mStart = ("0" + startTime.getMinutes()).slice(-2);
    let hEnd = ("0" + endTime.getHours()).slice(-2);
    let mEnd = ("0" + endTime.getMinutes()).slice(-2);

    let txt = `SIGNAL JET HACK 🧨☠️\n\n`;
    txt += `➤ Heure : ${hStart}:${mStart} - ${hEnd}:${mEnd}\n`;
    txt += `➤ Cotes : ${mult1.toFixed(2)}X - ${mult2.toFixed(2)}X\n`;
    txt += `➤ Assurance : ${assure.toFixed(2)}X`;

    return txt;
}

// ─── Button Layouts ───
const BTN_MENU = [
    [{ text: "S'inscrire sur 1Win", callback_data: 'register' }, { text: "Comment ça marche ?", callback_data: 'instructions' }],
    [{ text: "Déjà inscrit(e)", callback_data: 'already_registered' }],
    [{ text: "JOUER AUX SIGNAUX 🚀", callback_data: 'play_signals' }]
];
const BTN_BACK = [[{ text: "Retour", callback_data: 'back' }]];

function signalMenuBtns(signalsCount) {
    return [
        [{ text: "Aide ✉️", url: "https://t.me/GOD_CASINO54" }, { text: "Infos ❗", callback_data: 'usr_infos' }],
        [{ text: "Option ⚙️", callback_data: 'usr_options' }, { text: "MENU PRINCIPAL 🏠", callback_data: 'nav_home' }],
        [{ text: `Signal suivant 🚀 (${signalsCount} restants)`, callback_data: 'req_signal' }]
    ];
}

// ─── Lucky Jet Menu (avec vidéo du canal) ───
async function renderLuckyJetMenu(chatId, userId, prevMsgId) {
    const sigData = await getSignals(userId);
    const sigCount = sigData.signals;
    const range = sigData.range;

    let rangeLabel = range || '10-20';
    let txt = `---+++ ‼️ LUCKY JET ‼️ +++---\n\n`;
    txt += `➤ Nom : ${userId}\n`;
    txt += `➤ Signaux : ${sigCount}\n`;
    txt += `➤ Tranche : ${rangeLabel}X\n`;
    txt += `➤ ID : ${userId}`;

    await sendVideo(chatId, userId, VIDEO_MENU, txt, signalMenuBtns(sigCount), prevMsgId);
}

// ─── Text Handler ───
async function handleText(chatId, from, text) {
    try {
        const session = await getTempState(from.id);
        console.log('[handleText] user=' + from.id + ' session=' + JSON.stringify(session) + ' text=' + text);

        if (session && session.action === 'already_registered') {
            const winId = text.trim();
            await clearTempState(from.id);

            const found = await query('SELECT * FROM users WHERE one_win_user_id = $1', [winId]);
            if (found.length === 0) {
                const user = await getUser(from.id);
                await sendPhoto(chatId, from.id, IMG.default, M.already_registered_notfound, [[{ text: "S'inscrire", url: regLink(from.id) }], BTN_BACK[0]], user?.last_message_id);
                return;
            }

            const targetUser = found[0];

            if (targetUser.telegram_id && String(targetUser.telegram_id) !== String(from.id)) {
                const user = await getUser(from.id);
                await sendPhoto(chatId, from.id, IMG.default, 'Cet ID 1Win est déjà lié à un autre compte Telegram.', BTN_BACK, user?.last_message_id);
                return;
            }

            const telegramUser = await getUser(from.id);
            if (telegramUser && String(telegramUser.id) !== String(targetUser.id)) {
                await query('DELETE FROM users WHERE id = $1', [telegramUser.id]);
                await query(
                    `UPDATE users SET telegram_id = $1, username = COALESCE($2, username), first_name = COALESCE($3, first_name), last_name = COALESCE($4, last_name),
                     is_registered = TRUE, updated_at = NOW() WHERE id = $5`,
                    [from.id, from.username, from.first_name, from.last_name, targetUser.id]
                );
            } else if (!telegramUser || String(telegramUser.id) === String(targetUser.id)) {
                await query(
                    `UPDATE users SET telegram_id = $1, username = COALESCE($2, username), first_name = COALESCE($3, first_name), last_name = COALESCE($4, last_name),
                     is_registered = TRUE, updated_at = NOW() WHERE id = $5`,
                    [from.id, from.username, from.first_name, from.last_name, targetUser.id]
                );
            }

            const user = await getUser(from.id);
            if (!user) {
                await tgAPI('sendMessage', { chat_id: chatId, text: 'Erreur interne.', parse_mode: 'HTML' });
                return;
            }

            if (user.is_registered && hasValidDeposit(user)) {
                // Check if signals already credited
                const sigData = await getSignals(from.id);
                if (sigData.signals === 0) {
                    await addSignals(from.id, 15);
                    await tgAPI('sendMessage', {
                        chat_id: chatId,
                        text: `🎉 <b>Félicitations !</b>\n\nVotre compte a été vérifié.\nVous avez reçu <b>15 signaux gratuits</b> !`,
                        parse_mode: 'HTML'
                    });
                }
                await renderLuckyJetMenu(chatId, from.id, user.last_message_id);
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
                await sendPhoto(chatId, from.id, IMG.deposit, extraMsg, [[{ text: "Effectuer un depot", url: regLink(from.id) }], BTN_BACK[0]], user.last_message_id);
            } else {
                await sendPhoto(chatId, from.id, IMG.register, M.already_registered_success + '\n\n' + M.register, [[{ text: "S'inscrire maintenant", url: regLink(from.id) }], BTN_BACK[0]], user.last_message_id);
            }
        }
    } catch (err) {
        console.error('[handleText ERROR]', err);
        await tgAPI('sendMessage', { chat_id: chatId, text: 'Erreur, veuillez reessayer.', parse_mode: 'HTML' }).catch(function(){});
    }
}

// ─── Main Update Handler ───
async function handleUpdate(update) {
    try {
        await ensureSessionsTable();
        await ensureSignalTables();

        // /start command
        if (update.message && update.message.text === '/start') {
            const chatId = update.message.chat.id;
            const from = update.message.from;
            let user = await getUser(from.id);
            if (!user) user = await createUser(from.id, from.username, from.first_name, from.last_name);

            if (user.is_registered && hasValidDeposit(user)) {
                // Auto-credit 15 signals if first access
                const sigData = await getSignals(from.id);
                if (sigData.signals === 0) {
                    await addSignals(from.id, 15);
                    await tgAPI('sendMessage', {
                        chat_id: chatId,
                        text: `🎉 <b>Bienvenue sur JET HACK !</b>\n\nVotre dépôt a été confirmé.\nVous avez reçu <b>15 signaux gratuits</b> !`,
                        parse_mode: 'HTML'
                    });
                }
                await renderLuckyJetMenu(chatId, from.id, user.last_message_id);
            } else {
                await sendPhoto(chatId, from.id, IMG.default, M.welcome + '\n' + M.menu, BTN_MENU, user.last_message_id);
            }
            return;
        }

        // Other text messages
        if (update.message && update.message.text && update.message.text !== '/start') {
            return await handleText(update.message.chat.id, update.message.from, update.message.text);
        }

        // Callback queries
        if (update.callback_query) {
            const q = update.callback_query;
            const chatId = q.message.chat.id;
            const userId = q.from.id;
            const data = q.data;
            const msgId = q.message.message_id;

            let user = await getUser(userId);
            if (!user) user = await createUser(userId, q.from.username, q.from.first_name, q.from.last_name);

            // ─── JOUER AUX SIGNAUX (accès au menu Lucky Jet) ───
            if (data === 'play_signals') {
                if (!user.is_registered) {
                    await tgAPI('answerCallbackQuery', { callback_query_id: q.id, text: "Inscrivez-vous d'abord.", show_alert: true });
                } else if (!hasValidDeposit(user)) {
                    const dep = parseFloat(user.deposit_amount) || 0;
                    let msg;
                    if (dep > 0 && dep < MIN_DEPOSIT) {
                        const remaining = (MIN_DEPOSIT - dep).toFixed(2);
                        const fcfa = Math.ceil(parseFloat(remaining) * 588.24);
                        msg = '<b>Dépôt insuffisant</b>\n\nVotre dépôt : <b>' + dep.toFixed(2) + '$</b>\nRequis : <b>8.5$ (5000 FCFA)</b>\n\nIl vous manque <b>' + remaining + '$ (environ ' + fcfa + ' FCFA)</b>.';
                    } else {
                        msg = '<b>Dépôt requis</b>\n\nEffectuez un dépôt minimum de <b>8.5$ (5000 FCFA)</b>.';
                    }
                    await tgAPI('answerCallbackQuery', { callback_query_id: q.id });
                    await sendPhoto(chatId, userId, IMG.deposit, msg, [[{ text: 'Effectuer un dépôt', url: regLink(userId) }], BTN_BACK[0]], msgId);
                } else {
                    await tgAPI('answerCallbackQuery', { callback_query_id: q.id });
                    // Credit 15 signals on first access
                    const sigData = await getSignals(userId);
                    if (sigData.signals === 0) {
                        await addSignals(userId, 15);
                        await tgAPI('sendMessage', {
                            chat_id: chatId,
                            text: `🎉 <b>Félicitations !</b>\n\nVotre accès est confirmé.\nVous avez reçu <b>15 signaux gratuits</b> !`,
                            parse_mode: 'HTML'
                        });
                    }
                    await renderLuckyJetMenu(chatId, userId, msgId);
                }
                return;
            }

            // ─── NAV_HOME (retour menu principal depuis Lucky Jet) ───
            if (data === 'nav_home') {
                await tgAPI('answerCallbackQuery', { callback_query_id: q.id });
                if (user.is_registered && hasValidDeposit(user)) {
                    await renderLuckyJetMenu(chatId, userId, msgId);
                } else {
                    await sendPhoto(chatId, userId, IMG.default, M.welcome + '\n' + M.menu, BTN_MENU, msgId);
                }
                return;
            }

            // ─── USR_INFOS ───
            if (data === 'usr_infos') {
                await tgAPI('answerCallbackQuery', { callback_query_id: q.id, text: "Inscrivez-vous avec EURO54, rechargez 8.5$, recevez 15 signaux. Attente 120s entre les signaux. Chaque 34$ cumulés = 20 signaux bonus.", show_alert: true });
                return;
            }

            // ─── USR_OPTIONS (sélection tranche de cotes) ───
            if (data === 'usr_options') {
                await tgAPI('answerCallbackQuery', { callback_query_id: q.id });
                const sigData = await getSignals(userId);
                const currentRange = sigData.range || '10-20';
                let txt = "⚙️ <b>PARAMÈTRES DES COTES</b>\n\nSélectionnez la tranche de cotes :\n\nActuelle : <b>" + currentRange + "X</b>";
                let kb = [
                    [{ text: "10.00x - 20.00x", callback_data: "set_range_10-20" }, { text: "20.00x - 50.00x", callback_data: "set_range_20-50" }],
                    [{ text: "50.00x - 100.00x", callback_data: "set_range_50-100" }, { text: "100.00x - 200.00x", callback_data: "set_range_100-200" }],
                    BTN_BACK[0]
                ];
                await sendPhoto(chatId, userId, IMG.default, txt, kb, msgId);
                return;
            }

            // ─── SET_RANGE ───
            if (data.startsWith("set_range_")) {
                let selectedRange = data.replace("set_range_", "");
                await setPrefRange(userId, selectedRange);
                await tgAPI('answerCallbackQuery', { callback_query_id: q.id, text: "✅ Tranche : " + selectedRange + "X", show_alert: true });
                await renderLuckyJetMenu(chatId, userId, msgId);
                return;
            }

            // ─── REQ_SIGNAL (demander un signal) ───
            if (data === 'req_signal') {
                const sigData = await getSignals(userId);
                if (sigData.signals <= 0) {
                    await tgAPI('answerCallbackQuery', { callback_query_id: q.id, text: "❌ Vous n'avez plus de signaux ! Contactez l'admin.", show_alert: true });
                    return;
                }

                const lastTime = await getLastSignalTime(userId);
                const now = new Date();
                if (lastTime) {
                    const elapsed = (now - new Date(lastTime)) / 1000;
                    if (elapsed < 120) {
                        const wait = Math.ceil(120 - elapsed);
                        await tgAPI('answerCallbackQuery', { callback_query_id: q.id, text: "⏳ Attendez " + wait + "s avant le prochain signal.", show_alert: true });
                        return;
                    }
                }

                // Consume 1 signal
                await removeSignals(userId, 1);
                await setLastSignalTime(userId);

                const signalMsg = generateSignal(sigData.range);
                const newSigData = await getSignals(userId);
                let kb = [
                    [{ text: `PROCHAIN TOUR ➡️ (${newSigData.signals} restants)`, callback_data: 'req_signal' }],
                    [{ text: "MENU PRINCIPAL ➡️", callback_data: 'nav_home' }]
                ];

                // Envoyer signal avec vidéo hébergée
                const user2 = await getUser(userId);
                await sendVideo(chatId, userId, VIDEO_SIGNAL, signalMsg, kb, user2?.last_message_id);
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
                    await renderLuckyJetMenu(chatId, userId, msgId);
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
    if (req.method === 'GET') return res.status(200).send('JET HACK Bot est en ligne !');
    if (req.method === 'POST') {
        try {
            await handleUpdate(req.body);
            return res.status(200).send('OK');
        } catch (e) { console.error('Webhook error:', e); return res.status(500).send('Error'); }
    }
    res.status(405).send('Method not allowed');
};

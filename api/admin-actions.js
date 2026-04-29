// ═══════════════════════════════════════════════════════
// EURO54 - Admin Actions API
// Route : POST /api/admin-actions
// Supports multi-bot broadcasts via bot_id parameter
// ═══════════════════════════════════════════════════════
const { query } = require('../lib/db');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'euro54admin';
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_TOKEN_2 = process.env.BOT_TOKEN_2;

const BOTS = {
    '1': { token: BOT_TOKEN, name: 'EURO54 Bot' },
    '2': { token: BOT_TOKEN_2, name: 'EURO54 Bot 2' }
};

function getBotToken(botId) {
    const b = BOTS[botId || '1'];
    return b ? b.token : BOT_TOKEN;
}

async function tgAPI(method, data, token) {
    const t = token || BOT_TOKEN;
    try {
        const res = await fetch('https://api.telegram.org/bot' + t + '/' + method, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await res.json();
    } catch (e) {
        console.error('[TG API ERROR]', e);
        return { ok: false };
    }
}

async function tgAPIMedia(method, formData, token) {
    const t = token || BOT_TOKEN;
    try {
        const res = await fetch('https://api.telegram.org/bot' + t + '/' + method, {
            method: 'POST',
            body: formData
        });
        return await res.json();
    } catch (e) {
        console.error('[TG MEDIA ERROR]', e);
        return { ok: false };
    }
}

async function getChatInfo(tid, token) {
    const t = token || BOT_TOKEN;
    try {
        const res = await fetch('https://api.telegram.org/bot' + t + '/getChat?chat_id=' + tid);
        const data = await res.json();
        return data.ok ? data.result : null;
    } catch (e) { return null; }
}

function checkAuth(body) {
    const pw = body?.password;
    if (pw !== ADMIN_PASSWORD) return false;
    return true;
}

function getFileExt(mimeType) {
    if (!mimeType) return 'bin';
    if (mimeType.startsWith('image/')) return mimeType.includes('png') ? 'png' : mimeType.includes('gif') ? 'gif' : 'jpg';
    if (mimeType.startsWith('video/')) return mimeType.includes('mp4') ? 'mp4' : 'mp4';
    if (mimeType.includes('ogg') || mimeType.includes('voice') || mimeType.includes('audio')) return 'ogg';
    return 'bin';
}

function getMediaType(mimeType) {
    if (!mimeType) return null;
    if (mimeType.startsWith('image/')) return 'photo';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/') || mimeType.includes('voice') || mimeType.includes('ogg')) return 'voice';
    return null;
}

function getTGMethod(mediaType) {
    switch (mediaType) {
        case 'photo': return 'sendPhoto';
        case 'video': return 'sendVideo';
        case 'voice': return 'sendVoice';
        case 'audio': return 'sendAudio';
        case 'animation': return 'sendAnimation';
        case 'document': return 'sendDocument';
        default: return 'sendMessage';
    }
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method === 'GET') return res.status(200).send('OK');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    let body;
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON' });
    }

    if (!checkAuth(body)) return res.status(403).json({ error: 'Non autorise' });

    try {
        const action = body.action;

        // ─── DIFFUSER UN MESSAGE TEXTE ───
        if (action === 'broadcast') {
            const message = body.message || '';
            const target = body.target || 'all';
            const botId = body.bot_id || '1';
            const botToken = getBotToken(botId);
            if (!botToken) return res.status(400).json({ error: 'Bot non configure' });
            if (!message.trim()) return res.status(400).json({ error: 'Message vide' });

            const users = await getTargetUsers(target);
            if (users.length === 0) return res.status(200).json({ success: true, sent: 0, failed: 0, total: 0 });

            let sent = 0, failed = 0;
            for (const u of users) {
                try {
                    const r = await tgAPI('sendMessage', {
                        chat_id: u.telegram_id,
                        text: message,
                        parse_mode: 'HTML'
                    }, botToken);
                    if (r.ok) sent++; else failed++;
                } catch (e) { failed++; }
                await new Promise(r => setTimeout(r, 40));
            }
            return res.status(200).json({ success: true, sent, failed, total: users.length, bot: BOTS[botId]?.name });
        }

        // ─── DIFFUSER UN MÉDIA (photo, vidéo, audio) ───
        if (action === 'broadcast_media') {
            const { media_base64, media_type, mime_type, caption, target } = body;
            const botId = body.bot_id || '1';
            const botToken = getBotToken(botId);
            if (!botToken) return res.status(400).json({ error: 'Bot non configure' });

            if (!media_base64 || !media_type) {
                return res.status(400).json({ error: 'Media manquant' });
            }

            const users = await getTargetUsers(target || 'all');
            if (users.length === 0) {
                return res.status(200).json({ success: true, sent: 0, failed: 0, total: 0 });
            }

            const fileBuffer = Buffer.from(media_base64, 'base64');
            const ext = getFileExt(mime_type);
            const tgMethod = getTGMethod(media_type);
            const cap = caption || '';

            let sent = 0, failed = 0;

            // Send to first user to test, then use the same buffer for others
            for (const u of users) {
                try {
                    const formData = new FormData();
                    const blob = new Blob([fileBuffer], { type: mime_type || 'application/octet-stream' });
                    const fieldName = media_type === 'photo' ? 'photo' : media_type === 'voice' ? 'voice' : 'video';
                    formData.append(fieldName, blob, `broadcast.${ext}`);
                    formData.append('chat_id', u.telegram_id);
                    if (cap) {
                        formData.append('caption', cap);
                        formData.append('parse_mode', 'HTML');
                    }

                    const r = await tgAPIMedia(tgMethod, formData, botToken);
                    if (r.ok) sent++; else failed++;
                } catch (e) {
                    failed++;
                    console.error('[BC MEDIA ERR]', u.telegram_id, e.message);
                }
                await new Promise(r => setTimeout(r, 50));
            }

            return res.status(200).json({ success: true, sent, failed, total: users.length, bot: BOTS[botId]?.name });
        }

        // ─── AJOUTER UN ABONNÉ ───
        // ID 1Win est obligatoire, ID Telegram est optionnel
        if (action === 'add_user') {
            const tid = String(body.telegram_id || '').trim().replace(/[^0-9]/g, '');
            const winId = String(body.one_win_id || '').trim().replace(/[^0-9]/g, '');
            const isRegistered = body.is_registered === true || body.is_registered === 'true';
            const isDeposited = body.is_deposited === true || body.is_deposited === 'true';

            // ID 1Win est obligatoire
            if (!winId || winId.length < 3) return res.status(400).json({ error: 'ID 1Win est obligatoire' });

            // Vérifier si un utilisateur avec ce 1Win ID existe déjà
            const existingByWin = await query('SELECT * FROM users WHERE one_win_user_id = $1', [winId]);
            if (existingByWin.length > 0) {
                const u = existingByWin[0];
                const updates = ['is_registered = $2', 'is_deposited = $3', 'updated_at = NOW()'];
                const params = [isRegistered, isDeposited, winId];
                // Si un telegram_id est fourni, le lier
                if (tid && tid.length >= 5) {
                    updates.push('telegram_id = $4');
                    params.splice(2, 0, tid);
                    // Also try to get name from Telegram
                    const ci = await getChatInfo(tid);
                    if (ci) {
                        updates.push("first_name = $5");
                        params.splice(3, 0, [ci.first_name, ci.last_name].filter(Boolean).join(' ') || 'Inconnu');
                    }
                }
                await query(
                    'UPDATE users SET ' + updates.join(', ') + ' WHERE one_win_user_id = $' + (params.length),
                    params
                );
                return res.status(200).json({ success: true, action: 'updated', one_win_id: winId, telegram_id: tid || u.telegram_id });
            }

            // Si un telegram_id est fourni, vérifier s'il existe déjà
            if (tid && tid.length >= 5) {
                const existingByTg = await query('SELECT * FROM users WHERE telegram_id = $1', [tid]);
                if (existingByTg.length > 0) {
                    // Mettre à jour l'utilisateur existant avec le 1Win ID
                    await query(
                        'UPDATE users SET one_win_user_id = $1, is_registered = $2, is_deposited = $3, updated_at = NOW() WHERE telegram_id = $4',
                        [winId, isRegistered, isDeposited, tid]
                    );
                    return res.status(200).json({ success: true, action: 'updated', telegram_id: tid, one_win_id: winId });
                }
            }

            // Créer un nouvel utilisateur
            let name = 'Inconnu';
            if (tid && tid.length >= 5) {
                const ci = await getChatInfo(tid);
                if (ci) name = [ci.first_name, ci.last_name].filter(Boolean).join(' ') || 'Inconnu';
            }

            await query(
                'INSERT INTO users (telegram_id, first_name, one_win_user_id, is_registered, is_deposited, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())',
                [tid && tid.length >= 5 ? tid : null, name, winId, isRegistered, isDeposited]
            );
            return res.status(200).json({ success: true, action: 'created', one_win_id: winId, telegram_id: tid || null, name });
        }

        // ─── MODIFIER UN ABONNÉ ───
        if (action === 'edit_user') {
            const tid = String(body.telegram_id || '').trim();
            const isRegistered = body.is_registered === true || body.is_registered === 'true';
            const isDeposited = body.is_deposited === true || body.is_deposited === 'true';
            const depositAmount = body.deposit_amount !== undefined ? parseFloat(body.deposit_amount) : null;

            if (!tid) return res.status(400).json({ error: 'ID manquant' });
            const existing = await query('SELECT * FROM users WHERE telegram_id = $1', [tid]);
            if (existing.length === 0) return res.status(404).json({ error: 'Utilisateur non trouve' });

            if (depositAmount !== null) {
                await query(
                    'UPDATE users SET is_registered = $1, is_deposited = $2, deposit_amount = COALESCE($3, deposit_amount), updated_at = NOW() WHERE telegram_id = $4',
                    [isRegistered, isDeposited, depositAmount, tid]
                );
            } else {
                await query(
                    'UPDATE users SET is_registered = $1, is_deposited = $2, updated_at = NOW() WHERE telegram_id = $3',
                    [isRegistered, isDeposited, tid]
                );
            }
            return res.status(200).json({ success: true, action: 'updated', telegram_id: tid });
        }

        // ─── SUPPRIMER UN ABONNÉ ───
        if (action === 'delete_user') {
            const tid = String(body.telegram_id || '').trim();
            const uid = body.id ? parseInt(body.id) : null;
            if (!tid && !uid) return res.status(400).json({ error: 'ID manquant' });
            if (uid) {
                await query('DELETE FROM users WHERE id = $1', [uid]);
                return res.status(200).json({ success: true, action: 'deleted', id: uid });
            } else {
                await query('DELETE FROM users WHERE telegram_id = $1', [tid]);
                return res.status(200).json({ success: true, action: 'deleted', telegram_id: tid });
            }
        }

        return res.status(400).json({ error: 'Action inconnue' });
    } catch (error) {
        console.error('[ADMIN ACTIONS ERROR]', error);
        return res.status(500).json({ error: 'Erreur serveur: ' + error.message });
    }
};

async function getTargetUsers(target) {
    switch (target) {
        case 'registered':
            return await query('SELECT telegram_id FROM users WHERE is_registered = TRUE AND telegram_id IS NOT NULL');
        case 'vip':
            return await query('SELECT telegram_id FROM users WHERE is_deposited = TRUE AND telegram_id IS NOT NULL');
        default:
            return await query('SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL');
    }
}

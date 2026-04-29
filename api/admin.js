// ═══════════════════════════════════════════════════════
// EURO54 - Admin API
// Route : GET /api/admin
// ═══════════════════════════════════════════════════════
const { query } = require('../lib/db');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'euro54admin';

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.query.password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Non autorisé' });

    try {
        const action = req.query.action;

        // ─── Stats ───
        if (!action || action === 'stats') {
            const t = await query('SELECT COUNT(*) as c FROM users');
            const r = await query('SELECT COUNT(*) as c FROM users WHERE is_registered = TRUE');
            const d = await query('SELECT COUNT(*) as c FROM users WHERE is_deposited = TRUE');
            const rev = await query('SELECT COALESCE(SUM(deposit_amount),0) as t FROM users');
            const today = await query("SELECT COUNT(*) as c FROM users WHERE created_at >= CURRENT_DATE");
            const todayDep = await query("SELECT COUNT(*) as c FROM users WHERE deposited_at >= CURRENT_DATE");
            return res.status(200).json({
                total: parseInt(t[0].c),
                registered: parseInt(r[0].c),
                deposited: parseInt(d[0].c),
                totalRevenue: parseFloat(rev[0].t),
                newToday: parseInt(today[0].c),
                depositedToday: parseInt(todayDep[0].c)
            });
        }

        // ─── Tous les utilisateurs ───
        if (action === 'users') {
            const users = await query('SELECT * FROM users ORDER BY created_at DESC');
            return res.status(200).json({ users });
        }

        // ─── Recherche utilisateur ───
        if (action === 'search') {
            const q = req.query.q || '';
            if (!q.trim()) return res.status(200).json({ users: [] });

            const searchTerm = '%' + q.trim() + '%';
            const users = await query(
                `SELECT * FROM users
                 WHERE telegram_id::text ILIKE $1
                    OR one_win_user_id::text ILIKE $1
                    OR first_name ILIKE $1
                    OR last_name ILIKE $1
                    OR username ILIKE $1
                 ORDER BY created_at DESC
                 LIMIT 50`,
                [searchTerm]
            );
            return res.status(200).json({ users });
        }

        // ─── Codes d'accès ───
        if (action === 'codes') {
            const codes = await query(
                'SELECT ac.*, u.first_name, u.username FROM access_codes ac LEFT JOIN users u ON u.telegram_id = ac.telegram_id ORDER BY ac.created_at DESC'
            );
            return res.status(200).json({ codes });
        }

        // ─── Nettoyer les doublons Inconnu ───
        if (action === 'cleanup') {
            // Supprimer les lignes "Inconnu" sans telegram_id
            const r1 = await query(
                `DELETE FROM users WHERE first_name = 'Inconnu' AND telegram_id IS NULL RETURNING id, one_win_user_id`
            );
            // Supprimer les doublons 1Win (garder la ligne avec telegram_id)
            const dupes = await query(
                `SELECT one_win_user_id FROM users WHERE one_win_user_id IS NOT NULL GROUP BY one_win_user_id HAVING COUNT(*) > 1`
            );
            let dupesDeleted = 0;
            for (const d of dupes) {
                const rows = await query(
                    `SELECT * FROM users WHERE one_win_user_id = $1 ORDER BY telegram_id NULLS LAST, id DESC`, [d.one_win_user_id]
                );
                for (let i = 1; i < rows.length; i++) {
                    await query('DELETE FROM users WHERE id = $1', [rows[i].id]);
                    dupesDeleted++;
                }
            }
            const remaining = await query('SELECT id, first_name, telegram_id, one_win_user_id FROM users ORDER BY id');
            return res.status(200).json({ inconnu_deleted: r1.length, dupes_deleted: dupesDeleted, remaining });
        }

        // ─── Générer un code ───
        if (action === 'generate') {
            const tid = req.query.telegram_id;
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let code = 'EURO-';
            for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
            await query('INSERT INTO access_codes (code, telegram_id, created_at) VALUES ($1, $2, NOW())', [code, tid || null]);
            return res.status(200).json({ success: true, code });
        }

        return res.status(400).json({ error: 'Action inconnue' });
    } catch (error) {
        console.error('[ADMIN API ERROR]', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
};

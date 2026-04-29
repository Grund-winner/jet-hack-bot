module.exports = async (req, res) => {
    try {
        const token = process.env.BOT_TOKEN;
        const r = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
        const data = await r.json();
        res.json({
            ok: data.ok,
            url: data.result?.url,
            pending_update_count: data.result?.pending_update_count,
            last_error_date: data.result?.last_error_date,
            last_error_message: data.result?.last_error_message
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

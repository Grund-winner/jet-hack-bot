module.exports = async function handler(req, res) {
    res.json({
        BOT_TOKEN_SET: !!process.env.BOT_TOKEN,
        DATABASE_URL_SET: !!process.env.DATABASE_URL,
        ADMIN_PASSWORD_SET: !!process.env.ADMIN_PASSWORD,
        MIN_DEPOSIT: process.env.MIN_DEPOSIT,
        REG_LINK: process.env.REG_LINK ? process.env.REG_LINK.substring(0, 30) + '...' : 'NOT SET',
        BASE_URL: process.env.BASE_URL || process.env.VERCEL_URL || 'NOT SET',
        ADMIN_IDS: process.env.ADMIN_IDS || 'NOT SET'
    });
};

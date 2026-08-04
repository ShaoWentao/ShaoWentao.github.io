const PUBLIC_PATHS = new Set(['/membership', '/membership.html', '/api/me']);
const MEMBERSHIP_CACHE_TTL_MS = 5 * 60 * 1000;
const membershipCache = new Map();
const membershipPending = new Map();

function json(data, status = 200) {
    return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

function normalizedEmail(request) {
    return (request.headers.get('Cf-Access-Authenticated-User-Email') || '').trim().toLowerCase();
}

async function membershipFor(env, email) {
    if (!email) return null;
    const cached = membershipCache.get(email);
    if (cached && cached.expiresAt > Date.now()) return cached.membership;

    if (membershipPending.has(email)) return membershipPending.get(email);

    const lookup = env.MEMBERS.prepare(`
            SELECT email, plan, status, expires_at
            FROM memberships
            WHERE email = ?1
              AND status = 'active'
              AND (expires_at IS NULL OR expires_at > datetime('now'))
            LIMIT 1
        `).bind(email).first()
        .then(membership => {
            membershipCache.set(email, {
                membership,
                expiresAt: Date.now() + MEMBERSHIP_CACHE_TTL_MS
            });
            return membership;
        })
        .finally(() => membershipPending.delete(email));
    membershipPending.set(email, lookup);
    return lookup;
}

function membershipPage(email = '') {
    const escapedEmail = email.replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
    return new Response(`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>会员授权</title><style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f5f5f7;color:#1d1d1f;display:grid;min-height:100vh;place-items:center}
main{width:min(520px,calc(100% - 32px));background:#fff;border:1px solid #d2d2d7;border-radius:14px;padding:32px;box-sizing:border-box;box-shadow:0 12px 40px rgba(0,0,0,.08)}
h1{font-size:24px;margin:0 0 12px}p{color:#6e6e73;line-height:1.6}.email{color:#1d1d1f;font-weight:600}.hint{font-size:13px;margin-top:24px}
</style></head><body><main><h1>需要有效会员授权</h1>
<p>当前登录邮箱 <span class="email">${escapedEmail || '未识别'}</span> 尚未开通，或会员已到期。</p>
<p>完成购买后，请联系管理员为该邮箱开通使用权限。</p>
<p class="hint">授权生效后刷新本页面即可使用光谱优化器。</p></main></body></html>`, {
        status: 403,
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
    });
}

async function handleAdmin(request, env) {
    const expected = env.ADMIN_TOKEN || '';
    const supplied = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!expected || supplied !== expected) return json({ error: 'Unauthorized' }, 401);

    if (request.method === 'POST') {
        const body = await request.json();
        const email = String(body.email || '').trim().toLowerCase();
        const plan = String(body.plan || 'professional').trim();
        const expiresAt = body.expiresAt ? String(body.expiresAt) : null;
        if (!email || !email.includes('@')) return json({ error: 'Valid email required' }, 400);
        await env.MEMBERS.prepare(`
            INSERT INTO memberships (email, plan, status, expires_at, updated_at)
            VALUES (?1, ?2, 'active', ?3, datetime('now'))
            ON CONFLICT(email) DO UPDATE SET
                plan = excluded.plan,
                status = 'active',
                expires_at = excluded.expires_at,
                updated_at = datetime('now')
        `).bind(email, plan, expiresAt).run();
        membershipCache.delete(email);
        return json({ ok: true, email, plan, expiresAt });
    }

    if (request.method === 'DELETE') {
        const email = new URL(request.url).searchParams.get('email')?.trim().toLowerCase();
        if (!email) return json({ error: 'Email required' }, 400);
        await env.MEMBERS.prepare(`
            UPDATE memberships SET status = 'revoked', updated_at = datetime('now') WHERE email = ?1
        `).bind(email).run();
        membershipCache.delete(email);
        return json({ ok: true, email });
    }

    return json({ error: 'Method not allowed' }, 405);
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const email = normalizedEmail(request);

        if (url.pathname.startsWith('/api/admin/members')) return handleAdmin(request, env);
        const membership = await membershipFor(env, email);
        if (url.pathname === '/api/me') {
            return json({ authenticated: Boolean(email), email, membership });
        }
        if (!membership && !PUBLIC_PATHS.has(url.pathname)) return membershipPage(email);
        if (url.pathname === '/membership' || url.pathname === '/membership.html') return membershipPage(email);

        return env.ASSETS.fetch(request);
    }
};

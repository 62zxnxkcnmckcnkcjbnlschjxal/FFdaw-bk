/**
 * Cloudflare Pages Function —— 站点设置（标题 / Logo）云端同步
 * GET  /api/settings   拉取站点设置（公开）
 * POST /api/settings   保存站点设置（需已授权或首次 bootstrap）
 *
 * 绑定：EARNINGS_KV
 * 存储键：ffdaz_site_config
 * 数据格式：{ "t": 时间戳, "title": "...", "logo": "..." }
 */

const KV_KEY = 'ffdaz_site_config';
const AUTH_CFG_KEY = 'ffdaz_auth_config';
const AUTH_SESS_PREFIX = 'ffdaz_auth_session:';
const AUTH_SESS_TTL = 30 * 24 * 3600 * 1000;

async function getAuthConfig(env) {
  const cfg = { enabled: false, password: '', ipWhitelist: [], devices: [] };
  try {
    const raw = await env.EARNINGS_KV.get(AUTH_CFG_KEY);
    if (raw) Object.assign(cfg, JSON.parse(raw));
  } catch (e) {}
  if (env.ACCESS_PASSWORD && typeof env.ACCESS_PASSWORD === 'string' && env.ACCESS_PASSWORD.trim()) {
    cfg.password = env.ACCESS_PASSWORD.trim();
  }
  cfg.enabled = !!(cfg.enabled && (cfg.password || (Array.isArray(cfg.ipWhitelist) && cfg.ipWhitelist.length > 0)));
  return cfg;
}

function getIP(req) {
  const xff = req.headers.get('x-forwarded-for') || '';
  return (req.headers.get('CF-Connecting-IP') || xff.split(',')[0] || '').trim() || 'unknown';
}

function getCookie(req, name) {
  const c = req.headers.get('cookie') || '';
  const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : '';
}

async function isAuthed(env, req) {
  const cfg = await getAuthConfig(env);
  if (!cfg.enabled) return true; // 访问验证未启用 = 公开站，允许写
  const ip = getIP(req);
  if (Array.isArray(cfg.ipWhitelist) && cfg.ipWhitelist.indexOf(ip) >= 0) return true;
  const token = getCookie(req, 'ce_auth');
  if (!token) return false;
  try {
    const raw = await env.EARNINGS_KV.get(AUTH_SESS_PREFIX + token);
    if (!raw) return false;
    const s = JSON.parse(raw);
    return s.exp > Date.now();
  } catch (e) { return false; }
}

export async function onRequestGet(ctx) {
  try {
    const raw = await ctx.env.EARNINGS_KV.get(KV_KEY);
    const cfg = raw ? JSON.parse(raw) : {};
    return json({ ok: true, config: { title: cfg.title || '', logo: cfg.logo || '' }, t: cfg.t || 0 });
  } catch (e) {
    return json({ ok: false, error: '读取设置异常：' + e.message }, 500);
  }
}

export async function onRequestPost(ctx) {
  try {
    const raw0 = await ctx.env.EARNINGS_KV.get(KV_KEY);
    let cfg0 = {};
    if (raw0) { try { cfg0 = JSON.parse(raw0); } catch (e) {} }
    // bootstrap：云端从未保存过设置时允许直接写入
    const neverSaved = !cfg0.title && !cfg0.logo;
    if (!neverSaved) {
      const authed = await isAuthed(ctx.env, ctx.request);
      if (!authed) return json({ ok: false, error: '未授权' }, 401);
    }
    const body = await ctx.request.json();
    const title = String(body.title || '').trim().slice(0, 40);
    let logo = String(body.logo || '').trim().slice(0, 1000000);
    if (logo && logo.indexOf('data:image/') === 0) {
      // 校验 base64 图片（防超限）
      const m = logo.match(/^data:image\/[a-zA-Z+]+;base64,([A-Za-z0-9+/=]+)$/);
      if (!m) return json({ ok: false, error: 'Logo 图片格式不正确' }, 400);
      if (m[1].length > 800 * 1024 / 4 * 3) return json({ ok: false, error: 'Logo 图片过大（需小于 800KB）' }, 400);
    } else if (logo) {
      try {
        const u = new URL(logo);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol');
      } catch (e) { return json({ ok: false, error: 'Logo 链接格式不正确' }, 400); }
    }
    const payload = { t: Date.now(), title: title, logo: logo };
    await ctx.env.EARNINGS_KV.put(KV_KEY, JSON.stringify(payload));
    return json({ ok: true, config: { title: title, logo: logo }, t: payload.t });
  } catch (e) {
    return json({ ok: false, error: '保存设置异常：' + e.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
}

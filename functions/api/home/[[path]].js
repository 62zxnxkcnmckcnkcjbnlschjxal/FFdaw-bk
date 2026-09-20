/**
 * 首页配置接口
 * GET  /api/home        公开读取（track/slices/site 等首页卡片配置）
 * POST /api/home        授权后保存（middleware 已校验 ce_auth）
 *
 * 配置存 KV：ffdaz_home
 * {
 *   track: {title, artist, cover, url},
 *   slices: [{title, image}],
 *   site:   {heroTitle, heroSub, intro}
 * }
 */
const KEY = 'ffdaz_home';

const DEFAULT = {
  track: { title: '', artist: '', cover: '', url: '' },
  slices: [],
  site:  { heroTitle: '把好奇心，变成作品。', heroSub: 'FF大王 · 博客工作台 · 云端同步', intro: '我是 FF大王，光遇资深玩家与创作者。这里是我的博客、灵感与日常收藏。' }
};

async function read(env) {
  try {
    const raw = await env.EARNINGS_KV.get(KEY);
    if (!raw) return structuredClone(DEFAULT);
    const o = JSON.parse(raw);
    // 缺字段补默认
    const d = structuredClone(DEFAULT);
    return {
      track:   Object.assign({}, d.track, o.track || {}),
      slices:  Array.isArray(o.slices) ? o.slices : [],
      site:    Object.assign({}, d.site, o.site || {})
    };
  } catch (e) {
    return structuredClone(DEFAULT);
  }
}

export async function onRequest(ctx) {
  const req = ctx.request;
  const url = new URL(req.url);
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method === 'GET') {
    const cfg = await read(ctx.env);
    return new Response(JSON.stringify({ ok: true, config: cfg }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors, 'Cache-Control': 'no-store' }
    });
  }
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const cur = await read(ctx.env);
      if (body && typeof body === 'object') {
        if (body.track && typeof body.track === 'object') Object.assign(cur.track, body.track);
        if (Array.isArray(body.slices)) cur.slices = body.slices.slice(0, 24).map(function (s) {
          return { title: String(s.title || '').slice(0, 80), image: String(s.image || '').slice(0, 500) };
        });
        if (body.site && typeof body.site === 'object') Object.assign(cur.site, body.site);
      }
      await ctx.env.EARNINGS_KV.put(KEY, JSON.stringify(cur));
      return new Response(JSON.stringify({ ok: true, config: cur }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors }
      });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: '保存失败：' + e.message }), {
        status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors }
      });
    }
  }
  return new Response(JSON.stringify({ ok: false, error: 'method not allowed' }), { status: 405, headers: cors });
}

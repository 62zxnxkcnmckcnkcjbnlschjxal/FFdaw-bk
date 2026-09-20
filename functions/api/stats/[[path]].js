/**
 * 访问统计 + 签到接口
 * GET  /api/stats            读取统计（同时递增今日访问计数）
 * POST /api/stats/checkin    签到（每日一次）
 *
 * 存 KV：ffdaz_stats
 * { totalViews, todayVisitors, lastDay, checkins, firstDay, checkedDays:{} }
 */
const KEY = 'ffdaz_stats';

function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

async function read(env) {
  try {
    const raw = await env.EARNINGS_KV.get(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { totalViews: 0, todayVisitors: 0, lastDay: '', checkins: 0, firstDay: today(), checkedDays: {} };
}

async function write(env, s) {
  await env.EARNINGS_KV.put(KEY, JSON.stringify(s));
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
    let s = await read(ctx.env);
    const t = today();
    if (s.lastDay !== t) { s.todayVisitors = 0; s.lastDay = t; }
    s.totalViews = (s.totalViews || 0) + 1;
    s.todayVisitors = (s.todayVisitors || 0) + 1;
    await write(ctx.env, s);
    const daysOnline = s.firstDay ? Math.max(1, Math.floor((Date.now() - new Date(s.firstDay + 'T00:00:00').getTime()) / 86400000) + 1) : 1;
    const checkedIn = !!(s.checkedDays && s.checkedDays[t]);
    return new Response(JSON.stringify({
      ok: true,
      todayVisitors: s.todayVisitors,
      totalViews: s.totalViews,
      checkins: s.checkins || 0,
      daysOnline: daysOnline,
      checkedIn: checkedIn
    }), { headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors, 'Cache-Control': 'no-store' } });
  }

  if (req.method === 'POST' && url.searchParams.get('action') === 'checkin') {
    let s = await read(ctx.env);
    const t = today();
    if (!s.checkedDays) s.checkedDays = {};
    if (s.checkedDays[t]) {
      return new Response(JSON.stringify({ ok: true, already: true, message: '今天已经签到过啦' }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors }
      });
    }
    s.checkedDays[t] = true;
    s.checkins = (s.checkins || 0) + 1;
    await write(ctx.env, s);
    return new Response(JSON.stringify({ ok: true, checkins: s.checkins }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors }
    });
  }

  return new Response(JSON.stringify({ ok: false, error: 'method not allowed' }), { status: 405, headers: cors });
}

/**
 * Cloudflare Pages Function —— 跨站公告公开只读接口（公告源）
 * GET /api/public-notice
 *   - 公开访问，无需登录，允许跨域（CORS *）
 *   - 从共享 KV（EARNINGS_KV，键 creator_blog_data）读取所有文章，
 *     只返回最新一篇「勾选了『作为弹窗公告使用』且已发布、未隐藏」的文章
 *   - 只读，不提供任何写入/删除能力，其他站点无法通过此接口篡改公告
 *
 * 部署：放在 FF大王博客站 functions/api/ 下，与其他 api 接口同级。
 * 使用方：主收益工作台、问卷工作台等站点，打开页面时 GET 本接口即可跨站弹窗。
 */

const BLOG_KEY = 'creator_blog_data';

export async function onRequestGet(ctx) {
  try {
    let list = [];
    const raw = await ctx.env.EARNINGS_KV.get(BLOG_KEY);
    if (raw) {
      try {
        const d = JSON.parse(raw);
        list = Array.isArray(d) ? d : (Array.isArray(d.articles) ? d.articles : []);
      } catch (e) { /* 数据损坏则视为空 */ }
    }

    // 只取：勾选了弹窗公告、已发布、未隐藏
    const arr = list.filter(function (a) {
      return a && a.announce && !a.hidden && a.status !== 'draft' && a.status !== 'hidden';
    });
    arr.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });

    const top = arr[0] || null;
    return json({
      ok: true,
      source: 'ffdaz-blog',
      notice: top ? {
        id: String(top.id || ''),
        title: String(top.title || ''),
        content: String(top.content || ''),
        updatedAt: Number(top.updatedAt || 0)
      } : null
    }, 200);
  } catch (e) {
    return json({ ok: false, error: '公告读取异常：' + (e && e.message ? e.message : e) }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    }
  });
}

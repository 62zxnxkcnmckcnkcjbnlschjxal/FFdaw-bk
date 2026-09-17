# ffdaz-grzy V1.1（拆分版）

收益工作台（主站）+ FF大王博客（新站）两个独立站点。

## 一、主站：创作者收益工作台（creator-earnings-tracker）

**改动**：博客 / 博客管理已拆出（功能移到 FF大王博客），主站保留记账、已发放、攻略、友链、更新公告、光遇、DeepSeek、公告、隐私、设置；友链云同步保留；更新公告改为从「FF大王博客」自动拉取。

**部署**：整个 `creator-earnings-tracker/` 文件夹覆盖上传 GitHub（仓库 62zxnxkcnmckcnkcjbnlschjxal/creator-earnings-tracker），CF Pages 自动部署。保持不变即可（functions 已移除博客接口）。

## 二、新站：FF大王 博客（ffdaz-blog）

全新独立博客站：列表 / 正文（Markdown）/ 管理 / 编辑器，深浅主题，移动端适配。

**部署步骤**：
1. 新建 GitHub 仓库（如 ffdaz-blog），上传整个 `ffdaz-blog/` 文件夹内容
2. Cloudflare Pages 新建项目，连接该仓库（框架预设选 None）
3. **绑定 KV**：Settings → Functions → KV namespace bindings → 绑定你的 `EARNINGS_KV`（变量名必须是 `EARNINGS_KV`）——这样博客数据与主站共享，老文章自动出现
4. （可选）访问验证：Settings → Environment variables → 添加 `ACCESS_PASSWORD`（加密密文），并在站点设置页开启访问验证；不配则博客公开浏览
5. 部署后域名形如 `https://ffdaz-blog.pages.dev`

## 三、主站公告对接

主站「更新公告」默认从 `https://ffdaz-blog.pages.dev` 拉取公告（博客里写文章勾选「作为弹窗公告使用」发布即成为公告弹窗）。

若你的博客域名不同：主站 → 设置 → 博客公告源 → 填入你的博客地址 → 保存。

## 说明

- 博客数据存在 Cloudflare KV（键 creator_blog_data），两个站点绑定同一 KV 即共享数据，无需迁移
- 新站访问验证独立（键 ffdaz_auth_config），与主站互不影响

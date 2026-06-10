# 日语文本注音 Web 应用

这是一个部署到 Cloudflare Pages 的日语文本注音工具。编辑器用于粘贴日语文本并在汉字上方填写假名；保存后，每篇文档都会生成一个单独的 HTML 文件存入 R2，并通过公共 URL 查看。

## 功能

- 左侧粘贴文本，右侧实时预览。
- 每个汉字上方都有可输入的注音框。
- 保存时输入文件名。
- 文档列表支持查看、编辑、删除。
- 每篇文档保存为 `documents/{id}.html`。
- 公共预览页地址为 `/view/{id}`。
- 所有公共预览页引用同一个 R2 中的 `assets/document.css`。
- 预览 HTML 缓存 5 分钟，公共 CSS 缓存 1 年。

## 项目结构

```text
public/
  index.html        # 编辑器页面
  app.css           # 编辑器样式
  app.js            # 编辑器交互
functions/
  api/docs.js       # 列表、创建
  api/docs/[id].js  # 读取、更新、删除
  view/[id].js      # 公共分享 HTML
  assets/document.css.js # 从 R2 读取公共 CSS
  _lib/storage.js   # R2 存储、HTML 生成、索引逻辑
wrangler.toml       # Pages + R2 绑定配置
```

## 本地运行

先安装依赖：

```bash
npm install
```

启动本地 Pages Functions：

```bash
npm run dev
```

本地开发会使用 Wrangler 的本地 R2 模拟存储。打开终端里显示的 localhost 地址即可。

## 上传到 GitHub

在当前目录执行：

```bash
git init
git add .
git commit -m "Initial furigana R2 Pages app"
```

到 GitHub 新建一个空仓库，例如 `furigana-r2-pages`，然后执行：

```bash
git branch -M main
git remote add origin https://github.com/<你的用户名>/furigana-r2-pages.git
git push -u origin main
```

## 通过 Cloudflare Dashboard 部署

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 进入 **R2 Object Storage**，创建 bucket：`furigana-docs`。
3. 进入 **Workers & Pages**，选择 **Create application**。
4. 选择 **Pages**，连接 GitHub，选择刚才的仓库。
5. 构建设置：
   - Framework preset: `None`
   - Build command: 留空
   - Build output directory: `public`
6. 创建并完成第一次部署。
7. 进入该 Pages 项目：**Settings > Bindings > Add > R2 bucket**。
8. 设置：
   - Variable name: `DOCS_BUCKET`
   - R2 bucket: `furigana-docs`
9. 保存绑定后，重新部署一次项目，让绑定生效。

Cloudflare 官方文档说明 Pages Functions 可以通过绑定访问 R2，并且 Dashboard 路径是 **Workers & Pages > 你的 Pages 项目 > Settings > Bindings > Add > R2 bucket**。官方 Git 集成文档也说明 Pages 可以连接 GitHub 仓库后自动部署。

## 建议的访问控制

公共分享页 `/view/{id}` 是给别人查看的；编辑器和 `/api/*` 默认也是公开的。正式使用时，建议在 Cloudflare Dashboard 给编辑器加 Cloudflare Access：

- 保护路径：`/` 和 `/api/*`
- 放行路径：`/view/*` 和 `/assets/document.css`

这样别人只能看分享链接，不能进入编辑器管理文档。

## 参考文档

- [Cloudflare Pages Functions bindings](https://developers.cloudflare.com/pages/functions/bindings/)
- [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Use R2 from Workers](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/)

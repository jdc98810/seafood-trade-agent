# 上线部署指南（Render.com 免费方案）

代码已完成 Docker 化：容器启动时自动执行数据库迁移，检测到空库会自动注入演示数据（VN-JP-001 + 4 份已抽取的单证 + 待审批邮件草案），打开网址即是可演示状态。

你只需要做两件需要账号的事（约 10 分钟）：

## 第一步：把代码推到 GitHub

1. 打开 https://github.com/new 创建一个新仓库（建议 Private，名字如 `seafood-trade-agent`，**不要**勾选任何初始化文件）
2. 在项目目录执行（把 `<你的用户名>` 换掉）：

```powershell
cd D:\桌面\2026s\seafood-trade-agent
git remote add origin https://github.com/<你的用户名>/seafood-trade-agent.git
git push -u origin master
```

首次推送会弹出 GitHub 登录窗口，登录即可。

## 第二步：在 Render 上部署

1. 打开 https://render.com → **Sign in with GitHub**（用刚才的 GitHub 账号授权）
2. 点 **New +** → **Blueprint**
3. 选择 `seafood-trade-agent` 仓库 → Render 会自动读取仓库里的 `render.yaml` → 点 **Apply**
4. 等待构建（首次约 5–10 分钟），完成后会得到一个公网地址：
   `https://seafood-trade-agent-xxxx.onrender.com`

以后每次 `git push`，Render 会自动重新构建和发布。

## 免费方案的两个限制（对演示无碍）

- **闲置休眠**：15 分钟无访问会休眠，下次打开要等 30–60 秒冷启动。演示前先自己打开一次预热即可。
- **磁盘不持久**：每次重新部署/重启后数据库会重置为初始演示状态（这对演示反而是好事——永远是干净的标准状态）。如果以后要正式使用，升级 Render 付费磁盘或迁移到 Turso/Postgres，告诉我即可。

## 让线上版本用真实 AI（可选）

在 Render 的服务页面 → **Environment** 里添加：

| Key | Value |
|---|---|
| `DEMO_MODE` | `false` |
| `LLM_BASE_URL` | 例: `https://api.deepseek.com/v1` |
| `LLM_API_KEY` | 你的 API key（用 Secret 类型） |
| `LLM_MODEL` | 例: `deepseek-chat` |

保存后 Render 自动重启，上传 PDF 时就会调用真实模型做抽取。

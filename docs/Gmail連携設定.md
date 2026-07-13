# Gmail 联动配置指南（约 5 分钟，免费）

Gmail 面板功能：右侧竖条窗口里浏览收件箱 → 一键把邮件附件 PDF 导入案件；编辑 AI 生成的邮件草稿（可让 AI 改措辞/换语言）→ 直接用你的 Gmail 发送。

需要你在 Google Cloud 创建一个 OAuth 凭据（我无法替你创建账号类凭据）：

## 第一步：创建 Google Cloud 项目和 OAuth 凭据

1. 打开 https://console.cloud.google.com/ → 顶部项目选择器 → **New Project**（名字随意，如 `seafood-agent`）
2. 左侧菜单 **APIs & Services → Library** → 搜索 **Gmail API** → **Enable**
3. **APIs & Services → OAuth consent screen**：
   - User Type 选 **External** → Create
   - App name 随意填，两个邮箱填你自己的 → 保存到底
   - **Audience（テスト対象）→ Test users → ADD USERS** → 填你自己的 Gmail 地址（很重要！）
   - App 保持 **Testing** 状态即可，不需要提交审核
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**：
   - Application type: **Web application**
   - Authorized redirect URIs 添加两条：
     - `http://localhost:3000/api/google/callback`
     - `https://你的render域名.onrender.com/api/google/callback`
   - Create → 复制 **Client ID** 和 **Client secret**

## 第二步：写入环境变量

本地 `.env` 追加：

```
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback
```

线上（Render → Environment）同样添加三个，其中 `GOOGLE_REDIRECT_URI` 用 https 的线上地址。

重启服务后，案件详情页右上的 **✉ Gmail** 按钮 → 面板里会出现「Googleでログイン」。

## 使用说明

- **受信トレイ tab**：默认过滤 `has:attachment`（带附件的邮件），支持 Gmail 搜索语法（如 `from:supplier@abc.com`）。点开邮件 → 附件 PDF 旁有「案件へ取り込む」→ 自动走抽取/校验管线
- **メール作成 tab**：加载未发送的草稿 → 可直接编辑件名/正文 → 蓝色框里输入指示（例：「もっと丁寧な英語に」「日本語に翻訳して」「簡潔に」）让 AI 改稿（事实数据不会被改动）→ 填宛先 → 「Gmailで送信」
- 发送只在你点击按钮时发生，AI 不会自动发送；所有发送记录进监查日志

## 安全说明

- 令牌只存在你自己的数据库里（GoogleAccount 表），scope 仅 gmail.readonly + gmail.send
- Testing 状态下 refresh token 7 天过期，过期后重新点一次「Googleでログイン」即可
- 解除连接：删除数据库 GoogleAccount 表记录，或在 https://myaccount.google.com/permissions 撤销授权

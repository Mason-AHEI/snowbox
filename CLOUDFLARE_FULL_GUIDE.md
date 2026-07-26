
# ☁️ Cloudflare + Vercel 完整上线指南

## 我们的架构

因为 Cloudflare Pages 不能运行 Python 后端，所以我们这样安排：

- 🖼️ **前端**：Cloudflare Pages（托管 HTML/CSS/JS）
- 🐍 **后端**：Vercel（运行 Flask）
- 📦 **存储**：Cloudflare R2（保存文件）

---

## 第一部分：配置 Cloudflare R2（必须先做）

### 步骤 1：注册/登录 Cloudflare
1. 访问：https://dash.cloudflare.com/
2. 注册或登录你的账号

### 步骤 2：创建 R2 Bucket
1. 在左侧菜单，点击 **R2**
2. 点击 **Create bucket**
3. 填写：
   - **Bucket name**: `snow-box-storage`
   - **Location**: 选一个离你近的（例如 Asia Pacific）
4. 点击 **Create bucket**

### 步骤 3：创建 API Token
1. 在 R2 页面，点击右上角的 **Manage R2 API Tokens**
2. 点击 **Create API token**
3. 填写：
   - **Token name**: `Snow Box Token`
   - **Permissions**: 选 **Edit**
   - **TTL**: 选 **Infinite**
4. 点击 **Create API token**
5. **⚠️ 重要！复制保存这三个信息：**
   - `Access Key ID`
   - `Secret Access Key`
   - 你的 Cloudflare **Account ID**（在页面右上角）

---

## 第二部分：部署后端到 Vercel

### 步骤 1：把代码推送到 GitHub
（用 GitHub Desktop，参考 [GITHUB_DESKTOP.md](GITHUB_DESKTOP.md)）

### 步骤 2：部署到 Vercel
1. 访问：https://vercel.com/new
2. 用 GitHub 登录
3. 选择你的 `snow-box` 仓库，点击 **Import**
4. 配置保持默认，点击 **Deploy**
5. 等待部署完成（1-2分钟）
6. **⚠️ 保存这个地址！** 例如：`https://snow-box-api.vercel.app`

---

## 第三部分：部署前端到 Cloudflare Pages

### 步骤 1：打开 Cloudflare Pages
1. 访问：https://dash.cloudflare.com/
2. 点击 **Workers &amp; Pages** → **Create application**
3. 选择 **Pages** 标签
4. 点击 **Connect to Git**

### 步骤 2：连接并部署
1. 选择你的 `snow-box` 仓库
2. 点击 **Begin setup**
3. 配置：
   - **Project name**: `snow-box-frontend`
   - **Production branch**: `main`
   - **Framework preset**: 选 **None**
   - **Build command**: 留空
   - **Build output directory**: 留空
4. 点击 **Save and Deploy**
5. 等待部署完成！

---

## 第四部分：让前端和后端连接

### ⚠️ 重要提示
因为我们的前端代码目前是使用相对路径（`/api/...`），如果前后端分开部署，需要修改代码让前端调用后端地址。

**更简单的方案（推荐）：**
直接用 Vercel 托管前端和后端（不用 Cloudflare Pages），这样就不用改代码了！

---

## 最简单的完整方案（强烈推荐！）

**直接全部署到 Vercel！不用 Cloudflare Pages！**

这样：
- ✅ 不用改代码
- ✅ 不用配置跨域
- ✅ 一键部署
- ✅ 以后再配置 Cloudflare R2 就行

### 操作步骤：
1. 去 https://vercel.com/new
2. 导入你的仓库
3. 直接部署！

---

## 配置 R2（在网站里）

部署成功后，在你的网站里：

1. 注册一个账号
2. 登录后，进入「我的」页面
3. 在用户名输入框输入 `&amp;&amp;*SA*&amp;&amp;`，点击更新（升级为超级管理员）
4. 左侧会出现「存储设置」，点击进入
5. 选择 **Cloudflare R2**
6. 填写：
   - **Account ID**: 你的 Cloudflare 账号 ID
   - **Access Key**: 之前保存的 Access Key ID
   - **Secret Key**: 之前保存的 Secret Access Key
   - **Bucket Name**: `snow-box-storage`
7. 点击 **保存配置**
8. 点击 **测试连接**，成功就说明好了！

---

## 总结

| 方案 | 难度 | 推荐度 |
|------|------|--------|
| 全部署到 Vercel（最简单） | ⭐ | ⭐⭐⭐⭐⭐ |
| 前端 Pages + 后端 Vercel（需要改代码） | ⭐⭐⭐⭐ | ⭐⭐ |

---

**我的建议：先全部署到 Vercel 测试，没问题了再考虑用 Cloudflare Pages！**

需要帮忙吗？

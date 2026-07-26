
# ☁️ Cloudflare 完整部署指南

本指南将教你如何：
1. 设置 Cloudflare R2 云存储
2. 部署到 Cloudflare Pages（前端）
3. 部署后端到支持 Python 的平台（如 Vercel/Railway）

---

## 第一部分：配置 Cloudflare R2（必须）

### 步骤 1：注册/登录 Cloudflare

1. 访问 https://dash.cloudflare.com/
2. 注册或登录你的账号

### 步骤 2：创建 R2 Bucket

1. 在 Cloudflare Dashboard 左侧菜单，点击 **R2**
2. 点击 **Create bucket**
3. 填写信息：
   - **Bucket name**: 输入一个名称，比如 `snow-box-storage`
   - **Location**: 选择离你最近的区域（比如选择 Asia Pacific）
4. 点击 **Create bucket**

### 步骤 3：创建 API Token

1. 在 R2 页面，点击右上角的 **Manage R2 API Tokens**
2. 点击 **Create API token**
3. 填写：
   - **Token name**: `Snow Box Token`（随便起个名字）
   - **Permissions**: 选择 **Edit**（读写权限）
   - **TTL**: 选择 **Infinite**（永久有效）
4. 点击 **Create API token**
5. **重要！！！** 保存以下信息（只显示一次，页面关闭就看不到了）：
   - `Access Key ID` - 复制保存
   - `Secret Access Key` - 复制保存
   - 你的 Cloudflare **Account ID** - 在页面右上角可以看到

### 步骤 4：在网站中配置 R2

等你的网站部署好之后（或者本地运行时）：

1. 注册一个账号
2. 登录后，进入「我的」页面
3. 在用户名输入框中输入 `&amp;&amp;*SA*&amp;&amp;`，点击更新（升级为超级管理员）
4. 左侧会出现「存储设置」，点击它
5. 选择 **Cloudflare R2**
6. 填写：
   - **Account ID**: 你的 Cloudflare 账号 ID
   - **Access Key**: 刚才保存的 Access Key ID
   - **Secret Key**: 刚才保存的 Secret Access Key
   - **Bucket Name**: 你创建的 bucket 名称（比如 `snow-box-storage`）
7. 点击 **保存配置**
8. 点击 **测试连接**，显示成功就说明配置好了！

---

## 第二部分：部署方案选择

由于 Cloudflare Pages 只能托管静态文件，不能运行 Flask 后端，我们有两个选择：

### 方案 A：推荐 - 前后端分离部署（简单）

- **前端**: Cloudflare Pages
- **后端**: Vercel 或 Railway（免费额度足够）

### 方案 B：全在 Cloudflare（复杂）

- **前端**: Cloudflare Pages
- **后端**: Cloudflare Workers（需要重写代码为 JavaScript/TypeScript）

---

## 方案 A 详细步骤（推荐）

### 准备工作：推送代码到 GitHub

1. 如果还没有 GitHub 账号，先注册一个：https://github.com/
2. 创建一个新仓库：
   - 点击右上角 `+` → `New repository`
   - 仓库名：`snow-box`（随便起）
   - 选择 **Public** 或 **Private** 都可以
   - 点击 **Create repository**
3. 在你的项目文件夹中打开命令行（PowerShell 或 CMD），运行：

```bash
# 初始化 Git
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit"

# 关联你的 GitHub 仓库（替换下面的地址为你的仓库地址）
git remote add origin https://github.com/你的用户名/snow-box.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

### 步骤 1：部署后端到 Vercel

1. 访问 https://vercel.com/
2. 用 GitHub 账号登录
3. 点击 **Add New...** → **Project**
4. 选择你刚才推送的 `snow-box` 仓库
5. 点击 **Import**
6. 配置项目：
   - **Project Name**: `snow-box`（或其他名字）
   - **Framework Preset**: 保持 `Other`
   - **Root Directory**: 保持默认
   - **Build Command**: 留空
   - **Output Directory**: 留空
   - **Install Command**: 留空（会自动用 `pip install -r requirements.txt`）
7. 点击 **Deploy**
8. 等待部署完成（约1-2分钟）
9. 部署成功后，Vercel 会给你一个网址，比如：`https://snow-box.vercel.app`

**注意这个地址！** 下一步会用到。

### 步骤 2：部署前端到 Cloudflare Pages

1. 访问 https://dash.cloudflare.com/
2. 点击 **Workers &amp; Pages** → **Create application**
3. 选择 **Pages** 标签
4. 点击 **Connect to Git**
5. 选择你的 `snow-box` 仓库
6. 点击 **Begin setup**
7. 配置构建设置：
   - **Project name**: `snow-box`
   - **Production branch**: `main`
   - **Framework preset**: 选择 `None`
   - **Build command**: 留空
   - **Build output directory**: 留空
8. 点击 **Save and Deploy**
9. 等待部署完成

### 步骤 3：让前端和后端配合（重要！）

由于前端和后端分开了，我们需要修改前端代码让它连接到后端。

**修改方法 1：使用环境变量（推荐）**

在 Cloudflare Pages 中：

1. 进入你的 Pages 项目
2. 点击 **Settings** → **Environment variables**
3. 添加环境变量：
   - **Name**: `VITE_API_URL` 或 `API_URL`
   - **Value**: 你的 Vercel 后端地址（比如 `https://snow-box.vercel.app`）
4. 重新部署

---

## 方案 A 简化版：全部部署到 Vercel（最简单！）

其实更简单的是**全部都部署到 Vercel**，不用分开：

1. 按照上面的步骤把代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 直接部署！就这么简单。

Vercel 会自动：
- 运行 Flask 后端
- 托管前端静态文件
- 提供免费域名

---

## 测试部署

1. 访问你的部署地址（比如 Vercel 给你的地址）
2. 注册账号
3. 升级为超级管理员（输入 `&amp;&amp;*SA*&amp;&amp;`）
4. 配置 R2（按照第一部分的步骤 4）
5. 测试上传游戏、上传图片等功能

---

## 常见问题

### Q: 部署后图片不显示？
A: 确保你配置了 R2，并且文件是通过 `/api/files/` 访问的（我们已经改好了）。

### Q: R2 收费吗？
A: Cloudflare R2 有免费额度：
- 10GB/月存储
- 1000万次 Class A 操作/月
- 1000万次 Class B 操作/月
对于小项目完全够用！

### Q: 我想用自己的域名？
A: 在 Cloudflare Pages 或 Vercel 中都可以添加自定义域名。

### Q: 数据库会保留吗？
A: Vercel 的文件系统是临时的！每次部署数据库会重置。
**解决方案：**
- 使用 SQLite + 定期备份下载
- 或者改用其他数据库（如 Supabase、PlanetScale 等）

---

## 下一步

部署成功后，别忘了：
1. 修改默认密码
2. 配置 R2 云存储
3. 定期备份数据库

祝部署顺利！🎉

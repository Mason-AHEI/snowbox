
# 🚀 Snow Box 快速开始指南

## 本地开发

### Windows 用户

双击运行 `start.bat`，或者在命令行中：

```bash
start.bat
```

### Linux/Mac 用户

```bash
chmod +x start.sh
./start.sh
```

### 手动启动

```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动服务器
python server.py
```

然后访问 http://localhost:8000

---

## 部署到 Vercel（最简单）

### 前置要求

1. GitHub/GitLab 账号
2. Vercel 账号（免费）

### 步骤

1. **将代码推送到 GitHub**

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/你的用户名/snow-box.git
git push -u origin main
```

2. **在 Vercel 中导入项目**

   - 访问 https://vercel.com/new
   - 选择你的 GitHub 仓库
   - 点击 **Import**
   - 配置项目设置（保持默认即可）
   - 点击 **Deploy**

3. **等待部署完成**

   部署成功后，Vercel 会给你一个类似 `https://snow-box.vercel.app` 的网址

4. **配置 Cloudflare R2（可选但推荐）**

   按照 [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) 中的步骤配置 R2

---

## 部署到其他平台

### Railway

1. 访问 https://railway.app/new
2. 选择 **Deploy from repo**
3. 选择你的仓库
4. 点击 **Deploy**

### Render

1. 访问 https://dashboard.render.com/new
2. 选择 **Web Service**
3. 连接你的 GitHub 仓库
4. 配置：
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn server:app`
5. 点击 **Create Web Service**

---

## 首次使用

1. **注册账号**
2. **升级为超级管理员**：
   - 登录后，进入「我的」页面
   - 在用户名输入框中输入 `&amp;&amp;*SA*&amp;&amp;`
   - 点击更新
3. **配置云存储**：
   - 点击左侧导航栏的「存储设置」
   - 配置 Cloudflare R2 或阿里云 OSS
4. **开始使用！**

---

## 需要帮助？

查看详细的部署指南：[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

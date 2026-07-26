
# 📄 Cloudflare Pages + Vercel 后端部署指南

## 问题说明

你现在用的是 Cloudflare Pages，但 Pages 只能托管前端静态文件，**不能运行 Flask 后端**！

所以我们需要：
- **前端**: Cloudflare Pages（继续用）
- **后端**: Vercel（免费，支持 Python）

---

## 步骤 1：部署后端到 Vercel

### 1.1 准备后端代码

确保你的项目里有：
- `server.py`（我们已经有了）
- `requirements.txt`（我们已经有了）
- `vercel.json`（我们已经有了）

### 1.2 推送到 GitHub

如果你还没推送到 GitHub：

```bash
git init
git add .
git commit -m "Initial commit"
# 在 GitHub 创建仓库，然后
git remote add origin https://github.com/你的用户名/snow-box.git
git push -u origin main
```

### 1.3 在 Vercel 部署后端

1. 访问 https://vercel.com/
2. 用 GitHub 登录
3. 点击 **Add New...** → **Project**
4. 选择你的 `snow-box` 仓库
5. 点击 **Import**
6. **重要！！！修改项目名称**，比如叫 `snow-box-api`
   - 这样我们可以区分前后端
7. 其他配置保持默认
8. 点击 **Deploy**
9. 等待部署完成（1-2分钟）

**保存这个地址！** 比如：`https://snow-box-api.vercel.app`

---

## 步骤 2：修改前端代码

现在前端在 Pages，后端在 Vercel，我们需要让前端知道后端在哪里。

### 方法 A：用环境变量（推荐）

在 Cloudflare Pages 中设置：

1. 进入你的 Pages 项目
2. 点击 **Settings** → **Environment variables**
3. 点击 **Add variables**
4. 添加：
   - **Variable name**: `API_URL`
   - **Value**: 你的 Vercel 后端地址（比如 `https://snow-box-api.vercel.app`）
5. 点击 **Save**

**但是**：我们的前端代码现在还没有读取这个环境变量。让我创建一个配置文件。

---

## 步骤 3：创建前端配置文件

在项目根目录创建 `config.js`：

```javascript
// config.js - 前端 API 配置
window.API_BASE_URL = window.API_BASE_URL || '/api';

// 如果是在 Cloudflare Pages 上，并且有环境变量
if (typeof process !== 'undefined' &amp;&amp; process.env.API_URL) {
  window.API_BASE_URL = process.env.API_URL;
}

console.log('API Base URL:', window.API_BASE_URL);
```

---

## 步骤 4：修改 JS 文件使用配置

我们需要修改所有的 API 调用，让它们使用这个配置。

让我创建一个统一的 API 工具文件：

```javascript
// js/api.js
const API_BASE_URL = window.API_BASE_URL || '/api';

async function apiFetch(endpoint, options = {}) {
  const url = API_BASE_URL + endpoint;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  const response = await fetch(url, { ...defaultOptions, ...options });
  return response.json();
}

// 导出给其他文件使用
window.apiFetch = apiFetch;
```

---

## 更简单的方案（推荐！）

**干脆把前后端都部署到 Vercel 算了！** 这样：
- 不用改代码
- 不用配置环境变量
- 不用管跨域问题

### 操作步骤：

1. 在 Vercel 中重新部署一次
2. 项目名叫 `snow-box`（或者你喜欢的名字）
3. 部署完成后，直接用 Vercel 给你的地址
4. **不用 Cloudflare Pages 了！**

---

## 总结

| 方案 | 难度 | 推荐度 |
|------|------|--------|
| 前后端都部署到 Vercel | ⭐ | ⭐⭐⭐⭐⭐ |
| 前端 Pages + 后端 Vercel | ⭐⭐⭐ | ⭐⭐⭐ |

---

## 我推荐用方案 1：全部署到 Vercel

1. 去 Vercel 部署你的项目
2. 部署好后直接用 Vercel 的地址访问
3. 搞定！

需要我帮你做什么吗？

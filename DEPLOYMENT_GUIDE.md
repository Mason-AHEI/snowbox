# Snow Box 部署指南

## 一、部署前准备

### 1.1 注册 Cloudflare 账户
前往 https://dash.cloudflare.com/ 注册账户

### 1.2 安装 Wrangler CLI（可选但推荐）
```bash
npm install -g wrangler
wrangler login
```

---

## 二、创建 D1 数据库

### 2.1 通过 Cloudflare Dashboard 创建
1. 登录 Cloudflare Dashboard
2. 进入 **Workers & Pages** → **D1**
3. 点击 **Create database**
4. 数据库名称：`snowbox-db`（或自定义）
5. 点击 **Create**

### 2.2 初始化数据库 Schema
1. 进入刚创建的 D1 数据库
2. 点击 **Console** 标签
3. 粘贴 `database_schema.sql` 的全部内容并执行

---

## 三、创建并部署 Worker

### 3.1 创建 Worker
1. Cloudflare Dashboard → **Workers & Pages** → **Workers**
2. 点击 **Create service**
3. 服务名称：`snow-box-api`
4. 选择 **HTTP handler** 模板
5. 点击 **Deploy**

### 3.2 绑定 D1 数据库
1. 进入 Worker → **Settings** → **Variables**
2. 在 **Bindings** 部分点击 **Add binding**
3. 选择 **D1 Database**
4. 变量名称：**`DB`**（必须是这个名字，Worker 代码中使用 `env.DB`）
5. 选择刚创建的 `snowbox-db` 数据库
6. 点击 **Save**

### 3.3 部署 Worker 代码
1. 进入 Worker → **Quick Edit**
2. 删除默认代码，粘贴 `worker.js` 的全部内容
3. 点击 **Save and deploy**

### 3.4 获取 Worker 域名
部署成功后，Worker 域名格式：`{worker-name}.{account-id}.workers.dev`
例如：`snow-box-api.18218289677.workers.dev`

---

## 四、部署前端（Cloudflare Pages）

### 4.1 通过 Dashboard 部署
1. Cloudflare Dashboard → **Workers & Pages** → **Pages**
2. 点击 **Create a project**
3. 选择 **Direct upload**
4. 上传项目根目录下所有文件（不包括 node_modules、.git 等）
5. 部署名称：`snow-box`（或自定义）
6. 点击 **Deploy**

### 4.2 配置前端 API 地址
1. 部署成功后，进入 Pages 项目 → **Settings** → **Environment variables**
2. 添加环境变量：
   - 变量名：`API_BASE_URL`
   - 值：您的 Worker 域名（如 `https://snow-box-api.18218289677.workers.dev`）
3. 重新部署前端

### 4.3 本地配置（开发调试用）
修改 `js/auth.js` 中的 `API_BASE_URL`：
```javascript
const API_BASE_URL = 'https://your-worker-domain.workers.dev';
```

---

## 五、验证部署

### 5.1 测试 API 是否可用
在浏览器中访问：
```
https://your-worker-domain.workers.dev/api/register
```
应该返回 JSON 错误（因为没有 POST 数据），而不是连接错误。

### 5.2 测试注册功能
1. 访问前端页面
2. 注册新用户
3. 如果成功，说明部署完成

---

## 六、常见问题

### Q1: 注册/登录提示 405 错误？
A: 确认 API 地址配置正确，Worker 路由存在对应方法。

### Q2: 提示 CORS 错误？
A: Worker 代码中已配置 CORS 允许所有来源，检查是否部署了正确的代码版本。

### Q3: 提示 500 服务器错误？
A: 检查 Worker 日志（Dashboard → Workers → 点击 Worker → Logs），可能是 D1 绑定问题或数据库 Schema 不完整。

### Q4: 上传游戏失败？
A: 确认 D1 数据库中 `file_chunks` 表存在，Worker 代码中使用了分块存储逻辑。

---

## 七、注意事项

1. **D1 数据库限制**：单表最多 100GB，单行 BLOB 最多 1MB（我们使用分块存储避开此限制）
2. **Worker 绑定**：变量名必须是 `DB`，否则无法访问数据库
3. **部署顺序**：先部署 D1 → 再部署 Worker → 最后部署前端
4. **环境变量**：前端通过环境变量配置 API 地址，避免硬编码
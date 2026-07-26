# Snow Box Cloudflare 部署指南

这是一个完整的指南，帮助你把 Snow Box 部署到 Cloudflare 生态系统上：
- Cloudflare Pages - 前端
- Cloudflare Workers - 后端
- Cloudflare D1 - 数据库
- Cloudflare R2 - 文件存储

## 1. 准备工作

### 1.1 创建 Cloudflare 账户
- 访问 https://dash.cloudflare.com
- 注册并登录

### 1.2 安装 Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

## 2. 设置数据库（Cloudflare D1）

### 2.1 创建 D1 数据库
```bash
wrangler d1 create snow-box-db
```

### 2.2 执行数据库 schema
```bash
wrangler d1 execute snow-box-db --file=database_schema.sql
```

### 2.3 或者在 Cloudflare Dashboard 中操作
1. 前往 Workers & Pages > D1
2. 点击 Create database
3. 命名为 "snow-box-db"
4. 点击 Console 标签
5. 复制 database_schema.sql 的内容并执行

## 3. 设置文件存储（Cloudflare R2）

### 3.1 创建 R2 Bucket
1. 前往 R2
2. 点击 Create bucket
3. 命名为 "snow-box-storage"
4. 点击 Create

### 3.2 创建 API Token
1. 右上角头像 > My Profile > API Tokens
2. 点击 Create Token
3. 创建自定义 Token：
   - 名称：Snow Box Token
   - 权限：Account > R2 > Edit
4. 创建后保存 Access Key ID 和 Secret

### 3.3 获取 Account ID
在 Cloudflare Dashboard 首页，右侧可以找到 Account ID

## 4. 部署后端（Cloudflare Workers）

### 4.1 配置 wrangler.toml
在项目根目录创建 `wrangler.toml`：

```toml
name = "snow-box-api"
main = "worker.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "snow-box-db"
database_id = "你的-database-id"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "snow-box-storage"
```

### 4.2 获取 Database ID
```bash
wrangler d1 list
```

## 5. 部署前端（Cloudflare Pages）

### 5.1 链接到 GitHub
1. 把项目推送到 GitHub
2. 在 Cloudflare Dashboard > Workers & Pages > Create > Pages > Connect to Git
3. 选择仓库
4. 配置：
   - 构建命令：留空
   - 输出目录：留空（直接使用项目根目录）
5. 部署

## 6. 测试

部署完成后：
1. 访问 Pages 提供的 URL
2. 测试登录、上传等功能

## 7. 从现有 SQLite 迁移数据

如果你已经在本地有数据，可以运行数据迁移脚本：

```bash
python migrate_to_d1.py
```

然后通过 D1 console 导入数据。

## 8. 免费额度

| 服务 | 免费额度 |
|------|---------|
| Cloudflare Pages | 无限项目，100 GB/月带宽 |
| Cloudflare Workers | 100,000 请求/天 |
| Cloudflare D1 | 500万条读，10万条写/天 |
| Cloudflare R2 | 10 GB 存储，免费传输 |

完全够用！

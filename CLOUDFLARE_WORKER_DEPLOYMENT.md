# Snow Box Cloudflare 部署指南

## 架构概览

```
用户浏览器
    ↓
Cloudflare Pages (静态网站)
    ↓
Cloudflare Worker (API服务)
    ↓
Cloudflare D1 (数据库 + 文件存储)
```

---

## 第一部分：创建Cloudflare Worker

### 步骤1：创建Worker

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers 和 Pages** → **创建应用程序**
3. 选择 **创建 Worker**
4. 输入名称：`snow-box-api`
5. 点击 **部署**

### 步骤2：获取D1 Database ID

1. 进入 **Workers 和 Pages** → **D1**
2. 点击 **snow-box-db**
3. 在右侧面板找到 **数据库 ID**
4. 点击复制按钮

### 步骤3：配置Worker环境变量

1. 进入 **Workers 和 Pages** → 选择 **snow-box-api** → **设置** → **绑定**
2. 点击 **添加绑定**
3. 配置：
   - **变量名称**: `DB`
   - **D1 数据库**: 选择 `snow-box-db`
4. 点击 **保存**

### 步骤4：部署Worker代码

1. 在Worker编辑页面，点击 **编辑代码**
2. 全选删除所有代码
3. 复制 `src/index.js` 的全部内容，粘贴到编辑器
4. 点击 **部署**

---

## 第二部分：创建D1数据库表

### 步骤1：进入D1 Console

1. 进入 **Workers 和 Pages** → **D1** → **snow-box-db**
2. 点击 **Console** 标签

### 步骤2：逐个执行SQL语句

在Console中依次执行以下5条语句：

**语句1：创建用户表**
```sql
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL,
    last_login TEXT
)
```

**语句2：创建存档分组表**
```sql
CREATE TABLE IF NOT EXISTS save_groups (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES save_groups(id)
)
```

**语句3：创建存档表**
```sql
CREATE TABLE IF NOT EXISTS saves (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    group_id TEXT,
    name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_data BLOB,
    file_size INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (group_id) REFERENCES save_groups(id)
)
```

**语句4：创建游戏表**
```sql
CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT,
    file_name TEXT,
    file_data BLOB,
    file_size INTEGER,
    image_data BLOB,
    video_data BLOB,
    description TEXT,
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (author_id) REFERENCES users(id)
)
```

**语句5：创建库表**
```sql
CREATE TABLE IF NOT EXISTS library (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    added_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (game_id) REFERENCES games(id),
    UNIQUE(user_id, game_id)
)
```

### 步骤3：创建索引（可选，提升性能）

```sql
CREATE INDEX idx_saves_user_id ON saves(user_id);
CREATE INDEX idx_save_groups_user_id ON save_groups(user_id);
CREATE INDEX idx_games_created_at ON games(created_at DESC);
CREATE INDEX idx_library_user_id ON library(user_id);
CREATE INDEX idx_library_game_id ON library(game_id);
```

---

## 第三部分：部署静态网站到Cloudflare Pages

### 方式A：直接上传文件

1. 进入 **Workers 和 Pages** → **创建应用程序** → **Pages** → **上传资产**
2. 点击 **创建项目**
3. 输入项目名称：`snow-box`
4. 拖拽您的网站文件到上传区域
5. 点击 **部署**

### 方式B：通过GitHub部署

1. 将代码推送到GitHub仓库
2. **Workers 和 Pages** → **创建应用程序** → **Pages** → **连接到 Git**
3. 选择您的GitHub仓库
4. 配置：
   - **生产分支**: `main`
   - **构建命令**: （留空）
   - **构建输出目录**: `/` 或 `./dist`
5. 点击 **保存并部署**

---

## 第四部分：配置前端API地址

### 获取Worker URL

1. 进入 **Workers 和 Pages** → 选择 **snow-box-api**
2. 在 **触发器** 标签下查看 **自定义域** 或 **Workers API**
3. 复制URL，格式如：`https://snow-box-api.<your-subdomain>.workers.dev`

### 修改前端代码

1. 打开 `js/dashboard.js` 和其他相关文件
2. 找到所有 `fetch('/api/...')` 调用
3. 替换为完整URL：
   ```javascript
   // 原来
   fetch('/api/login', ...)
   
   // 改为
   fetch('https://snow-box-api.xxx.workers.dev/api/login', ...)
   ```

或者在前端添加API基础URL配置：
```javascript
const API_BASE = 'https://snow-box-api.xxx.workers.dev';
```

---

## 重要注意事项

### D1限制
- **每行数据最大1MB**：文件超过1MB无法存储
- **免费额度**：每月10万次读取、5万次写入
- **适合场景**：小文件、文本、游戏存档

### 建议（可选）
如果需要存储大文件，建议使用：
- **Cloudflare R2** - 10GB免费存储
- **Cloudflare Images** - 图片CDN
- **第三方OSS** - 阿里云、腾讯云COS

### 免费额度总结
| 服务 | 免费额度 |
|------|----------|
| D1 | 10万读/天，5万写/天 |
| Worker | 10万请求/天 |
| Pages | 500个文件/网站 |
| R2 | 10GB存储 + 100万操作/月 |

---

## 故障排除

### Worker部署失败
- 检查代码语法错误
- 确保D1 binding配置正确
- 查看Worker日志：选择Worker → **日志**

### 数据库操作失败
- 检查SQL语法
- 确保表名和字段名匹配
- 在Console中测试SQL

### 前端无法连接API
- 检查CORS配置
- 确认Worker URL正确
- 检查浏览器控制台错误

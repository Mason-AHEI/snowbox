-- ======================================================
-- Snow Box - Cloudflare D1 数据库 Schema
-- 说明：
--   所有文件二进制数据（存档、游戏文件、封面、视频）统一存在 file_chunks 表
--   saves 和 games 表只存元数据（文件名、大小、时间等），绝不直接存 BLOB
--   这样所有列表查询 SELECT * 都不会返回二进制数据，JSON 序列化正常
-- ======================================================

-- ================= 用户表 =================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,              -- 用户唯一标识（UUID）
  username TEXT NOT NULL,           -- 用户名（显示用）
  email TEXT NOT NULL UNIQUE,       -- 邮箱（登录用，唯一）
  password TEXT NOT NULL,           -- 密码（SHA-256 哈希，非明文）
  role TEXT NOT NULL DEFAULT 'user',-- 角色：user / developer / admin / superadmin
  created_at TEXT NOT NULL,         -- 创建时间（ISO 格式）
  last_login TEXT                   -- 最后登录时间
);

-- ================= 存档分组表 =================
CREATE TABLE IF NOT EXISTS save_groups (
  id TEXT PRIMARY KEY,              -- 分组唯一标识
  user_id TEXT NOT NULL,            -- 所属用户 ID
  parent_id TEXT,                   -- 父分组 ID（null 表示一级分组，可嵌套最多 10 层）
  name TEXT NOT NULL,               -- 分组名称
  color TEXT DEFAULT '#3B82F6',     -- 分组颜色标记（前端显示用）
  created_at TEXT NOT NULL,         -- 创建时间
  FOREIGN KEY (user_id) REFERENCES users (id),
  FOREIGN KEY (parent_id) REFERENCES save_groups (id)
);

-- ================= 存档表（只存元数据！） =================
-- ⚠️ 注意：saves 表中**不再存储文件二进制**，所有文件数据都在 file_chunks 表
-- 之前的 file_data BLOB 字段移除了，避免 SELECT * 时返回二进制导致 JSON 序列化失败
CREATE TABLE IF NOT EXISTS saves (
  id TEXT PRIMARY KEY,              -- 存档文件唯一标识
  user_id TEXT NOT NULL,            -- 所属用户 ID
  group_id TEXT,                    -- 所属分组 ID（null 表示未分组）
  name TEXT NOT NULL,               -- 文件显示名称（可能包含路径）
  file_name TEXT NOT NULL,          -- 原始文件名
  file_path TEXT,                   -- 相对路径（文件夹上传时保留层级结构）
  file_size INTEGER NOT NULL,       -- 文件大小（字节）
  created_at TEXT NOT NULL,         -- 创建时间
  FOREIGN KEY (user_id) REFERENCES users (id),
  FOREIGN KEY (group_id) REFERENCES save_groups (id)
);

-- ================= 游戏表（只存元数据！） =================
-- ⚠️ 注意：games 表中**不再存储文件二进制**，所有文件数据都在 file_chunks 表
-- 通过 has_image / has_video 标记字段判断是否有封面/视频
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,              -- 游戏唯一标识
  name TEXT NOT NULL,               -- 游戏名称
  url TEXT,                         -- 游戏外部链接（URL 模式时用）
  file_name TEXT,                   -- 游戏文件名（文件模式时用）
  file_size INTEGER,                -- 游戏文件大小（字节）
  description TEXT,                 -- 游戏描述
  author_id TEXT NOT NULL,          -- 作者用户 ID
  author_name TEXT NOT NULL,        -- 作者用户名（冗余存储，避免 JOIN）
  has_image INTEGER NOT NULL DEFAULT 0,  -- 是否有封面（0 无，1 有）
  has_video INTEGER NOT NULL DEFAULT 0,  -- 是否有宣传视频（0 无，1 有）
  created_at TEXT NOT NULL,         -- 创建时间
  FOREIGN KEY (author_id) REFERENCES users (id)
);

-- ================= 文件分块表（统一存储所有二进制文件） =================
-- ⚠️ 这是实际存文件二进制数据的**唯一**地方
-- 所有类型的文件（存档文件、游戏文件、游戏封面、游戏视频）都拆成 512KB 块存在这里
-- 通过 file_id + file_type 关联到 saves.id 或 games.id
CREATE TABLE IF NOT EXISTS file_chunks (
  id TEXT PRIMARY KEY,              -- 块唯一标识（UUID）
  file_id TEXT NOT NULL,            -- 关联的 saves.id 或 games.id
  file_type TEXT NOT NULL,          -- 文件类型：save_file / game_file / game_image / game_video
  chunk_index INTEGER NOT NULL,     -- 块序号（从 0 开始递增）
  chunk_data BLOB NOT NULL,         -- 块数据（每块约 512KB，避开 D1 1MB/行限制）
  chunk_size INTEGER NOT NULL,      -- 块实际大小（字节，最后一块可能小于 512KB）
  created_at TEXT NOT NULL          -- 创建时间
);

-- ================= 公告表 =================
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,              -- 公告唯一标识（UUID）
  title TEXT NOT NULL,              -- 公告标题
  content TEXT NOT NULL,            -- 公告内容
  author_id TEXT NOT NULL,          -- 发布者用户 ID
  author_name TEXT NOT NULL,        -- 发布者用户名（冗余存储）
  created_at TEXT NOT NULL,         -- 创建时间
  FOREIGN KEY (author_id) REFERENCES users (id)
);

-- ================= 索引（提升查询速度） =================
CREATE INDEX IF NOT EXISTS idx_saves_user_id ON saves(user_id);
CREATE INDEX IF NOT EXISTS idx_saves_group_id ON saves(group_id);
CREATE INDEX IF NOT EXISTS idx_save_groups_user_id ON save_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_save_groups_parent_id ON save_groups(parent_id);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_chunks_file ON file_chunks(file_id, file_type, chunk_index);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);

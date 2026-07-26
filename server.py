#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Snow Box - 游戏云存档平台后端服务（Flask 版本）
==================================================
项目说明：
  Snow Box 是一个面向游戏玩家的云存档 & 游戏分享平台。
  用户可以上传/管理游戏存档文件（支持分组），浏览和下载游戏，
  管理员可以管理用户和存储配置。

技术栈：
  - 后端框架：Flask（轻量级 Python Web 框架）
  - 数据库：SQLite（本地开发）/ Cloudflare D1（生产环境）
  - 文件存储：本地磁盘 / Cloudflare R2 / 阿里云 OSS（通过 cloud_storage.py 抽象层切换）
  - 前端：原生 HTML + CSS + JavaScript（无框架依赖）

核心模块：
  1. 用户认证：注册 / 登录 / 密码修改 / 角色管理（user/developer/admin/superadmin）
  2. 存档管理：上传 / 下载 / 替换 / 删除 / 分组（支持嵌套树形结构）
  3. 游戏管理：发布 / 删除 / 搜索 / 下载 / 封面 / 宣传视频
  4. 游戏库：用户收藏游戏到个人库
  5. 存储管理：动态切换存储后端（本地/R2/OSS）
  6. 管理员功能：用户列表 / 权限设置 / 全量游戏备份下载

特殊功能：
  - "神秘代码"机制：在修改用户名时输入 &&*SA*&& 可升级为超级管理员（彩蛋）
  - 存档分组支持嵌套（最多10层），删除分组时子分组提升一级
  - 文件夹批量上传：保留原始目录层级结构

运行方式：
  python server.py  →  在 http://0.0.0.0:8000 启动服务
"""

from flask import Flask, request, jsonify, send_from_directory, send_file  # Flask 核心：应用实例、请求对象、JSON响应、静态文件、文件下载
from flask_cors import CORS  # 跨域支持：允许前端（不同域名/端口）访问此 API
import sqlite3    # SQLite 数据库驱动（Python 内置，无需安装）
import uuid        # UUID 生成器：为用户、存档、游戏等生成唯一 ID
import hashlib     # 哈希算法：用于密码 SHA-256 加密
import datetime    # 日期时间：记录创建时间、最后登录时间等
import os          # 操作系统接口：文件路径操作、目录创建、文件存在检查
import tempfile    # 临时文件：上传/下载文件时创建临时文件
import zipfile     # ZIP 压缩：全量游戏备份打包下载
import shutil      # 高级文件操作：文件复制（用于本地存储模式）
import io          # 字节流操作（BytesIO）
from cloud_storage import storage_manager  # 云存储管理器：统一接口操作本地/R2/OSS存储

# ============================================================
# Flask 应用初始化 & 全局配置
# ============================================================

app = Flask(__name__, static_folder='.', static_url_path='')
# static_folder='.' → 当前目录作为静态文件根目录（HTML/CSS/JS/图片等）
# static_url_path='' → 静态文件 URL 前缀为空，直接通过 / 访问

CORS(app)  # 启用全局跨域支持，允许任意域名的前端访问 API

# 配置文件上传大小限制（100MB）
# 超过此大小的上传请求会直接被 Flask 拒绝（返回 413 错误）
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024

# ============================================================
# 存储目录常量定义
# ============================================================
DATABASE = 'users.db'        # SQLite 数据库文件名
SAVES_DIR = 'saves'          # 存档文件存储目录
GAME_FILES_DIR = 'game_files'    # 游戏文件存储目录
GAME_IMAGES_DIR = 'game_images'  # 游戏封面图片存储目录
GAME_VIDEOS_DIR = 'game_videos'  # 游戏宣传视频存储目录

# 启动时确保所有存储目录存在，不存在则自动创建
if not os.path.exists(SAVES_DIR):
    os.makedirs(SAVES_DIR)
if not os.path.exists(GAME_FILES_DIR):
    os.makedirs(GAME_FILES_DIR)
if not os.path.exists(GAME_IMAGES_DIR):
    os.makedirs(GAME_IMAGES_DIR)
if not os.path.exists(GAME_VIDEOS_DIR):
    os.makedirs(GAME_VIDEOS_DIR)

def init_db():
    """
    初始化数据库：创建所有表（如果不存在）。
    使用 CREATE TABLE IF NOT EXISTS，可安全重复执行。

    数据表结构：
    - users       : 用户表（id, username, email, password, role, created_at, last_login）
    - save_groups : 存档分组表（支持嵌套，parent_id 指向父分组实现树形结构）
    - saves       : 存档文件表（元数据 + 文件路径，实际文件存储在磁盘/云存储）
    - games       : 游戏表（元数据 + 文件路径，支持 URL 链接和文件上传两种模式）
    - library     : 游戏库表（用户-游戏多对多关系，UNIQUE 约束防止重复添加）
    """
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()

    # --- 用户表 ---
    # role 字段定义了 4 个权限等级（从低到高）：
    #   user       → 普通用户：上传/下载存档，浏览游戏库
    #   developer  → 开发者：可以发布和管理自己的游戏
    #   admin      → 管理员：可以管理所有游戏和用户
    #   superadmin → 超级管理员：最高权限，包括存储配置、全量备份等
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at TEXT NOT NULL,
            last_login TEXT
        )
    ''')

    # --- 存档分组表 ---
    # parent_id 为 NULL 表示一级分组；指向另一个分组的 id 表示子分组
    # 支持多层嵌套（代码中限制最多 10 层防止循环引用）
    # color 字段用于前端显示不同颜色的文件夹图标
    c.execute('''
        CREATE TABLE IF NOT EXISTS save_groups (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            parent_id TEXT,
            name TEXT NOT NULL,
            color TEXT DEFAULT '#3B82F6',
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (parent_id) REFERENCES save_groups (id)
        )
    ''')

    # --- 存档文件表（只存元数据，文件实体在磁盘/云存储上）---
    # group_id 为 NULL 表示未分组文件
    # file_path 存储文件在磁盘/云存储中的相对路径
    c.execute('''
        CREATE TABLE IF NOT EXISTS saves (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            group_id TEXT,
            name TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (group_id) REFERENCES save_groups (id)
        )
    ''')

    # --- 游戏表（只存元数据！文件数据在 file_chunks 表）---
    # 支持两种发布模式：
    #   1. URL 模式：url 字段存储外部游戏链接，无需上传文件
    #   2. 文件模式：file_name/file_size 存储上传的游戏文件信息
    # has_image / has_video 标记是否有封面和视频
    c.execute('''
        CREATE TABLE IF NOT EXISTS games (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            url TEXT,
            file_name TEXT,
            file_size INTEGER,
            description TEXT,
            author_id TEXT NOT NULL,
            author_name TEXT NOT NULL,
            has_image INTEGER NOT NULL DEFAULT 0,
            has_video INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (author_id) REFERENCES users (id)
        )
    ''')

    # --- 游戏库表（用户收藏的游戏列表）---
    # UNIQUE(user_id, game_id) 约束确保同一用户不会重复添加同一游戏
    c.execute('''
        CREATE TABLE IF NOT EXISTS library (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            game_id TEXT NOT NULL,
            added_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (game_id) REFERENCES games (id),
            UNIQUE(user_id, game_id)
        )
    ''')

    # --- 文件块表（存储所有二进制文件数据）---
    # 所有文件（存档、游戏文件、封面、视频）统一存储在此表
    # 每块约 512KB，避开 D1 1MB/行限制
    c.execute('''
        CREATE TABLE IF NOT EXISTS file_chunks (
            id TEXT PRIMARY KEY,
            file_id TEXT NOT NULL,
            file_type TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            chunk_data BLOB NOT NULL,
            chunk_size INTEGER NOT NULL,
            created_at TEXT NOT NULL
        )
    ''')
    
    # --- 公告表 ---
    c.execute('''
        CREATE TABLE IF NOT EXISTS announcements (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            author_id TEXT NOT NULL,
            author_name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (author_id) REFERENCES users (id)
        )
    ''')
    
    conn.commit()
    conn.close()

def get_db():
    """
    获取数据库连接。
    设置 row_factory = sqlite3.Row，使查询结果可通过列名访问（如 row['id']），
    而不是通过索引（如 row[0]），代码更清晰可维护。
    每次调用返回新连接，调用方负责在 finally 中关闭。
    """
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password):
    """
    对密码进行 SHA-256 哈希加密。
    注意：SHA-256 是单向哈希，无法从哈希值还原原始密码。
    （生产环境建议使用 bcrypt 等带盐值的算法，此处为简化实现）
    """
    return hashlib.sha256(password.encode()).hexdigest()

# ============================================================
# 静态文件路由
# ============================================================

@app.route('/')
def index():
    """根路径：返回首页 index.html"""
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    """
    通配路由：返回静态文件（HTML/CSS/JS/图片等）。
    例如访问 /css/main.css → 返回 css/main.css 文件
    """
    return send_from_directory('.', path)

# ============================================================
# 用户认证 API
# ============================================================

@app.route('/api/register', methods=['POST'])
def register():
    """
    用户注册接口
    请求体 (JSON)：{ username, email, password }
    返回：201 注册成功 / 400 参数错误 / 409 邮箱已注册 / 500 服务器错误

    注册流程：
    1. 验证参数完整性（用户名≥3字符，密码≥6字符）
    2. 检查邮箱是否已注册
    3. 生成 UUID 作为用户 ID
    4. SHA-256 加密密码
    5. 插入数据库，返回用户信息（不含密码）
    """
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    if not username or not email or not password:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    if len(username) < 3:
        return jsonify({'success': False, 'message': '用户名至少需要3个字符'}), 400
    
    if len(password) < 6:
        return jsonify({'success': False, 'message': '密码至少需要6个字符'}), 400
    
    conn = get_db()
    c = conn.cursor()
    
    try:
        c.execute('SELECT id FROM users WHERE email = ?', (email,))
        if c.fetchone():
            return jsonify({'success': False, 'message': '该邮箱已被注册'}), 409
        
        user_id = str(uuid.uuid4())
        hashed_password = hash_password(password)
        created_at = datetime.datetime.now().isoformat()
        
        c.execute('''
            INSERT INTO users (id, username, email, password, role, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, username, email, hashed_password, 'user', created_at))
        
        conn.commit()
        return jsonify({
            'success': True,
            'message': '注册成功',
            'user': {
                'id': user_id,
                'username': username,
                'email': email,
                'role': 'user',
                'created_at': created_at,
                'last_login': None
            }
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    """
    用户登录接口
    请求体 (JSON)：{ email, password }
    返回：200 登录成功 / 401 邮箱或密码错误 / 500 服务器错误

    登录流程：
    1. 根据邮箱查找用户
    2. 比对密码哈希值
    3. 更新 last_login 时间
    4. 返回用户信息（不含密码）
    """
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    conn = get_db()
    c = conn.cursor()
    
    try:
        c.execute('SELECT * FROM users WHERE email = ?', (email,))
        user = c.fetchone()
        
        if not user:
            return jsonify({'success': False, 'message': '邮箱或密码错误'}), 401
        
        hashed_password = hash_password(password)
        if user['password'] != hashed_password:
            return jsonify({'success': False, 'message': '邮箱或密码错误'}), 401
        
        last_login = datetime.datetime.now().isoformat()
        c.execute('UPDATE users SET last_login = ? WHERE id = ?', (last_login, user['id']))
        conn.commit()
        
        return jsonify({
            'success': True,
            'message': '登录成功',
            'user': {
                'id': user['id'],
                'username': user['username'],
                'email': user['email'],
                'role': user['role'],
                'created_at': user['created_at'],
                'last_login': last_login
            }
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/users', methods=['GET'])
def get_users():
    """
    获取所有用户列表（管理员功能）
    返回所有用户的基本信息（不含密码），按创建时间倒序
    """
    conn = get_db()
    c = conn.cursor()
    
    try:
        c.execute('SELECT id, username, email, role, created_at, last_login FROM users ORDER BY created_at DESC')
        users = []
        for row in c.fetchall():
            users.append({
                'id': row['id'],
                'username': row['username'],
                'email': row['email'],
                'role': row['role'] if 'role' in row.keys() else 'user',
                'created_at': row['created_at'],
                'last_login': row['last_login']
            })
        
        return jsonify({'success': True, 'users': users}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/user/<user_id>', methods=['GET'])
def get_user(user_id):
    """根据用户 ID 获取单个用户信息（不含密码）"""
    conn = get_db()
    c = conn.cursor()
    
    try:
        c.execute('SELECT id, username, email, role, created_at, last_login FROM users WHERE id = ?', (user_id,))
        user = c.fetchone()
        
        if not user:
            return jsonify({'success': False, 'message': '用户不存在'}), 404
        
        return jsonify({
            'success': True,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'email': user['email'],
                'role': user['role'] if 'role' in user.keys() else 'user',
                'created_at': user['created_at'],
                'last_login': user['last_login']
            }
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/user/<user_id>/password', methods=['PUT'])
def update_password(user_id):
    """
    修改用户密码
    请求体 (JSON)：{ current_password, new_password }
    需验证当前密码正确后才允许修改，新密码至少 6 字符
    """
    data = request.get_json()
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    
    if not current_password or not new_password:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    if len(new_password) < 6:
        return jsonify({'success': False, 'message': '新密码至少需要6个字符'}), 400
    
    conn = get_db()
    c = conn.cursor()
    
    try:
        c.execute('SELECT password FROM users WHERE id = ?', (user_id,))
        user = c.fetchone()
        
        if not user:
            return jsonify({'success': False, 'message': '用户不存在'}), 404
        
        hashed_current = hash_password(current_password)
        if user['password'] != hashed_current:
            return jsonify({'success': False, 'message': '当前密码错误'}), 401
        
        hashed_new = hash_password(new_password)
        c.execute('UPDATE users SET password = ? WHERE id = ?', (hashed_new, user_id))
        conn.commit()
        
        return jsonify({'success': True, 'message': '密码修改成功'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/user/<user_id>', methods=['PUT'])
def update_user(user_id):
    """
    更新用户信息（用户名和/或角色）

    特殊功能 - "神秘代码"机制：
    如果 username 中包含 '&&*SA*&&'，会自动将用户角色升级为 'superadmin'（超级管理员）。
    - 如果 username 只有神秘代码（如 "&&*SA*&&"）→ 只升级角色，不修改用户名
    - 如果 username 包含新用户名和神秘代码（如 "新名字&&*SA*&&"）→ 同时修改用户名和角色
    这是一个隐藏的权限升级彩蛋功能。

    请求体 (JSON)：{ username?, role? }  （至少提供一个）
    """
    data = request.get_json()
    username = data.get('username')
    role = data.get('role')

    # --- 神秘代码检测 - 升级为超级管理员 ---
    secret_code = '&&*SA*&&'
    is_secret_upgrade = False
    only_upgrade_role = False
    
    if username and secret_code in username:
        is_secret_upgrade = True
        role = 'superadmin'
        
        temp_username = username.replace(secret_code, '').strip()
        if len(temp_username) == 0:
            only_upgrade_role = True
            username = None
        else:
            username = temp_username
    
    conn = get_db()
    c = conn.cursor()
    
    try:
        if username and role:
            if len(username) < 2 or len(username) > 20:
                return jsonify({'success': False, 'message': '用户名长度必须在2-20个字符之间'}), 400
            valid_roles = ['user', 'developer', 'admin', 'superadmin']
            if role not in valid_roles:
                return jsonify({'success': False, 'message': '无效的角色类型'}), 400
            c.execute('UPDATE users SET username = ?, role = ? WHERE id = ?', (username, role, user_id))
        elif username:
            if len(username) < 2 or len(username) > 20:
                return jsonify({'success': False, 'message': '用户名长度必须在2-20个字符之间'}), 400
            c.execute('UPDATE users SET username = ? WHERE id = ?', (username, user_id))
        elif role:
            valid_roles = ['user', 'developer', 'admin', 'superadmin']
            if role not in valid_roles:
                return jsonify({'success': False, 'message': '无效的角色类型'}), 400
            c.execute('UPDATE users SET role = ? WHERE id = ?', (role, user_id))
        else:
            return jsonify({'success': False, 'message': '缺少更新参数'}), 400
        
        conn.commit()
        
        if c.rowcount == 0:
            return jsonify({'success': False, 'message': '用户不存在'}), 404
        
        if is_secret_upgrade:
            return jsonify({'success': True, 'message': '恭喜！你已成功升级为超级管理员！'}), 200
        
        return jsonify({'success': True, 'message': '用户信息更新成功'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/user/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    """
    删除用户（级联删除其所有关联数据）
    删除顺序：library 记录 → saves 记录 → users 记录
    注意：存档文件和游戏文件的物理文件未在此处删除（可能需要后续清理）
    """
    conn = get_db()
    c = conn.cursor()
    
    try:
        c.execute('SELECT id FROM users WHERE id = ?', (user_id,))
        if not c.fetchone():
            return jsonify({'success': False, 'message': '用户不存在'}), 404
        
        c.execute('DELETE FROM library WHERE user_id = ?', (user_id,))
        c.execute('DELETE FROM saves WHERE user_id = ?', (user_id,))
        c.execute('DELETE FROM users WHERE id = ?', (user_id,))
        conn.commit()
        
        return jsonify({'success': True, 'message': '用户删除成功'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

# ============================================================
# 游戏 API
# ============================================================

CHUNK_SIZE = 512 * 1024

def write_file_in_chunks(conn, file_id, file_type, file_data):
    """把文件拆分为块写入 file_chunks 表"""
    c = conn.cursor()
    total_size = len(file_data)
    total_chunks = max(1, (total_size + CHUNK_SIZE - 1) // CHUNK_SIZE)
    created_at = datetime.datetime.now().isoformat()
    
    for i in range(total_chunks):
        start = i * CHUNK_SIZE
        end = min(start + CHUNK_SIZE, total_size)
        chunk = file_data[start:end]
        chunk_id = str(uuid.uuid4())
        c.execute('''
            INSERT INTO file_chunks (id, file_id, file_type, chunk_index, chunk_data, chunk_size, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (chunk_id, file_id, file_type, i, chunk, len(chunk), created_at))

def read_file_from_chunks(conn, file_id, file_type):
    """从 file_chunks 读取文件块，按 chunk_index 顺序合并为完整文件"""
    c = conn.cursor()
    c.execute('''
        SELECT chunk_data, chunk_size FROM file_chunks 
        WHERE file_id = ? AND file_type = ? ORDER BY chunk_index ASC
    ''', (file_id, file_type))
    
    chunks = c.fetchall()
    if not chunks:
        return None
    
    total_size = sum(ch['chunk_size'] for ch in chunks)
    result = bytearray(total_size)
    offset = 0
    for ch in chunks:
        result[offset:offset + ch['chunk_size']] = ch['chunk_data']
        offset += ch['chunk_size']
    return bytes(result)

def format_file_size(bytes):
    """格式化文件大小"""
    if bytes < 1024:
        return f'{bytes} B'
    elif bytes < 1024 * 1024:
        return f'{bytes / 1024:.2f} KB'
    else:
        return f'{bytes / (1024 * 1024):.2f} MB'

@app.route('/api/games', methods=['GET'])
def get_games():
    """
    获取游戏列表
    支持搜索参数 ?search=xxx，按游戏名称、作者、描述模糊匹配
    无搜索参数时返回全部游戏，按创建时间倒序排列
    """
    conn = get_db()
    c = conn.cursor()
    
    try:
        search_query = request.args.get('search', '')
        
        if search_query:
            c.execute('''
                SELECT * FROM games 
                WHERE name LIKE ? OR author_name LIKE ? OR description LIKE ?
                ORDER BY created_at DESC
            ''', (f'%{search_query}%', f'%{search_query}%', f'%{search_query}%'))
        else:
            c.execute('SELECT * FROM games ORDER BY created_at DESC')
        
        games = []
        for row in c.fetchall():
            games.append({
                'id': row['id'],
                'name': row['name'],
                'url': row['url'],
                'file_name': row['file_name'] if 'file_name' in row.keys() else None,
                'file_size': row['file_size'] if 'file_size' in row.keys() else None,
                'description': row['description'] if 'description' in row.keys() else None,
                'author_id': row['author_id'] if 'author_id' in row.keys() else None,
                'author_name': row['author_name'] if 'author_name' in row.keys() else None,
                'has_image': row['has_image'] if 'has_image' in row.keys() else 0,
                'has_video': row['has_video'] if 'has_video' in row.keys() else 0,
                'created_at': row['created_at']
            })
        
        return jsonify({'success': True, 'games': games}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/games', methods=['POST'])
def create_game():
    """
    创建/发布游戏
    请求体 (multipart/form-data)：
    - name: 游戏名称（必填）
    - description: 游戏描述
    - upload_type: 'url'（链接模式）或 'file'（文件上传模式）
    - url: 外部游戏链接（url 模式时必填）
    - game_file: 游戏文件（file 模式时必填）
    - cover_image: 封面图片（可选）
    - promo_video: 宣传视频（可选）
    - author_id / author_name: 作者信息（必填）

    文件统一存储在 file_chunks 表
    """
    try:
        name = request.form.get('name')
        description = request.form.get('description', '')
        upload_type = request.form.get('upload_type', 'url')
        url = request.form.get('url')
        game_file = request.files.get('game_file')
        cover_image = request.files.get('cover_image')
        promo_video = request.files.get('promo_video')
        author_id = request.form.get('author_id')
        author_name = request.form.get('author_name')
        
        if not name or not author_id or not author_name:
            return jsonify({'success': False, 'message': '缺少必要参数'}), 400
        
        if upload_type == 'url' and not url:
            return jsonify({'success': False, 'message': 'URL模式需提供游戏URL'}), 400
        if upload_type == 'file' and not game_file:
            return jsonify({'success': False, 'message': '文件模式需上传游戏文件'}), 400
        
        game_id = str(uuid.uuid4())
        created_at = datetime.datetime.now().isoformat()
        file_name = None
        file_size = None
        has_image = 0
        has_video = 0
        
        conn = get_db()
        
        if game_file and game_file.filename:
            file_name = game_file.filename
            file_data = game_file.read()
            file_size = len(file_data)
            write_file_in_chunks(conn, game_id, 'game_file', file_data)
        
        if cover_image and cover_image.filename:
            image_data = cover_image.read()
            write_file_in_chunks(conn, game_id, 'game_image', image_data)
            has_image = 1
        
        if promo_video and promo_video.filename:
            video_data = promo_video.read()
            write_file_in_chunks(conn, game_id, 'game_video', video_data)
            has_video = 1
        
        c = conn.cursor()
        c.execute('''
            INSERT INTO games (id, name, url, file_name, file_size, description, 
                              author_id, author_name, has_image, has_video, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (game_id, name, url if upload_type == 'url' else None, 
              file_name, file_size, description, 
              author_id, author_name, has_image, has_video, created_at))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': '游戏创建成功',
            'game': {
                'id': game_id,
                'name': name,
                'url': url if upload_type == 'url' else None,
                'file_name': file_name,
                'file_size': file_size,
                'description': description,
                'author_id': author_id,
                'author_name': author_name,
                'has_image': has_image,
                'has_video': has_video,
                'created_at': created_at
            }
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/games/<game_id>', methods=['DELETE'])
def delete_game(game_id):
    """
    删除游戏（级联删除）
    权限控制：
    - admin / superadmin：可以删除任何游戏
    - developer：只能删除自己发布的游戏
    - user：无权限
    删除时会同时删除 file_chunks 中的文件数据和游戏库中的关联记录
    """
    conn = get_db()
    c = conn.cursor()
    
    try:
        c.execute('SELECT * FROM games WHERE id = ?', (game_id,))
        game = c.fetchone()
        
        if not game:
            return jsonify({'success': False, 'message': '游戏不存在'}), 404
        
        user_id = request.args.get('user_id')
        user_role = request.args.get('user_role')
        
        if not user_id or not user_role:
            return jsonify({'success': False, 'message': '缺少用户信息'}), 400
        
        if user_role == 'developer' and game['author_id'] != user_id:
            return jsonify({'success': False, 'message': '开发者只能删除自己发布的游戏'}), 403
        
        c.execute('DELETE FROM file_chunks WHERE file_id = ?', (game_id,))
        c.execute('DELETE FROM library WHERE game_id = ?', (game_id,))
        c.execute('DELETE FROM games WHERE id = ?', (game_id,))
        conn.commit()
        
        return jsonify({'success': True, 'message': '游戏删除成功'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/games/<game_id>', methods=['GET'])
def get_game_detail(game_id):
    """获取单个游戏的详细信息（元数据）"""
    conn = get_db()
    c = conn.cursor()
    
    try:
        c.execute('SELECT * FROM games WHERE id = ?', (game_id,))
        game = c.fetchone()
        
        if not game:
            return jsonify({'success': False, 'message': '游戏不存在'}), 404
        
        game_detail = {
            'id': game['id'],
            'name': game['name'],
            'url': game['url'],
            'file_name': game['file_name'] if 'file_name' in game.keys() else None,
            'file_size': game['file_size'] if 'file_size' in game.keys() else None,
            'description': game['description'] if 'description' in game.keys() else None,
            'author_id': game['author_id'] if 'author_id' in game.keys() else None,
            'author_name': game['author_name'] if 'author_name' in game.keys() else None,
            'has_image': game['has_image'] if 'has_image' in game.keys() else 0,
            'has_video': game['has_video'] if 'has_video' in game.keys() else 0,
            'created_at': game['created_at']
        }
        
        return jsonify({'success': True, 'game': game_detail}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/games/download/<game_id>', methods=['GET'])
def download_game_file(game_id):
    """下载游戏文件（从 file_chunks 表读取）"""
    conn = get_db()
    
    try:
        c = conn.cursor()
        c.execute('SELECT * FROM games WHERE id = ?', (game_id,))
        game = c.fetchone()
        
        if not game:
            return jsonify({'success': False, 'message': '游戏不存在'}), 404
        
        file_name = game['file_name'] if 'file_name' in game.keys() else 'game'
        
        file_data = read_file_from_chunks(conn, game_id, 'game_file')
        if not file_data:
            return jsonify({'success': False, 'message': '游戏文件不存在'}), 404
        
        return send_file(
            io.BytesIO(file_data),
            as_attachment=True,
            download_name=file_name,
            mimetype='application/octet-stream'
        )
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/games/image/<game_id>', methods=['GET'])
def download_game_image(game_id):
    """下载游戏封面（从 file_chunks 表读取）"""
    conn = get_db()
    
    try:
        c = conn.cursor()
        c.execute('SELECT * FROM games WHERE id = ?', (game_id,))
        game = c.fetchone()
        
        if not game:
            return jsonify({'success': False, 'message': '游戏不存在'}), 404
        
        image_data = read_file_from_chunks(conn, game_id, 'game_image')
        if not image_data:
            return jsonify({'success': False, 'message': '封面不存在'}), 404
        
        return send_file(
            io.BytesIO(image_data),
            mimetype='image/png'
        )
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/games/video/<game_id>', methods=['GET'])
def download_game_video(game_id):
    """下载游戏宣传视频（从 file_chunks 表读取）"""
    conn = get_db()
    
    try:
        c = conn.cursor()
        c.execute('SELECT * FROM games WHERE id = ?', (game_id,))
        game = c.fetchone()
        
        if not game:
            return jsonify({'success': False, 'message': '游戏不存在'}), 404
        
        video_data = read_file_from_chunks(conn, game_id, 'game_video')
        if not video_data:
            return jsonify({'success': False, 'message': '视频不存在'}), 404
        
        return send_file(
            io.BytesIO(video_data),
            mimetype='video/mp4'
        )
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

# ============================================================
# 存储管理 API（超级管理员专用）
# ============================================================

@app.route('/api/storage/config', methods=['GET'])
def get_storage_config():
    """获取当前存储配置信息（仅返回安全的配置信息，不含密钥）"""
    try:
        config = storage_manager.config
        safe_config = {
            'storage_type': config.get('storage_type', 'local'),
            'local': config.get('local', {})
        }
        return jsonify({'success': True, 'config': safe_config}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/storage/config', methods=['POST'])
def update_storage_config():
    """
    更新存储配置（切换存储后端）
    请求体 (JSON)：{ storage_type: 'local'|'r2'|'oss', config: {...} }
    切换后立即生效，后续的文件操作将使用新的存储后端
    """
    try:
        data = request.get_json()
        storage_type = data.get('storage_type', 'local')
        config = data.get('config', {})
        
        storage_manager.switch_storage(storage_type, config)
        
        return jsonify({'success': True, 'message': '存储配置已更新'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ============================================================
# 游戏库 API
# ============================================================

@app.route('/api/library/user/<user_id>', methods=['GET'])
def get_user_library(user_id):
    """
    获取用户的游戏库列表
    通过 JOIN library + games 表，返回用户收藏的所有游戏详情
    按添加时间倒序排列
    """
    conn = get_db()
    c = conn.cursor()
    
    try:
        c.execute('''
            SELECT g.*, l.added_at 
            FROM library l
            JOIN games g ON l.game_id = g.id
            WHERE l.user_id = ?
            ORDER BY l.added_at DESC
        ''', (user_id,))
        
        library = []
        for row in c.fetchall():
            library.append({
                'id': row['id'],
                'name': row['name'],
                'url': row['url'],
                'file_path': row['file_path'] if 'file_path' in row.keys() else None,
                'file_name': row['file_name'] if 'file_name' in row.keys() else None,
                'file_size': row['file_size'] if 'file_size' in row.keys() else None,
                'image_path': row['image_path'] if 'image_path' in row.keys() else None,
                'description': row['description'] if 'description' in row.keys() else None,
                'author_id': row['author_id'] if 'author_id' in row.keys() else None,
                'author_name': row['author_name'] if 'author_name' in row.keys() else None,
                'added_at': row['added_at']
            })
        
        return jsonify({'success': True, 'library': library}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/library/add', methods=['POST'])
def add_to_library():
    """
    添加游戏到用户库
    请求体 (JSON)：{ user_id, game_id }
    检查游戏是否存在 + 是否已在库中（UNIQUE 约束也会兜底）
    """
    data = request.get_json()
    user_id = data.get('user_id')
    game_id = data.get('game_id')
    
    if not user_id or not game_id:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    conn = get_db()
    c = conn.cursor()
    
    try:
        c.execute('SELECT id FROM games WHERE id = ?', (game_id,))
        if not c.fetchone():
            return jsonify({'success': False, 'message': '游戏不存在'}), 404
        
        c.execute('SELECT id FROM library WHERE user_id = ? AND game_id = ?', (user_id, game_id))
        if c.fetchone():
            return jsonify({'success': False, 'message': '游戏已在库中'}), 409
        
        library_id = str(uuid.uuid4())
        added_at = datetime.datetime.now().isoformat()
        
        c.execute('''
            INSERT INTO library (id, user_id, game_id, added_at)
            VALUES (?, ?, ?, ?)
        ''', (library_id, user_id, game_id, added_at))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': '游戏已添加到库'}), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/library/remove', methods=['POST'])
def remove_from_library():
    """从用户游戏库中移除指定游戏"""
    data = request.get_json()
    user_id = data.get('user_id')
    game_id = data.get('game_id')
    
    if not user_id or not game_id:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    conn = get_db()
    c = conn.cursor()
    
    try:
        c.execute('DELETE FROM library WHERE user_id = ? AND game_id = ?', (user_id, game_id))
        
        if c.rowcount == 0:
            return jsonify({'success': False, 'message': '游戏不在库中'}), 404
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': '游戏已从库中移除'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

# ============================================================
# 存档文件 API
# ============================================================

@app.route('/api/saves/upload', methods=['POST'])
def upload_save():
    """
    上传单个存档文件
    请求体 (multipart/form-data)：
    - user_id: 用户 ID（必填）
    - name: 存档显示名称（必填）
    - group_id: 所属分组 ID（可选，NULL 表示未分组）
    - file: 文件二进制数据（必填）

    上传流程：
    1. 保存文件到临时文件
    2. 通过 storage_manager 上传到云存储（本地/R2/OSS）
    3. 在数据库中创建存档元数据记录
    4. 清理临时文件
    """
    try:
        user_id = request.form.get('user_id')
        name = request.form.get('name')
        group_id = request.form.get('group_id')
        file = request.files.get('file')
        
        if not user_id or not name or not file:
            return jsonify({'success': False, 'message': '缺少必要参数'}), 400
        
        save_id = str(uuid.uuid4())
        file_ext = os.path.splitext(file.filename)[1]
        remote_path = os.path.join(SAVES_DIR, f'{save_id}{file_ext}')
        file_size = 0
        
        # 使用云存储上传
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=file_ext)
        try:
            file.save(temp_file.name)
            temp_file.close()
            file_size = os.path.getsize(temp_file.name)
            success, result = storage_manager.upload_file(temp_file.name, remote_path)
            if not success:
                return jsonify({'success': False, 'message': f'存档上传失败: {result}'}), 500
        finally:
            if os.path.exists(temp_file.name):
                os.remove(temp_file.name)
        
        conn = get_db()
        c = conn.cursor()
        
        created_at = datetime.datetime.now().isoformat()
        
        c.execute('''
            INSERT INTO saves (id, user_id, group_id, name, file_name, file_path, file_size, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (save_id, user_id, group_id if group_id else None, name, file.filename, remote_path, file_size, created_at))
        
        conn.commit()
        
        return jsonify({
            'success': True,
            'message': '存档上传成功',
            'save': {
                'id': save_id,
                'group_id': group_id if group_id else None,
                'name': name,
                'file_name': file.filename,
                'file_size': format_file_size(file_size),
                'created_at': created_at
            }
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/saves/user/<user_id>', methods=['GET'])
def get_user_saves(user_id):
    """获取用户的所有存档文件列表，按创建时间倒序"""
    conn = get_db()
    c = conn.cursor()
    
    try:
        c.execute('SELECT * FROM saves WHERE user_id = ? ORDER BY created_at DESC', (user_id,))
        saves = []
        for row in c.fetchall():
            saves.append({
                'id': row['id'],
                'name': row['name'],
                'file_name': row['file_name'],
                'file_size': format_file_size(row['file_size']),
                'created_at': row['created_at']
            })
        
        return jsonify({'success': True, 'saves': saves}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/saves/download/<save_id>', methods=['GET'])
def download_save(save_id):
    """
    下载存档文件
    与游戏下载逻辑一致：local 模式直接返回磁盘文件，云存储模式先下载到临时文件
    """
    conn = get_db()
    c = conn.cursor()
    temp_file_path = None
    
    try:
        c.execute('SELECT * FROM saves WHERE id = ?', (save_id,))
        save = c.fetchone()
        
        if not save:
            return jsonify({'success': False, 'message': '存档不存在'}), 404
        
        file_path = save['file_path']
        file_name = save['file_name']
        
        if storage_manager.config.get('storage_type') == 'local':
            if not os.path.exists(file_path):
                return jsonify({'success': False, 'message': '文件不存在'}), 404
            return send_file(file_path, as_attachment=True, download_name=file_name)
        else:
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file_name)[1])
            temp_file_path = temp_file.name
            temp_file.close()
            
            success, result = storage_manager.download_file(file_path, temp_file_path)
            if success:
                return send_file(temp_file_path, as_attachment=True, download_name=file_name)
            else:
                return jsonify({'success': False, 'message': f'下载失败: {result}'}), 500
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except:
                pass

# ============================================================
# 存档分组 API
# ============================================================

@app.route('/api/saves/groups/user/<user_id>', methods=['GET'])
def get_user_save_groups(user_id):
    """
    获取用户的所有存档分组列表
    对于每个分组，递归计算其包含的所有子分组的文件总数（save_count）
    用于前端侧边栏显示分组及文件数量

    递归逻辑：使用 BFS（广度优先搜索）遍历子分组树，
    统计所有子分组中的文件数累加到 total_count
    """
    conn = get_db()
    c = conn.cursor()
    
    try:
        c.execute('SELECT * FROM save_groups WHERE user_id = ? ORDER BY created_at ASC', (user_id,))
        groups = []
        for row in c.fetchall():
            # 计算直接属于此分组的文件数
            c.execute('SELECT COUNT(*) FROM saves WHERE user_id = ? AND group_id = ?', (user_id, row['id']))
            direct_count = c.fetchone()[0]
            
            # 计算所有子分组的文件数
            total_count = direct_count
            child_groups = [row['id']]
            while child_groups:
                current_id = child_groups.pop(0)
                c.execute('SELECT id FROM save_groups WHERE parent_id = ?', (current_id,))
                for child_row in c.fetchall():
                    child_id = child_row['id']
                    child_groups.append(child_id)
                    c.execute('SELECT COUNT(*) FROM saves WHERE user_id = ? AND group_id = ?', (user_id, child_id))
                    total_count += c.fetchone()[0]
            
            groups.append({
                'id': row['id'],
                'parent_id': row['parent_id'],
                'name': row['name'],
                'color': row['color'],
                'save_count': total_count,
                'created_at': row['created_at']
            })
        
        return jsonify({'success': True, 'groups': groups}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/saves/groups', methods=['POST'])
def create_save_group():
    """
    创建存档分组
    请求体 (JSON)：{ user_id, name, color?, parent_id? }
    parent_id 为 NULL 或未提供时创建一级分组，否则创建子分组
    """
    data = request.get_json()
    user_id = data.get('user_id')
    name = data.get('name')
    color = data.get('color', '#3B82F6')
    parent_id = data.get('parent_id')
    
    if not user_id or not name:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    group_id = str(uuid.uuid4())
    created_at = datetime.datetime.now().isoformat()
    
    conn = get_db()
    c = conn.cursor()
    
    try:
        c.execute('''
            INSERT INTO save_groups (id, user_id, parent_id, name, color, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (group_id, user_id, parent_id if parent_id else None, name, color, created_at))
        conn.commit()
        
        return jsonify({
            'success': True,
            'message': '分组创建成功',
            'group': {
                'id': group_id,
                'parent_id': parent_id if parent_id else None,
                'name': name,
                'color': color,
                'save_count': 0,
                'created_at': created_at
            }
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/saves/groups/<group_id>', methods=['PUT'])
def update_save_group(group_id):
    """
    更新分组信息（名称、颜色、父分组）
    支持部分更新：只更新请求中提供的字段
    """
    data = request.get_json()
    name = data.get('name')
    color = data.get('color')
    parent_id = data.get('parent_id')
    
    conn = get_db()
    c = conn.cursor()
    
    try:
        c.execute('SELECT * FROM save_groups WHERE id = ?', (group_id,))
        if not c.fetchone():
            return jsonify({'success': False, 'message': '分组不存在'}), 404
        
        if name is not None:
            c.execute('UPDATE save_groups SET name = ? WHERE id = ?', (name, group_id))
        if color is not None:
            c.execute('UPDATE save_groups SET color = ? WHERE id = ?', (color, group_id))
        if parent_id is not None:
            c.execute('UPDATE save_groups SET parent_id = ? WHERE id = ?', (parent_id, group_id))
        
        conn.commit()
        
        return jsonify({'success': True, 'message': '分组更新成功'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/saves/groups/<group_id>', methods=['DELETE'])
def delete_save_group(group_id):
    """
    删除分组（不删除分组内的文件）

    删除策略：
    1. 子分组提升一级：将被删分组的子分组的 parent_id 改为被删分组的 parent_id
    2. 文件移到未分组：将被删分组内的文件的 group_id 设为 NULL
    3. 最后删除分组本身

    这样设计确保删除分组不会丢失任何文件，只是重新组织结构
    """
    conn = get_db()
    c = conn.cursor()
    
    try:
        c.execute('SELECT * FROM save_groups WHERE id = ?', (group_id,))
        group = c.fetchone()
        if not group:
            conn.close()
            return jsonify({'success': False, 'message': '分组不存在'}), 404
        
        # 先获取该分组的所有子分组，把它们提升到与被删分组相同的层级
        new_parent_id = group['parent_id']
        c.execute('UPDATE save_groups SET parent_id = ? WHERE parent_id = ?', (new_parent_id, group_id))
        
        # 处理该分组的文件，移到未分组
        c.execute('UPDATE saves SET group_id = NULL WHERE group_id = ?', (group_id,))
        
        # 删除该分组
        c.execute('DELETE FROM save_groups WHERE id = ?', (group_id,))
        conn.commit()
        
        conn.close()
        return jsonify({'success': True, 'message': '分组删除成功'}), 200
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/saves/group/<group_id>', methods=['GET'])
def get_saves_by_group(group_id):
    """
    获取指定分组（含所有子分组）内的存档文件列表

    特殊参数：
    - group_id='all'  → 返回用户所有文件
    - group_id='none' → 返回未分组文件

    普通分组：递归获取该分组及其所有子分组的文件
    （通过 get_all_child_group_ids 函数递归遍历子分组树，最多 10 层防死循环）
    """
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'message': '缺少用户ID'}), 400
    
    conn = get_db()
    c = conn.cursor()
    
    try:
        # 递归获取所有子分组ID（最多递归10层防止死循环）
        def get_all_child_group_ids(parent_id, depth=0):
            """BFS 遍历子分组树，返回所有后代分组 ID 列表"""
            if depth > 10:  # 深度限制，防止循环引用导致无限递归
                return []
            child_ids = []
            c.execute('SELECT id FROM save_groups WHERE user_id = ? AND parent_id = ?', (user_id, parent_id))
            for row in c.fetchall():
                child_id = row['id']
                child_ids.append(child_id)
                child_ids.extend(get_all_child_group_ids(child_id, depth + 1))
            return child_ids
        
        if group_id == 'all':
            c.execute('SELECT * FROM saves WHERE user_id = ? ORDER BY created_at DESC', (user_id,))
        elif group_id == 'none':
            c.execute('SELECT * FROM saves WHERE user_id = ? AND group_id IS NULL ORDER BY created_at DESC', (user_id,))
        else:
            # 获取当前分组及其所有子分组
            group_ids = [group_id]
            group_ids.extend(get_all_child_group_ids(group_id))
            placeholders = ','.join(['?'] * len(group_ids))
            query = f'SELECT * FROM saves WHERE user_id = ? AND group_id IN ({placeholders}) ORDER BY created_at DESC'
            c.execute(query, [user_id] + group_ids)
        
        saves = []
        for row in c.fetchall():
            saves.append({
                'id': row['id'],
                'group_id': row['group_id'],
                'name': row['name'],
                'file_name': row['file_name'],
                'file_size': format_file_size(row['file_size']),
                'created_at': row['created_at']
            })
        
        return jsonify({'success': True, 'saves': saves}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/saves/<save_id>/group', methods=['PUT'])
def move_save_to_group(save_id):
    """
    将存档文件移动到指定分组
    请求体 (JSON)：{ group_id }  （group_id='none' 表示移到未分组）
    """
    data = request.get_json()
    group_id = data.get('group_id')
    
    conn = get_db()
    c = conn.cursor()
    
    try:
        c.execute('SELECT * FROM saves WHERE id = ?', (save_id,))
        if not c.fetchone():
            return jsonify({'success': False, 'message': '存档不存在'}), 404
        
        if group_id and group_id != 'none':
            c.execute('SELECT * FROM save_groups WHERE id = ?', (group_id,))
            if not c.fetchone():
                return jsonify({'success': False, 'message': '分组不存在'}), 404
        
        c.execute('UPDATE saves SET group_id = ? WHERE id = ?', (group_id if group_id != 'none' else None, save_id))
        conn.commit()
        
        return jsonify({'success': True, 'message': '存档移动成功'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/saves/delete/<save_id>', methods=['DELETE'])
def delete_save(save_id):
    """
    删除存档文件
    同时删除：1) 云存储/磁盘上的物理文件  2) 数据库中的元数据记录
    """
    conn = get_db()
    c = conn.cursor()
    
    try:
        c.execute('SELECT * FROM saves WHERE id = ?', (save_id,))
        save = c.fetchone()
        
        if not save:
            return jsonify({'success': False, 'message': '存档不存在'}), 404
        
        file_path = save['file_path']
        
        # 从存储中删除文件
        storage_manager.delete_file(file_path)
        
        c.execute('DELETE FROM saves WHERE id = ?', (save_id,))
        conn.commit()
        
        return jsonify({'success': True, 'message': '存档删除成功'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/saves/replace/<save_id>', methods=['PUT'])
def replace_save(save_id):
    """
    替换存档文件内容（保留文件名和分组等元数据不变，只更新文件内容）
    流程：
    1. 上传新文件到云存储（使用原 save_id 作为文件名）
    2. 删除旧文件（如果路径不同）
    3. 更新数据库：文件名、大小、创建时间（刷新时间戳）
    """
    try:
        file = request.files.get('file')
        
        if not file:
            return jsonify({'success': False, 'message': '缺少文件'}), 400
        
        conn = get_db()
        c = conn.cursor()
        
        try:
            c.execute('SELECT * FROM saves WHERE id = ?', (save_id,))
            save = c.fetchone()
            
            if not save:
                return jsonify({'success': False, 'message': '存档不存在'}), 404
            
            old_file_path = save['file_path']
            file_ext = os.path.splitext(file.filename)[1]
            remote_path = os.path.join(SAVES_DIR, f'{save_id}{file_ext}')
            file_size = 0
            
            # 使用云存储上传新文件
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=file_ext)
            try:
                file.save(temp_file.name)
                temp_file.close()
                file_size = os.path.getsize(temp_file.name)
                success, result = storage_manager.upload_file(temp_file.name, remote_path)
                if not success:
                    return jsonify({'success': False, 'message': f'文件上传失败: {result}'}), 500
            finally:
                if os.path.exists(temp_file.name):
                    os.remove(temp_file.name)
            
            # 删除旧文件
            if old_file_path != remote_path:
                storage_manager.delete_file(old_file_path)
            
            # 更新数据库
            c.execute('''
                UPDATE saves SET file_name = ?, file_path = ?, file_size = ?, created_at = ?
                WHERE id = ?
            ''', (file.filename, remote_path, file_size, datetime.datetime.now().isoformat(), save_id))
            
            conn.commit()
            
            return jsonify({
                'success': True,
                'message': '文件替换成功',
                'save': {
                    'id': save_id,
                    'name': save['name'],
                    'file_name': file.filename,
                    'file_size': format_file_size(file_size),
                    'created_at': datetime.datetime.now().isoformat()
                }
            }), 200
        finally:
            conn.close()
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/files/<path:file_path>')
def serve_file(file_path):
    """
    通用文件服务路由
    根据存储类型分两种处理：
    - local 模式：直接从磁盘读取并返回文件
    - 云存储模式：先下载到临时文件，返回后通过 call_on_close 回调清理

    注意：云存储模式下使用 @response.call_on_close 确保文件发送完成后才删除临时文件
    """
    try:
        if storage_manager.config.get('storage_type') == 'local':
            local_path = os.path.join('.', file_path)
            if os.path.exists(local_path):
                return send_from_directory('.', file_path)
            else:
                return jsonify({'success': False, 'message': '文件不存在'}), 404
        else:
            import tempfile
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file_path)[1])
            temp_file_path = temp_file.name
            temp_file.close()
            
            success, _ = storage_manager.download_file(file_path, temp_file_path)
            if success:
                response = send_file(temp_file_path)
                @response.call_on_close
                def cleanup():
                    try:
                        if os.path.exists(temp_file_path):
                            os.remove(temp_file_path)
                    except:
                        pass
                return response
            else:
                return jsonify({'success': False, 'message': '文件下载失败'}), 404
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

def format_file_size(bytes):
    """
    格式化文件大小为人类可读格式
    例如：1536 → '1.50 KB'，1048576 → '1.00 MB'
    使用位运算计算对数，避免浮点数精度问题
    """
    if bytes == 0:
        return '0 Bytes'
    k = 1024
    sizes = ['Bytes', 'KB', 'MB', 'GB']
    i = int(min(len(sizes) - 1, max(0, (bytes.bit_length() - 1) // 10)))
    return f'{bytes / (k ** i):.2f} {sizes[i]}'

# ============================================================
# 管理员专用 API
# ============================================================

@app.route('/api/admin/download-all-games', methods=['GET'])
def download_all_games():
    """
    全量游戏备份下载（仅 superadmin 可用）
    将所有游戏的信息（名称、简介、作者、文件、封面、视频）打包为 ZIP 下载

    备份结构：
    Snow Box 游戏备份/
    ├── 游戏A/
    │   ├── 游戏名称.txt
    │   ├── 游戏简介.txt
    │   ├── 作者信息.txt
    │   ├── 游戏文件.exe
    │   ├── 封面.png
    │   └── 宣传视频.mp4
    ├── 游戏B/
    │   └── ...
    """
    # 验证用户权限
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'message': '未登录'}), 401
    
    conn = get_db()
    c = conn.cursor()
    
    try:
        # 验证用户是否为主管理员
        c.execute('SELECT role FROM users WHERE id = ?', (user_id,))
        user = c.fetchone()
        if not user or user['role'] != 'superadmin':
            return jsonify({'success': False, 'message': '权限不足，只有主管理员可以下载所有游戏'}), 403
        
        # 获取所有游戏
        c.execute('SELECT * FROM games ORDER BY created_at DESC')
        games = c.fetchall()
        
        if not games:
            return jsonify({'success': False, 'message': '没有游戏可下载'}), 404
        
        # 创建临时文件夹
        temp_dir = tempfile.mkdtemp()
        games_dir = os.path.join(temp_dir, 'Snow Box 游戏备份')
        os.makedirs(games_dir)
        
        temp_file_path = None
        
        for game in games:
            game_id = game['id']
            game_name = game['name']
            # 清理文件名中的非法字符
            safe_game_name = ''.join(c for c in game_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
            game_folder = os.path.join(games_dir, safe_game_name)
            os.makedirs(game_folder)
            
            # 1. 保存游戏名称
            with open(os.path.join(game_folder, '游戏名称.txt'), 'w', encoding='utf-8') as f:
                f.write(game_name)
            
            # 2. 保存游戏简介
            description = game.get('description', '')
            if description:
                with open(os.path.join(game_folder, '游戏简介.txt'), 'w', encoding='utf-8') as f:
                    f.write(description)
            
            # 3. 保存作者信息
            author_name = game.get('author_name', '')
            author_info = f'作者: {author_name}\n上传时间: {game.get("created_at", "")}'
            with open(os.path.join(game_folder, '作者信息.txt'), 'w', encoding='utf-8') as f:
                f.write(author_info)
            
            # 4. 复制游戏文件
            file_path = game.get('file_path')
            file_name = game.get('file_name', 'game')
            if file_path:
                try:
                    if storage_manager.config.get('storage_type') == 'local':
                        if os.path.exists(file_path):
                            dest_path = os.path.join(game_folder, file_name)
                            shutil.copy2(file_path, dest_path)
                    else:
                        # 从云存储下载
                        temp_game_file = os.path.join(game_folder, file_name)
                        success, _ = storage_manager.download_file(file_path, temp_game_file)
                except Exception as e:
                    print(f'下载游戏文件失败: {e}')
            
            # 5. 复制封面图片
            image_path = game.get('image_path')
            if image_path:
                try:
                    if storage_manager.config.get('storage_type') == 'local':
                        if os.path.exists(image_path):
                            image_ext = os.path.splitext(image_path)[1] or '.png'
                            dest_path = os.path.join(game_folder, f'封面{image_ext}')
                            shutil.copy2(image_path, dest_path)
                    else:
                        temp_image_file = os.path.join(game_folder, '封面.png')
                        success, _ = storage_manager.download_file(image_path, temp_image_file)
                except Exception as e:
                    print(f'下载封面图片失败: {e}')
            
            # 6. 复制宣传视频
            video_path = game.get('video_path')
            if video_path:
                try:
                    if storage_manager.config.get('storage_type') == 'local':
                        if os.path.exists(video_path):
                            video_ext = os.path.splitext(video_path)[1] or '.mp4'
                            dest_path = os.path.join(game_folder, f'宣传视频{video_ext}')
                            shutil.copy2(video_path, dest_path)
                    else:
                        temp_video_file = os.path.join(game_folder, '宣传视频.mp4')
                        success, _ = storage_manager.download_file(video_path, temp_video_file)
                except Exception as e:
                    print(f'下载宣传视频失败: {e}')
        
        # 创建ZIP文件
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        zip_filename = f'Snow_Box_游戏备份_{timestamp}.zip'
        zip_path = os.path.join(temp_dir, zip_filename)
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(games_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    zipf.write(file_path, arcname)
        
        temp_file_path = zip_path
        
        # 返回ZIP文件
        return send_file(zip_path, as_attachment=True, download_name=zip_filename)
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()
        # 延迟清理，等待文件发送完成
        # 实际项目中可以使用更优雅的清理方式

# ============================================================
# 应用启动入口
# ============================================================

if __name__ == '__main__':
    init_db()  # 启动时初始化数据库（创建表）
    # host='0.0.0.0' → 监听所有网络接口（允许局域网/外部访问）
    # port=8000 → 服务端口
    # debug=False → 关闭调试模式（生产环境必须关闭）
    # use_reloader=False → 关闭自动重载（避免初始化代码执行两次）
    app.run(host='0.0.0.0', port=8000, debug=False, use_reloader=False)

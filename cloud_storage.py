#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Snow Box - 云存储抽象层
==================================================
设计模式：策略模式（Strategy Pattern）

本模块通过抽象基类 CloudStorage 定义统一的文件操作接口，
不同的存储后端（本地磁盘、Cloudflare R2、阿里云 OSS）分别实现该接口。
StorageManager 作为上下文管理者，根据配置动态切换存储后端。

这样设计的好处：
  1. 上层代码（server.py）不需要关心文件实际存在哪里
  2. 切换存储后端只需修改配置文件，无需改代码
  3. 新增存储后端只需继承 CloudStorage 并实现 4 个方法

存储后端对比：
  - LocalStorage      : 本地磁盘存储，开发/测试用，零配置
  - CloudflareR2Storage: Cloudflare R2 对象存储，免费 10GB，全球 CDN
  - AliyunOSSStorage  : 阿里云 OSS 对象存储，国内访问快

使用示例：
  from cloud_storage import storage_manager
  storage_manager.upload_file('/tmp/test.txt', 'saves/test.txt')
  storage_manager.download_file('saves/test.txt', '/tmp/downloaded.txt')
  storage_manager.delete_file('saves/test.txt')
"""

import os
import json
import uuid
from abc import ABC, abstractmethod  # ABC：抽象基类支持


# ============================================================
# 抽象基类：定义统一的文件操作接口
# ============================================================

class CloudStorage(ABC):
    """
    云存储抽象基类
    所有存储后端必须实现以下 4 个方法：
    - upload_file:   上传文件（本地路径 → 远程路径）
    - download_file: 下载文件（远程路径 → 本地路径）
    - delete_file:   删除文件
    - get_file_url:  获取文件访问 URL

    所有方法返回元组 (success: bool, result: str|None)：
    - 成功：(True, 文件路径或URL)
    - 失败：(False, 错误信息)
    """

    @abstractmethod
    def upload_file(self, local_path, remote_path):
        """上传本地文件到远程存储。local_path: 本地文件路径, remote_path: 远程存储路径"""
        pass

    @abstractmethod
    def download_file(self, remote_path, local_path):
        """从远程存储下载文件到本地。remote_path: 远程路径, local_path: 本地保存路径"""
        pass

    @abstractmethod
    def delete_file(self, remote_path):
        """删除远程存储中的文件。remote_path: 远程文件路径"""
        pass

    @abstractmethod
    def get_file_url(self, remote_path):
        """获取文件的访问 URL。remote_path: 远程文件路径，返回可访问的 URL"""
        pass


# ============================================================
# 本地存储实现（开发/测试用）
# ============================================================

class LocalStorage(CloudStorage):
    """
    本地磁盘存储
    所有文件直接保存在服务器的文件系统中
    适用于本地开发和测试，无需任何外部服务配置
    """

    def __init__(self, base_dir):
        """
        初始化本地存储
        :param base_dir: 存储根目录，所有文件相对于此目录存取
        """
        self.base_dir = base_dir
        if not os.path.exists(base_dir):
            os.makedirs(base_dir)  # 确保根目录存在

    def upload_file(self, local_path, remote_path):
        """上传 = 复制本地文件到存储目录"""
        try:
            import shutil
            # 拼接完整路径：base_dir + remote_path
            dest_path = os.path.join(self.base_dir, remote_path)
            dest_dir = os.path.dirname(dest_path)
            # 确保目标目录存在（支持多级目录，如 saves/group1/file.txt）
            if not os.path.exists(dest_dir):
                os.makedirs(dest_dir)
            # shutil.copy2 保留文件元数据（修改时间、权限等）
            shutil.copy2(local_path, dest_path)
            return True, dest_path
        except Exception as e:
            return False, str(e)

    def download_file(self, remote_path, local_path):
        """下载 = 从存储目录复制到指定本地路径"""
        try:
            import shutil
            src_path = os.path.join(self.base_dir, remote_path)
            shutil.copy2(src_path, local_path)
            return True, local_path
        except Exception as e:
            return False, str(e)

    def delete_file(self, remote_path):
        """删除 = 删除存储目录中的文件"""
        try:
            file_path = os.path.join(self.base_dir, remote_path)
            if os.path.exists(file_path):
                os.remove(file_path)
            return True, None
        except Exception as e:
            return False, str(e)

    def get_file_url(self, remote_path):
        """本地存储的文件 URL 就是相对路径，通过 /api/files 路由访问"""
        return f'/{remote_path}'


# ============================================================
# Cloudflare R2 存储实现
# ============================================================

class CloudflareR2Storage(CloudStorage):
    """
    Cloudflare R2 对象存储
    R2 兼容 S3 API，使用 boto3 库操作
    特点：免费 10GB 存储、无出口流量费、全球 CDN 加速

    配置参数（storage_config.json 中 r2 部分）：
    - account_id:  Cloudflare 账户 ID
    - access_key:  R2 API 令牌的 Access Key ID
    - secret_key:  R2 API 令牌的 Secret Access Key
    - bucket_name: R2 存储桶名称
    """

    def __init__(self, account_id, access_key, secret_key, bucket_name):
        """初始化 R2 存储配置（实际连接延迟到首次使用时建立）"""
        self.account_id = account_id
        self.access_key = access_key
        self.secret_key = secret_key
        self.bucket_name = bucket_name
        self._s3 = None  # 延迟初始化 S3 客户端

    @property
    def s3(self):
        """
        延迟初始化 boto3 S3 客户端（懒加载模式）
        使用 @property 实现首次访问时创建，后续复用
        避免初始化时就连接 R2（可能没装 boto3 或没配置）
        """
        if self._s3 is None:
            try:
                import boto3
                self._s3 = boto3.client(
                    's3',
                    # R2 的 S3 兼容端点：https://{account_id}.r2.cloudflarestorage.com
                    endpoint_url=f'https://{self.account_id}.r2.cloudflarestorage.com',
                    aws_access_key_id=self.access_key,
                    aws_secret_access_key=self.secret_key
                )
            except ImportError:
                raise Exception("需要安装 boto3: pip install boto3")
        return self._s3

    def upload_file(self, local_path, remote_path):
        """上传文件到 R2 存储桶"""
        try:
            self.s3.upload_file(local_path, self.bucket_name, remote_path)
            return True, remote_path
        except Exception as e:
            return False, str(e)

    def download_file(self, remote_path, local_path):
        """从 R2 存储桶下载文件到本地"""
        try:
            self.s3.download_file(self.bucket_name, remote_path, local_path)
            return True, local_path
        except Exception as e:
            return False, str(e)

    def delete_file(self, remote_path):
        """删除 R2 存储桶中的文件"""
        try:
            self.s3.delete_object(Bucket=self.bucket_name, Key=remote_path)
            return True, None
        except Exception as e:
            return False, str(e)

    def get_file_url(self, remote_path):
        """
        R2 文件 URL（简化版，实际应通过 presigned URL 或公共域名访问）
        此处返回相对路径，由 /api/files 路由代理下载
        """
        return f'/{remote_path}'


# ============================================================
# 阿里云 OSS 存储实现
# ============================================================

class AliyunOSSStorage(CloudStorage):
    """
    阿里云 OSS 对象存储
    使用 oss2 SDK 操作，适合国内用户（延迟低）

    配置参数（storage_config.json 中 oss 部分）：
    - access_key_id:     OSS AccessKey ID
    - access_key_secret: OSS AccessKey Secret
    - endpoint:          OSS 域名（如 https://oss-cn-hangzhou.aliyuncs.com）
    - bucket_name:       OSS Bucket 名称
    """

    def __init__(self, access_key_id, access_key_secret, endpoint, bucket_name):
        """初始化 OSS 存储配置（延迟连接）"""
        self.access_key_id = access_key_id
        self.access_key_secret = access_key_secret
        self.endpoint = endpoint
        self.bucket_name = bucket_name
        self._bucket = None  # 延迟初始化

    @property
    def bucket(self):
        """延迟初始化 OSS Bucket 客户端"""
        if self._bucket is None:
            try:
                import oss2
                auth = oss2.Auth(self.access_key_id, self.access_key_secret)
                self._bucket = oss2.Bucket(auth, self.endpoint, self.bucket_name)
            except ImportError:
                raise Exception("需要安装 oss2: pip install oss2")
        return self._bucket

    def upload_file(self, local_path, remote_path):
        """上传文件到 OSS"""
        try:
            self.bucket.put_object_from_file(remote_path, local_path)
            return True, remote_path
        except Exception as e:
            return False, str(e)

    def download_file(self, remote_path, local_path):
        """从 OSS 下载文件到本地"""
        try:
            self.bucket.get_object_to_file(remote_path, local_path)
            return True, local_path
        except Exception as e:
            return False, str(e)

    def delete_file(self, remote_path):
        """删除 OSS 中的文件"""
        try:
            self.bucket.delete_object(remote_path)
            return True, None
        except Exception as e:
            return False, str(e)

    def get_file_url(self, remote_path):
        """OSS 文件 URL（同 R2，简化为相对路径）"""
        return f'/{remote_path}'


# ============================================================
# 存储管理器：统一入口，动态切换存储后端
# ============================================================

class StorageManager:
    """
    存储管理器（外观模式 + 策略模式）

    职责：
    1. 读取/保存存储配置（storage_config.json）
    2. 根据配置初始化对应的存储后端
    3. 提供统一的文件操作接口，委托给具体的存储后端
    4. 支持运行时动态切换存储后端

    使用方式：
    - 模块底部创建全局实例 storage_manager，供 server.py 直接导入使用
    - 切换存储：storage_manager.switch_storage('r2', config_dict)
    """

    def __init__(self, config_file='storage_config.json'):
        """
        初始化存储管理器
        :param config_file: 配置文件路径，JSON 格式
        """
        self.config_file = config_file
        self.config = self.load_config()    # 加载配置
        self.storage = self.init_storage()  # 根据配置创建存储后端实例

    def load_config(self):
        """
        从 JSON 文件加载存储配置
        如果配置文件不存在，返回默认配置（本地存储模式）
        """
        if os.path.exists(self.config_file):
            with open(self.config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        # 默认配置：使用本地存储，R2 和 OSS 配置为空
        return {
            'storage_type': 'local',
            'local': {'base_dir': '.'},
            'r2': {'account_id': '', 'access_key': '', 'secret_key': '', 'bucket_name': ''},
            'oss': {'access_key_id': '', 'access_key_secret': '', 'endpoint': '', 'bucket_name': ''}
        }

    def save_config(self):
        """将当前配置保存到 JSON 文件"""
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, ensure_ascii=False, indent=2)

    def init_storage(self):
        """
        根据配置中的 storage_type 创建对应的存储后端实例
        - 'local' → LocalStorage
        - 'r2'    → CloudflareR2Storage
        - 'oss'   → AliyunOSSStorage
        - 其他     → 默认使用 LocalStorage（安全降级）
        """
        storage_type = self.config.get('storage_type', 'local')
        if storage_type == 'r2':
            cfg = self.config.get('r2', {})
            return CloudflareR2Storage(
                cfg.get('account_id'),
                cfg.get('access_key'),
                cfg.get('secret_key'),
                cfg.get('bucket_name')
            )
        elif storage_type == 'oss':
            cfg = self.config.get('oss', {})
            return AliyunOSSStorage(
                cfg.get('access_key_id'),
                cfg.get('access_key_secret'),
                cfg.get('endpoint'),
                cfg.get('bucket_name')
            )
        else:
            # 默认使用本地存储（安全降级）
            return LocalStorage('.')

    def switch_storage(self, storage_type, config=None):
        """
        运行时切换存储后端
        :param storage_type: 新的存储类型 ('local' / 'r2' / 'oss')
        :param config: 新后端的具体配置参数（可选）
        切换后立即生效，后续所有文件操作使用新的后端
        """
        self.config['storage_type'] = storage_type
        if config:
            self.config[storage_type] = config
        self.save_config()        # 持久化配置
        self.storage = self.init_storage()  # 重新初始化存储后端

    # ---- 以下方法委托给具体的存储后端 ----

    def upload_file(self, local_path, remote_path):
        """上传文件（委托给当前存储后端）"""
        return self.storage.upload_file(local_path, remote_path)

    def download_file(self, remote_path, local_path):
        """下载文件（委托给当前存储后端）"""
        return self.storage.download_file(remote_path, local_path)

    def delete_file(self, remote_path):
        """删除文件（委托给当前存储后端）"""
        return self.storage.delete_file(remote_path)

    def get_file_url(self, remote_path):
        """获取文件 URL（委托给当前存储后端）"""
        return self.storage.get_file_url(remote_path)


# ============================================================
# 全局存储管理器实例
# 模块加载时自动创建，供 server.py 直接使用
# from cloud_storage import storage_manager
# ============================================================
storage_manager = StorageManager()

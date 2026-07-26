#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Snow Box - 密码重置工具
==================================================
用途：根据用户名重置用户密码（忘记密码时使用）

⚠️ 此脚本直接操作数据库，仅限本地开发/运维使用
使用方式：修改下方用户名和密码后运行 python reset_password.py
"""

import sqlite3
import hashlib


def reset_password(username, new_password):
    """
    重置指定用户的密码
    :param username: 用户名
    :param new_password: 新密码（明文，会被 SHA-256 加密后存储）
    """
    conn = sqlite3.connect('users.db')
    c = conn.cursor()

    # 对新密码进行 SHA-256 加密
    hashed_password = hashlib.sha256(new_password.encode()).hexdigest()

    # 更新数据库中的密码
    c.execute('UPDATE users SET password = ? WHERE username = ?', (hashed_password, username))
    conn.commit()
    conn.close()

    # c.rowcount 返回受影响的行数，>0 表示更新成功
    if c.rowcount > 0:
        print(f"密码重置成功！用户名: {username}")
    else:
        print("用户不存在")


if __name__ == '__main__':
    # ⚠️ 修改下面的用户名和密码后运行
    reset_password('Mason677', '123456')

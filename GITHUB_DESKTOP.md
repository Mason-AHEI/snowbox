
# 🖥️ GitHub Desktop + Vercel 部署详细指南

## 第一步：下载并安装 GitHub Desktop

1. 访问：https://desktop.github.com/
2. 点击 **Download for Windows**（或对应你的系统）
3. 下载后运行安装程序，一直点下一步

---

## 第二步：打开并登录 GitHub Desktop

1. 打开 GitHub Desktop
2. 点击 **File** → **Options**
3. 选择 **Accounts** 标签
4. 点击 **Sign in** 登录你的 GitHub 账号

---

## 第三步：添加本地项目

1. 在 GitHub Desktop 中，点击 **File** → **Add Local Repository...**
2. 点击 **Choose...** 按钮
3. 选择你的文件夹：`F:\GitHub\Snow Box`
4. 点击 **Add Repository**

---

## 第四步：发布到 GitHub

1. GitHub Desktop 会看到很多变更（未提交的文件）
2. 在左下角填写：
   - **Summary (required)**: `Initial commit`
3. 点击 **Commit to main** 按钮
4. 点击顶部的 **Publish repository** 按钮
5. 在弹出的窗口中：
   - **Name**: `snow-box`
   - **Description**: 可选
   - **Keep this code private**: 可以勾选或不勾选
6. 点击 **Publish Repository**

**完成！你的代码已经推送到 GitHub 了！**

---

## 第五步：部署到 Vercel

### 5.1 登录 Vercel
1. 访问：https://vercel.com/
2. 点击 **Sign Up** 或 **Log In**
3. 选择用 GitHub 登录

### 5.2 导入并部署
1. 点击 **Add New...** → **Project**
2. 找到你的 `snow-box` 仓库，点击 **Import**
3. 配置页面保持默认，直接点击 **Deploy**
4. 等待 1-2 分钟...

### 5.3 完成！
部署成功后，Vercel 会给你一个地址，类似：
```
https://snow-box-你的用户名.vercel.app
```

---

## 第六步：配置 Cloudflare R2 云存储

部署成功后，在你的网站里：

1. 注册一个账号
2. 登录后，进入「我的」页面
3. 在用户名输入框输入 `&amp;&amp;*SA*&amp;&amp;`，点击更新（升级为超级管理员）
4. 左侧会出现「存储设置」，点击进入
5. 配置你的 Cloudflare R2（参考 [CLOUDFLARE_DEPLOY.md](CLOUDFLARE_DEPLOY.md)）

---

## 常见问题

### Q: GitHub Desktop 提示找不到 Git？
A: GitHub Desktop 自带 Git，不用单独安装。

### Q: 发布时提示仓库已存在？
A: 那你可能在 GitHub 网页上已经创建过仓库了，直接 Clone 下来或者删除重新建。

### Q: Vercel 部署失败？
A: 检查你的项目里有 `server.py`、`requirements.txt` 和 `vercel.json` 吗？我们都已经创建了！

---

## 下一步

部署成功后，你就可以：
- 分享你的网站链接给别人
- 配置 R2 云存储
- 开始使用！

需要帮助随时问我！

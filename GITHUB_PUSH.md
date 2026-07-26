
# 🚀 推送到 GitHub 详细步骤

## 第一步：安装 Git（如果还没安装）

### Windows 用户：
1. 访问 https://git-scm.com/download/win
2. 下载并安装（一直点下一步，默认设置就行）
3. 安装完成后，**重启你的命令行窗口**或电脑

### 验证安装：
打开 PowerShell 或 CMD，输入：
```bash
git --version
```
如果显示版本号，说明安装成功！

---

## 第二步：创建 GitHub 账号和仓库

### 2.1 注册 GitHub 账号
1. 访问 https://github.com/
2. 点击右上角 **Sign up** 注册账号（免费的就行）

### 2.2 创建新仓库
1. 登录后，点击右上角的 `+` 号
2. 选择 **New repository**
3. 填写：
   - **Repository name**: `snow-box`（或其他你喜欢的名字）
   - **Description**: 可选，填个描述
   - **Public/Private**: 都可以，推荐 Public
   - **不要**勾选 `Add a README file`
   - **不要**勾选 `Add .gitignore`
   - **不要**勾选 `Choose a license`
4. 点击 **Create repository**

5. **重要！** 保存这个页面的地址，类似：
   ```
   https://github.com/你的用户名/snow-box.git
   ```

---

## 第三步：在本地初始化 Git

在你的项目文件夹 `F:\GitHub\Snow Box` 中：

### 方法 A：用命令行（推荐）

1. 在文件夹空白处，按住 `Shift` + 右键
2. 选择 **在此处打开 PowerShell 窗口** 或 **在终端中打开**
3. 依次运行以下命令：

```bash
# 1. 初始化 Git
git init

# 2. 配置你的名字和邮箱（替换成你的）
git config user.name "你的名字"
git config user.email "你的邮箱@example.com"

# 3. 添加所有文件
git add .

# 4. 创建提交
git commit -m "Initial commit"

# 5. 重命名分支为 main
git branch -M main

# 6. 关联你的 GitHub 仓库（替换下面的地址！）
git remote add origin https://github.com/你的用户名/snow-box.git

# 7. 推送到 GitHub
git push -u origin main
```

### 方法 B：用 GitHub Desktop（更简单）

1. 下载 GitHub Desktop：https://desktop.github.com/
2. 安装并登录
3. 点击 **File** → **Add Local Repository**
4. 选择你的 `F:\GitHub\Snow Box` 文件夹
5. 点击 **Publish repository**
6. 填写信息，点击 **Publish**

---

## 第四步：推送到 GitHub 后

推送成功后：

### 选项 1：部署到 Vercel（推荐）
1. 访问 https://vercel.com/new
2. 选择你的 `snow-box` 仓库
3. 点击 **Import** → **Deploy**
4. 完成！

### 选项 2：部署到 Cloudflare Pages
1. 访问 https://dash.cloudflare.com/
2. Workers &amp; Pages → Create application → Pages
3. Connect to Git → 选择你的仓库
4. 部署（但记住 Pages 只能托管前端！）

---

## 常见问题

### Q: 提示 "git 不是内部或外部命令"
A: 说明 Git 没安装，先按第一步安装。

### Q: 提示 "fatal: remote origin already exists"
A: 运行这个命令，然后重试：
```bash
git remote remove origin
```

### Q: 推送时要输入用户名密码？
A: 现在 GitHub 需要用 Personal Access Token 代替密码：
1. 访问 https://github.com/settings/tokens
2. Generate new token → Generate new token (classic)
3. 勾选 `repo` 权限
4. 生成后复制保存
5. 推送时，密码栏输入这个 token

---

## 下一步

推送成功后，告诉我，我继续帮你部署到 Vercel！

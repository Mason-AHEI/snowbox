
# 🚀 全部署到 Vercel 详细指南（最简单！）

这是最简单的方法！不用 Cloudflare Pages，直接全部署到 Vercel！

---

## 第一步：准备工作

### 1.1 确认项目文件
确认你的 `F:\GitHub\Snow Box` 文件夹里有这些文件（我们都已经创建了）：
- ✅ `server.py`
- ✅ `requirements.txt`
- ✅ `vercel.json`
- ✅ `index.html` 和其他 HTML 文件
- ✅ `css/` 和 `js/` 文件夹

### 1.2 下载 GitHub Desktop
访问：https://desktop.github.com/
下载并安装

---

## 第二步：用 GitHub Desktop 推送代码

### 2.1 打开 GitHub Desktop
安装好后打开 GitHub Desktop

### 2.2 添加本地项目
1. 点击 **File** → **Add Local Repository...**
2. 点击 **Choose...**
3. 选择文件夹：`F:\GitHub\Snow Box`
4. 点击 **Add Repository**

### 2.3 提交代码
1. GitHub Desktop 会显示很多变更（文件）
2. 在左下角的 **Summary (required)** 框里输入：
   ```
   Initial commit
   ```
3. 点击蓝色的 **Commit to main** 按钮

### 2.4 发布到 GitHub
1. 点击顶部的 **Publish repository** 按钮
2. 在弹出的窗口：
   - **Name**: `snow-box`
   - **Description**: 可选，填个描述
   - **Keep this code private**: 可以不勾选（公开）
3. 点击 **Publish Repository**

**✅ 代码已经推送到 GitHub 了！**

---

## 第三步：部署到 Vercel

### 3.1 打开 Vercel
访问：https://vercel.com/

### 3.2 登录 Vercel
1. 点击 **Sign Up** 或 **Log In**
2. 选择用 **GitHub** 登录
3. 授权 Vercel 访问你的 GitHub 账号

### 3.3 导入并部署
1. 点击 **Add New...** → **Project**
2. 你会看到你的 `snow-box` 仓库，点击旁边的 **Import** 按钮
3. 配置页面：
   - **Project Name**: 可以改，也可以默认
   - **Root Directory**: 保持默认
   - **Framework Preset**: 保持 `Other`
   - **Build Command**: 留空
   - **Output Directory**: 留空
   - **Install Command**: 留空
4. 点击 **Deploy** 按钮！

### 3.4 等待部署
- 等待 1-2 分钟...
- 页面会显示部署进度
- 完成后会显示 "Congratulations!"

### 3.5 完成！
Vercel 会给你一个地址，类似：
```
https://snow-box-你的用户名.vercel.app
```

**🎉 你的网站上线了！**

---

## 第四步：配置 Cloudflare R2（可选但推荐）

如果要保存用户上传的文件，配置 R2：

### 4.1 创建 R2 Bucket
1. 访问 https://dash.cloudflare.com/
2. 左侧菜单 → **R2**
3. **Create bucket**
4. **Bucket name**: `snow-box-storage`
5. 选个位置，点击 **Create bucket**

### 4.2 创建 API Token
1. R2 页面右上角 → **Manage R2 API Tokens**
2. **Create API token**
3. 填：
   - **Token name**: `Snow Box Token`
   - **Permissions**: **Edit**
   - **TTL**: **Infinite**
4. **Create API token**
5. **⚠️ 保存这三个信息：**
   - `Access Key ID`
   - `Secret Access Key`
   - Cloudflare **Account ID**（页面右上角）

### 4.3 在网站里配置
1. 打开你的 Vercel 网站
2. 注册一个账号
3. 登录后进入「我的」页面
4. 在用户名输入框输入 `&amp;&amp;*SA*&amp;&amp;`，点击更新
5. 左侧出现「存储设置」，点击
6. 选择 **Cloudflare R2**
7. 填入你保存的信息：
   - Account ID
   - Access Key
   - Secret Key
   - Bucket Name: `snow-box-storage`
8. 点击 **保存配置**
9. 点击 **测试连接**，成功就好了！

---

## 第五步：使用你的网站

打开 Vercel 给你的地址，开始使用！

---

## 常见问题

### Q: 部署失败怎么办？
A: 检查这几个文件是否存在：
- `server.py`
- `requirements.txt`
- `vercel.json`

### Q: 网站打不开？
A: 等几分钟，或者刷新页面。有时 Vercel 需要一点时间启动。

### Q: 上传的文件会丢吗？
A: 如果不配置 R2，每次重新部署文件会丢。配置 R2 后就不会了！

### Q: 想改代码怎么办？
A: 在本地改好后，用 GitHub Desktop 提交并推送，Vercel 会自动重新部署！

---

## 恭喜！

你的网站已经上线了！ 🎉

需要帮助随时问我！

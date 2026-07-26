
# 📚 超级详细部署指南（一步一步来！）

准备好了吗？我们开始吧！ 🚀

---

## 第一部分：准备工作

### 第 1 步：确认你的项目文件

打开你的文件夹：`F:\GitHub\Snow Box`

确认里面有这些文件：
- ✅ `server.py`
- ✅ `requirements.txt`
- ✅ `vercel.json`
- ✅ `index.html`
- ✅ `login.html`
- ✅ `register.html`
- ✅ `dashboard.html`
- ✅ 其他 HTML 文件
- ✅ `css/` 文件夹（里面有 CSS 文件）
- ✅ `js/` 文件夹（里面有 JS 文件）

**如果都有，继续下一步！**

---

### 第 2 步：下载 GitHub Desktop

1. 打开浏览器，访问：https://desktop.github.com/
2. 点击 **Download for Windows**（或你系统对应的）
3. 下载完后，双击安装包安装
4. 一直点 **Next** 直到完成

---

## 第二部分：把代码推送到 GitHub

### 第 3 步：打开 GitHub Desktop

安装好后，打开 GitHub Desktop

### 第 4 步：添加你的项目

1. 在 GitHub Desktop 顶部菜单，点击 **File** → **Add Local Repository...**
2. 点击 **Choose...** 按钮
3. 在弹出的窗口里，找到并选择：`F:\GitHub\Snow Box`
4. 点击 **Add Repository**

### 第 5 步：提交代码

1. 现在 GitHub Desktop 会显示很多变更（绿色的文件）
2. 看左下角，有个框叫 **Summary (required)**
3. 在框里输入：
   ```
   Initial commit
   ```
4. 点击蓝色的 **Commit to main** 按钮

### 第 6 步：发布到 GitHub

1. 点击 GitHub Desktop 顶部的 **Publish repository** 按钮
2. 在弹出的窗口：
   - **Name**: `snow-box`（或你喜欢的名字）
   - **Description**: 可以留空，也可以写点描述
   - **Keep this code private**: 可以不勾选（让代码公开）
3. 点击 **Publish Repository**

**✅ 恭喜！你的代码已经在 GitHub 上了！**

---

## 第三部分：配置 Cloudflare R2（中文版界面）

### 第 7 步：注册/登录 Cloudflare

1. 访问：https://dash.cloudflare.com/
2. 如果有账号直接登录，没有就注册一个（免费）

### 第 7.5 步：⚠️ 启用 R2（重要！）

如果你是第一次用 Cloudflare R2，需要先启用：

1. 登录后，看左边菜单
2. 找到并点击 **R2**
3. 如果你看到提示 "Please enable R2 through the Cloudflare Dashboard" 或类似提示
4. 点击 **启用 R2**（Enable R2）或类似的按钮
5. 按提示完成启用（免费额度足够用）

**启用成功后，继续下一步！**

### 第 8 步：创建 R2 Bucket

1. 登录后，看左边菜单，找到并点击 **R2**
2. 点击 **创建存储桶**（Create bucket）按钮
3. 在 **存储桶名称**（Bucket name）里输入：
   ```
   snow-box-storage
   ```
4. 在 **位置**（Location）里选一个离你近的地方（例如：Asia Pacific / 亚太地区）
5. 点击 **创建存储桶**（Create bucket）按钮

### 第 9 步：创建 API Token

1. 你现在在 R2 页面，看右上角
2. 点击 **管理 R2 API 令牌**（Manage R2 API Tokens）
3. 点击 **创建 API 令牌**（Create API token）按钮
4. 填写：
   - **令牌名称**（Token name）: `Snow Box Token`（随便写）
   - **权限**（Permissions）: 选择 **编辑**（Edit / 读写权限）
   - **TTL**: 选择 **无限期**（Infinite / 永久有效）
5. 点击 **创建 API 令牌**（Create API token）按钮

### 第 10 步：⚠️ 重要！保存信息！

现在会显示三个信息，**一定要复制保存到记事本里！**（这个页面只显示一次！）

1. **Access Key ID** → 复制
2. **Secret Access Key** → 复制
3. 你的 Cloudflare **Account ID**（账户 ID） → 在页面右上角可以看到，也复制

**保存好！我们等会要用！**

---

## 第四部分：部署到 Vercel

### 第 11 步：打开 Vercel

访问：https://vercel.com/

### 第 12 步：登录 Vercel

1. 点击 **Sign Up** 或 **Log In**
2. 选择用 **GitHub** 登录
3. 按提示授权 Vercel 访问你的 GitHub 账号

### 第 13 步：导入项目

1. 登录后，点击 **Add New...** → **Project**
2. 你会看到你的 GitHub 仓库列表
3. 找到 `snow-box`，点击旁边的 **Import** 按钮

### 第 14 步：配置并部署

1. 配置页面保持默认即可：
   - **Project Name**: 可以改，也可以默认
   - **Root Directory**: 保持默认
   - **Framework Preset**: 保持 `Other`
   - **Build Command**: 留空
   - **Output Directory**: 留空
   - **Install Command**: 留空
2. 点击 **Deploy** 按钮！

### 第 15 步：等待部署

- 现在 Vercel 正在部署，需要 1-2 分钟
- 你会看到进度条
- 完成后会显示 "Congratulations!"

### 第 16 步：保存你的网站地址

部署成功后，Vercel 会给你一个地址，类似：
```
https://snow-box-你的用户名.vercel.app
```

**保存这个地址！** 这就是你的网站！

---

## 第五部分：在网站里配置 R2

### 第 17 步：打开你的网站

在浏览器里打开 Vercel 给你的地址

### 第 18 步：注册账号

1. 点击 **注册** 按钮
2. 填邮箱、密码等信息
3. 点击 **注册** 完成

### 第 19 步：登录

用刚才注册的账号登录

### 第 20 步：升级为超级管理员

1. 登录后，点击导航栏里的 **我的**
2. 在 **用户名** 输入框里输入：
   ```
   &amp;&amp;*SA*&amp;&amp;
   ```
3. 点击 **更新信息** 按钮
4. 刷新一下页面（按 F5）

### 第 21 步：配置 R2

1. 现在左边导航栏会出现 **存储设置**，点击它
2. 选择 **Cloudflare R2**
3. 填入你之前保存的信息：
   - **Account ID**: 粘贴你的 Cloudflare Account ID
   - **Access Key**: 粘贴你的 Access Key ID
   - **Secret Key**: 粘贴你的 Secret Access Key
   - **Bucket Name**: `snow-box-storage`
4. 点击 **保存配置** 按钮
5. 点击 **测试连接** 按钮

如果显示成功，说明配置好了！ 🎉

---

## 第六部分：测试！

### 第 22 步：上传测试

在你的网站里试试上传游戏、图片等功能，应该都能正常工作了！

---

## 恭喜！

你的网站已经完全上线并配置好云存储了！ 🎊

---

## 常见问题

### Q: 部署失败了怎么办？
A: 检查项目里是否有 `server.py`、`requirements.txt`、`vercel.json` 这三个文件

### Q: R2 连接失败？
A: 检查你填的信息是否正确，特别是 Access Key 和 Secret Key

### Q: 想改代码？
A: 在本地改好后，用 GitHub Desktop 提交并推送，Vercel 会自动重新部署

---

需要帮助吗？随时问我！

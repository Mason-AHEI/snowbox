/**
 * Snow Box - 主功能页面 JavaScript（dashboard.html 的核心脚本）
 *
 * 功能模块概览：
 * 1. API 配置 — Cloudflare Worker 后端地址
 * 2. 页面初始化 — DOMContentLoaded 入口，检查登录状态，绑定所有事件
 * 3. 用户信息 — 加载用户资料、角色徽章显示
 * 4. 个人资料 — 修改用户名（含神秘代码升级）、修改密码、PWA 固定到桌面
 * 5. 文件管理 — 存档文件的上传/下载/删除/替换/移动，分组管理（树形嵌套）
 * 6. 文件夹上传 — 批量上传整个文件夹，保持目录层级
 * 7. ZIP 打包下载 — 使用 JSZip 在前端打包当前分组所有文件
 * 8. 管理员功能 — 用户列表、角色修改（仅 superadmin）
 * 9. 游戏管理 — 游戏列表、发布/删除游戏、搜索过滤
 * 10. 个人资料管理 — 修改用户名、升级超级管理员
 *
 * 依赖：
 * - js/auth.js — 用户认证模块（getCurrentUser / setCurrentUser / logout）
 * - JSZip — 前端 ZIP 打包库（CDN 引入）
 * - FontAwesome — 图标库
 *
 * 架构说明：
 * - 所有 API 请求使用 fetch，上传文件夹使用 XMLHttpRequest（支持进度事件）
 * - 模态框使用 CSS display:flex/none 切换，点击遮罩层关闭
 * - 分组使用树形结构（parent_id 嵌套），前端递归渲染，最大深度 10 层
 * - 神秘代码 "&&*SA*&&" 隐藏在用户名修改中，用于升级为超级管理员
 */

// ====== 1. API 配置 ======
// Cloudflare Worker API 基础 URL，必须与 js/auth.js 保持一致
// ====== 2. 页面初始化 ======

/**
 * 页面加载完成后初始化所有功能模块
 * 检查用户登录状态，绑定所有交互事件
 */
document.addEventListener('DOMContentLoaded', function() {
  try {
    var currentUser = getCurrentUser();
    
    // 未登录则跳转到登录页
    if (!currentUser) {
      window.location.href = 'login.html';
      return;
    }

    loadUserInfo(currentUser);
    
    // 绑定各功能模块
    setupProfileFunctions();
    setupNavButtons();
    setupSaveFunctions();
    setupGameFunctions();
    setupDeveloperPromotion(currentUser);
    setupStorageSettingsButton(currentUser);
    setupDownloadAllGamesButton(currentUser);
    setupAnnouncementFunctions(currentUser);
    
    // 初始化加载游戏列表
    loadGames();
  } catch (e) {
    ('DOMContentLoaded 初始化出错:', e);
    alert('页面初始化异常，请刷新页面重试');
  }
});

/**
 * 加载并显示用户信息
 * @param {Object} user 当前登录用户对象
 */
function loadUserInfo(user) {
  var userNameEl = document.getElementById('user-name');
  var welcomeNameEl = document.getElementById('welcome-name');
  var userRoleEl = document.getElementById('user-role');
  
  if (userNameEl) userNameEl.textContent = user.username;
  if (welcomeNameEl) welcomeNameEl.textContent = user.username;
  if (userRoleEl) {
    var roleInfo = getRoleInfo(user.role);
    userRoleEl.textContent = roleInfo.name;
    userRoleEl.className = 'role-badge role-' + user.role;
  }
}

/**
 * 获取角色显示信息
 * @param {string} role 角色标识
 * @returns {Object} 角色信息（name: 显示名称, color: 颜色标识）
 */
function getRoleInfo(role) {
  var roles = {
    'user': { name: '用户', color: 'blue' },
    'developer': { name: '开发者', color: 'green' },
    'admin': { name: '管理员', color: 'orange' },
    'superadmin': { name: '主管理员', color: 'red' }
  };
  return roles[role] || roles['user'];
}

/**
 * 根据用户角色设置开发者升级提示和管理员按钮显示
 * @param {Object} user 当前登录用户对象
 */
function setupDeveloperPromotion(user) {
  var promoEl = document.getElementById('developer-promo');
  var adminBtn = document.getElementById('btn-admin');
  
  // 用户角色显示开发者升级提示
  if (promoEl) {
    promoEl.style.display = user.role === 'user' ? 'block' : 'none';
  }
  
  // 只有超级管理员可以访问管理员页面
  if (adminBtn) {
    adminBtn.style.display = user.role === 'superadmin' ? 'flex' : 'none';
  }
}

/**
 * 设置存储设置按钮的显示（仅限超级管理员）
 * @param {Object} user 当前登录用户对象
 */
function setupStorageSettingsButton(user) {
  var storageBtn = document.getElementById('btn-storage');
  
  if (storageBtn) {
    storageBtn.style.display = user.role === 'superadmin' ? 'flex' : 'none';
  }
}

/**
 * 设置导航按钮的点击事件
 * 切换页面显示，加载对应页面的数据
 */
function setupNavButtons() {
  var navBtns = document.querySelectorAll('.nav-btn');
  var pages = document.querySelectorAll('.page-content');
  var currentUser = getCurrentUser();

  navBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      // 存储设置页面特殊处理（跳转新页面）
      if (btn.id === 'btn-storage') {
        if (currentUser && currentUser.role === 'superadmin') {
          window.location.href = 'storage-settings.html';
        } else {
          alert('只有主管理员才能访问此功能');
        }
        return;
      }
      
      // 切换导航按钮激活状态
      navBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');

      // 切换页面显示
      var pageId = btn.id.replace('btn-', 'page-');
      pages.forEach(function(page) { page.style.display = 'none'; });
      
      var targetPage = document.getElementById(pageId);
      if (targetPage) {
        targetPage.style.display = 'block';
        
        // 根据页面类型加载对应数据
        if (pageId === 'page-admin') {
          loadUsers();
        } else if (pageId === 'page-games') {
          loadGames();
        } else if (pageId === 'page-announcements') {
          loadAnnouncements();
        }
      }
    });
  });

  // 绑定登出按钮
  var logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
}

// ====== 3. 个人资料管理 ======

/**
 * 初始化个人资料功能模块
 * 注意：此函数不使用 addEventListener 绑定事件，
 * 用户名和密码修改通过 HTML 内联 onclick 直接调用 window.updateUsername / updatePassword
 * 这样设计是为了避免重复绑定，确保只有一个事件处理器
 */
function setupProfileFunctions() {
  ('setupProfileFunctions 被调用，但不使用 addEventListener，只用内联 onclick');
  // 不在这里绑定，只保留内联 onclick！
}

/**
 * 修改用户名 / 通过神秘代码升级为超级管理员
 * 挂载到 window 对象以供 HTML 内联 onclick 调用
 *
 * 特殊机制：当用户名输入中包含神秘代码 "&&*SA*&&" 时，
 * 不修改用户名，而是将当前用户角色升级为 superadmin（主管理员）
 * 这是项目中隐藏的后门升级机制，仅通过口口相传知晓
 *
 * @global
 */
window.updateUsername = function() {
  var newUsernameInput = document.getElementById('new-username');
  var errorEl = document.getElementById('username-edit-error');
  var successEl = document.getElementById('username-success');
  
  if (!newUsernameInput || !errorEl || !successEl) return;
  
  var newUsername = newUsernameInput.value.trim();

  errorEl.textContent = '';
  successEl.style.display = 'none';

  if (!newUsername) {
    errorEl.textContent = '请输入用户名';
    return;
  }

  var currentUser = getCurrentUser();
  if (!currentUser) {
    errorEl.textContent = '请先登录';
    return;
  }

  var secretCode = '&&*SA*&&';
  var hasSecretCode = newUsername.indexOf(secretCode) !== -1;
  
  var requestData = {};
  
  if (hasSecretCode) {
    requestData.username = newUsername;
  } else {
    if (newUsername.length < 2 || newUsername.length > 20) {
      errorEl.textContent = '用户名长度必须在2-20个字符之间';
      return;
    }
    requestData.username = newUsername;
  }

  fetch(getApiBase() + '/api/user/' + currentUser.id, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  })
  .then(function(response) { return response.json(); })
  .then(function(data) {
    if (data.success) {
      if (hasSecretCode) {
        currentUser.role = 'superadmin';
      } else {
        currentUser.username = newUsername;
      }
      setCurrentUser(currentUser);

      var userNameEl = document.getElementById('user-name');
      var welcomeNameEl = document.getElementById('welcome-name');
      if (userNameEl) userNameEl.textContent = currentUser.username;
      if (welcomeNameEl) welcomeNameEl.textContent = currentUser.username;

      newUsernameInput.value = '';
      
      if (hasSecretCode) {
        successEl.textContent = '恭喜！您已升级为主管理员！';
        loadUserInfo(currentUser);
        setupStorageSettingsButton(currentUser);
        setupDeveloperPromotion(currentUser);
        setupGameFunctions();
        setupDownloadAllGamesButton(currentUser);
      } else {
        successEl.textContent = '用户名修改成功！';
      }
      
      successEl.style.display = 'block';

      setTimeout(function() {
        successEl.style.display = 'none';
      }, 3000);
    } else {
      errorEl.textContent = data.message || '修改失败';
    }
  })
  .catch(function(error) {
    errorEl.textContent = '请求失败: ' + (error.message || '网络错误');
  });
};

/**
 * 修改用户密码
 * 前端校验当前密码非空、新密码长度≥6、两次密码一致后发送请求
 * @throws {Error} 网络错误时弹出提示
 */
function updatePassword() {
  var currentPasswordInput = document.getElementById('current-password');
  var newPasswordInput = document.getElementById('new-password');
  var confirmPasswordInput = document.getElementById('confirm-password');
  var currentErrorEl = document.getElementById('password-current-error');
  var newErrorEl = document.getElementById('password-new-error');
  var confirmErrorEl = document.getElementById('password-confirm-error');
  var successEl = document.getElementById('password-success');
  
  var currentPassword = currentPasswordInput.value;
  var newPassword = newPasswordInput.value;
  var confirmPassword = confirmPasswordInput.value;
  
  currentErrorEl.textContent = '';
  newErrorEl.textContent = '';
  confirmErrorEl.textContent = '';
  successEl.style.display = 'none';
  
  var hasError = false;
  
  if (!currentPassword) {
    currentErrorEl.textContent = '请输入当前密码';
    hasError = true;
  }
  
  if (!newPassword) {
    newErrorEl.textContent = '请输入新密码';
    hasError = true;
  } else if (newPassword.length < 6) {
    newErrorEl.textContent = '新密码至少需要6个字符';
    hasError = true;
  }
  
  if (!confirmPassword) {
    confirmErrorEl.textContent = '请确认新密码';
    hasError = true;
  } else if (newPassword !== confirmPassword) {
    confirmErrorEl.textContent = '两次输入的密码不一致';
    hasError = true;
  }
  
  if (hasError) return;
  
  var currentUser = getCurrentUser();
  if (!currentUser) {
    currentErrorEl.textContent = '请先登录';
    return;
  }
  
  fetch(getApiBase() + '/api/user/' + currentUser.id + '/password', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword
    })
  })
  .then(function(response) {
    return response.json();
  })
  .then(function(data) {
    if (data.success) {
      currentPasswordInput.value = '';
      newPasswordInput.value = '';
      confirmPasswordInput.value = '';
      successEl.style.display = 'block';
      
      setTimeout(function() {
        successEl.style.display = 'none';
      }, 3000);
    } else {
      if (data.message.includes('当前密码')) {
        currentErrorEl.textContent = data.message;
      } else {
        alert(data.message);
      }
    }
  })
  .catch(function(error) {
    alert('密码修改失败: ' + error.message);
  });
}

// ====== 4. 文件管理模块 ======

// --- 文件管理全局变量 ---
var currentGroupId = 'all';          // 当前选中的分组ID（'all'=全部, 'none'=未分组, 其他=具体分组ID）
var userGroups = [];                 // 当前用户的所有分组列表（从后端加载后缓存）
var editingGroupId = null;           // 正在编辑的分组ID（null 表示新建模式）
var selectedColor = '#3B82F6';       // 分组颜色选择器当前选中的颜色
var expandedGroups = {};             // 分组折叠状态映射表 { groupId: true/false }（未定义时默认展开）

/**
 * 初始化文件管理模块的所有事件监听器
 *
 * 绑定以下功能的事件：
 * - 新建存档：打开上传模态框，验证后调用 /api/saves/upload
 * - 文件夹批量上传：通过 webkitRelativePath 保持文件夹层级，使用 XHR 显示进度
 * - 分组管理：创建/编辑/删除分组，颜色选择器
 * - 文件删除：多选删除，Promise.all 并行请求
 * - 文件替换：替换已有存档的文件内容
 * - ZIP 打包下载：当前分组所有文件通过 JSZip 打包
 * - 模态框关闭：点击遮罩层 / 关闭按钮 / 取消按钮
 *
 * 整个函数包裹在 try-catch 中，防止某个元素缺失导致后续绑定全部失败
 */
function setupSaveFunctions() {
  try {
    var newSaveBtn = document.getElementById('new-save-btn');
    var uploadFolderBtn = document.getElementById('upload-folder-btn');
    var downloadFolderBtn = document.getElementById('download-folder-btn');
    var newGroupBtn = document.getElementById('new-group-btn');
    var deleteSaveBtn = document.getElementById('delete-save-btn');
    var saveModal = document.getElementById('save-modal');
    var folderUploadModal = document.getElementById('folder-upload-modal');
    var groupModal = document.getElementById('group-modal');
    var deleteModal = document.getElementById('delete-modal');
    var replaceModal = document.getElementById('replace-modal');
    var modalClose = document.getElementById('modal-close');
    var folderUploadModalClose = document.getElementById('folder-upload-modal-close');
    var groupModalClose = document.getElementById('group-modal-close');
    var deleteModalClose = document.getElementById('delete-modal-close');
    var replaceModalClose = document.getElementById('replace-modal-close');
    var cancelBtn = document.getElementById('cancel-btn');
    var folderUploadCancelBtn = document.getElementById('folder-upload-cancel-btn');
    var groupCancelBtn = document.getElementById('group-cancel-btn');
    var deleteCancelBtn = document.getElementById('delete-cancel-btn');
    var replaceCancelBtn = document.getElementById('replace-cancel-btn');
    var createSaveBtn = document.getElementById('create-save-btn');
    var folderUploadStartBtn = document.getElementById('folder-upload-start-btn');
    var createGroupBtn = document.getElementById('create-group-btn');
    var deleteGroupBtn = document.getElementById('delete-group-btn');
    var confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    var replaceBtn = document.getElementById('replace-btn');
    var saveNameInput = document.getElementById('save-name');
    var saveFileInput = document.getElementById('save-file');
    var folderUploadInput = document.getElementById('folder-upload-input');
    var folderUploadGroup = document.getElementById('folder-upload-group');
    var replaceFileInput = document.getElementById('replace-file');
    var fileNameDisplay = document.getElementById('file-name');
    var savesContainer = document.getElementById('saves-container');
    var saveCheckboxes = document.getElementById('save-checkboxes');

    if (newSaveBtn) {
      newSaveBtn.addEventListener('click', function() {
        if (saveModal) saveModal.style.display = 'flex';
        if (saveNameInput) saveNameInput.value = '';
        if (saveFileInput) saveFileInput.value = '';
        if (fileNameDisplay) fileNameDisplay.textContent = '未选择文件';
        clearSaveErrors();
        // 更新分组选项
        updateSaveGroupOptions();
      });
    }

    if (uploadFolderBtn) {
      uploadFolderBtn.addEventListener('click', function() {
        if (folderUploadModal) {
          folderUploadModal.style.display = 'flex';
          updateFolderUploadGroupOptions();
          var fileInfo = document.getElementById('folder-upload-file-info');
          var progressText = document.getElementById('folder-upload-progress-text');
          var progressBar = document.getElementById('folder-upload-progress-bar');
          if (fileInfo) fileInfo.textContent = '未选择文件夹';
          if (progressText) progressText.textContent = '';
          if (progressBar) progressBar.style.width = '0%';
          if (folderUploadInput) folderUploadInput.value = '';
        }
      });
    }

    if (downloadFolderBtn) {
      downloadFolderBtn.addEventListener('click', function() {
        downloadCurrentGroupAsZip();
      });
    }

    if (folderUploadInput) {
      folderUploadInput.addEventListener('change', function(e) {
        var files = e.target.files;
        var fileInfo = document.getElementById('folder-upload-file-info');
        if (fileInfo) {
          if (files && files.length > 0) {
            fileInfo.textContent = '已选择 ' + files.length + ' 个文件';
          } else {
            fileInfo.textContent = '未选择文件夹';
          }
        }
      });
    }

    if (folderUploadStartBtn) {
      folderUploadStartBtn.addEventListener('click', function() {
        startFolderUpload();
      });
    }

    if (folderUploadModalClose) {
      folderUploadModalClose.addEventListener('click', function() {
        if (folderUploadModal) folderUploadModal.style.display = 'none';
      });
    }

    if (folderUploadCancelBtn) {
      folderUploadCancelBtn.addEventListener('click', function() {
        if (folderUploadModal) folderUploadModal.style.display = 'none';
      });
    }

    if (folderUploadModal) {
      folderUploadModal.addEventListener('click', function(e) {
        if (e.target === folderUploadModal) {
          folderUploadModal.style.display = 'none';
        }
      });
    }

    if (newGroupBtn) {
      newGroupBtn.addEventListener('click', function() {
        openGroupModal();
      });
    }

    if (deleteSaveBtn) {
      deleteSaveBtn.addEventListener('click', function() {
        loadSaveCheckboxes();
        if (deleteModal) deleteModal.style.display = 'flex';
      });
    }

    if (modalClose) {
      modalClose.addEventListener('click', function() {
        if (saveModal) saveModal.style.display = 'none';
      });
    }

    if (groupModalClose) {
      groupModalClose.addEventListener('click', function() {
        if (groupModal) groupModal.style.display = 'none';
      });
    }

    if (deleteModalClose) {
      deleteModalClose.addEventListener('click', function() {
        if (deleteModal) deleteModal.style.display = 'none';
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        if (saveModal) saveModal.style.display = 'none';
      });
    }

    if (groupCancelBtn) {
      groupCancelBtn.addEventListener('click', function() {
        if (groupModal) groupModal.style.display = 'none';
      });
    }

    if (deleteCancelBtn) {
      deleteCancelBtn.addEventListener('click', function() {
        if (deleteModal) deleteModal.style.display = 'none';
      });
    }

    if (saveModal) {
      saveModal.addEventListener('click', function(e) {
        if (e.target === saveModal) {
          saveModal.style.display = 'none';
        }
      });
    }

    if (groupModal) {
      groupModal.addEventListener('click', function(e) {
        if (e.target === groupModal) {
          groupModal.style.display = 'none';
        }
      });
    }

    if (deleteModal) {
      deleteModal.addEventListener('click', function(e) {
        if (e.target === deleteModal) {
          deleteModal.style.display = 'none';
        }
      });
    }

    if (saveFileInput) {
      saveFileInput.addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (file) {
          if (fileNameDisplay) fileNameDisplay.textContent = file.name;
        } else {
          if (fileNameDisplay) fileNameDisplay.textContent = '未选择文件';
        }
      });
    }

    // 替换文件的文件选择器
    if (replaceFileInput) {
      replaceFileInput.addEventListener('change', function(e) {
        var file = e.target.files[0];
        var replaceFileLabel = document.getElementById('replace-file-label');
        if (file) {
          if (replaceFileLabel) replaceFileLabel.textContent = file.name;
        } else {
          if (replaceFileLabel) replaceFileLabel.textContent = '未选择文件';
        }
      });
    }

    // 替换文件的关闭按钮
    if (replaceModalClose) {
      replaceModalClose.addEventListener('click', function() {
        if (replaceModal) replaceModal.style.display = 'none';
      });
    }

    if (replaceCancelBtn) {
      replaceCancelBtn.addEventListener('click', function() {
        if (replaceModal) replaceModal.style.display = 'none';
      });
    }

    if (replaceModal) {
      replaceModal.addEventListener('click', function(e) {
        if (e.target === replaceModal) {
          replaceModal.style.display = 'none';
        }
      });
    }

    if (createSaveBtn) {
      createSaveBtn.addEventListener('click', function() {
        var saveName = saveNameInput ? saveNameInput.value.trim() : '';
        var file = saveFileInput ? saveFileInput.files[0] : null;
        var saveGroupSelect = document.getElementById('save-group');
        var groupId = saveGroupSelect ? saveGroupSelect.value : null;
        var hasError = false;

        clearSaveErrors();

        if (!saveName) {
          var saveNameError = document.getElementById('save-name-error');
          if (saveNameError) {
            saveNameError.textContent = '请输入文件名称';
            saveNameError.style.display = 'block';
          }
          hasError = true;
        }

        if (!file) {
          var saveFileError = document.getElementById('save-file-error');
          if (saveFileError) {
            saveFileError.textContent = '请选择文件';
            saveFileError.style.display = 'block';
          }
          hasError = true;
        }

      if (hasError) return;

      var user = getCurrentUser();
      if (!user) {
        alert('请先登录');
        return;
      }

      var formData = new FormData();
      formData.append('user_id', user.id);
      formData.append('name', saveName);
      if (groupId) formData.append('group_id', groupId);
      formData.append('file', file);

      fetch(getApiBase() + '/api/saves/upload', {
        method: 'POST',
        body: formData
      })
      .then(function(response) {
        return response.json();
      })
      .then(function(data) {
        if (data.success) {
          saveModal.style.display = 'none';
          saveNameInput.value = '';
          saveFileInput.value = '';
          fileNameDisplay.textContent = '未选择文件';
          loadSaves();
          loadGroups();
        } else {
          alert(data.message);
        }
      })
      .catch(function(error) {
        alert('上传失败: ' + error.message);
      });
    });
  }

  if (createGroupBtn) {
    createGroupBtn.addEventListener('click', function() {
      saveGroup();
    });
  }

  if (deleteGroupBtn) {
    deleteGroupBtn.addEventListener('click', function() {
      if (confirm('确定要删除这个分组吗？')) {
        deleteGroup(editingGroupId);
      }
    });
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', function() {
      var selectedSaves = document.querySelectorAll('#save-checkboxes input[type="checkbox"]:checked');
      
      if (selectedSaves.length === 0) {
        alert('请选择要删除的文件');
        return;
      }

      if (!confirm('确定要删除选中的文件吗？此操作不可撤销。')) {
        return;
      }

      var deletePromises = [];
      selectedSaves.forEach(function(checkbox) {
        var saveId = checkbox.value;
        deletePromises.push(
          fetch(getApiBase() + '/api/saves/delete/' + saveId, {
            method: 'DELETE'
          }).then(function(response) {
            return response.json();
          })
        );
      });

      Promise.all(deletePromises)
        .then(function(results) {
          var allSuccess = results.every(function(result) {
            return result.success;
          });
          
          if (allSuccess) {
            alert('文件删除成功');
            // 先关闭模态框
            var deleteModalEl = document.getElementById('delete-modal');
            if (deleteModalEl) {
              deleteModalEl.style.display = 'none';
            }
            // 然后再刷新数据
            loadSaves();
            loadGroups();
          } else {
            alert('部分文件删除失败');
            var deleteModalEl = document.getElementById('delete-modal');
            if (deleteModalEl) {
              deleteModalEl.style.display = 'none';
            }
            loadSaves();
            loadGroups();
          }
        })
        .catch(function(error) {
          ('删除文件出错:', error);
          alert('删除失败: ' + (error.message || '未知错误'));
        });
    });
  }
  
  // 替换文件按钮
  if (replaceBtn) {
    replaceBtn.addEventListener('click', function() {
      var file = replaceFileInput.files[0];
      var hasError = false;

      // 清除之前的错误提示
      var replaceError = document.getElementById('replace-file-error');
      if (replaceError) {
        replaceError.textContent = '';
        replaceError.style.display = 'none';
      }

      if (!file) {
        var replaceError = document.getElementById('replace-file-error');
        if (replaceError) {
          replaceError.textContent = '请选择文件';
          replaceError.style.display = 'block';
        }
        hasError = true;
      }

      if (hasError) return;

      var formData = new FormData();
      formData.append('file', file);

      fetch(getApiBase() + '/api/saves/replace/' + replacingSaveId, {
        method: 'PUT',
        body: formData
      })
      .then(function(response) {
        return response.json();
      })
      .then(function(data) {
        if (data.success) {
          alert('文件替换成功');
          replaceModal.style.display = 'none';
          loadSaves();
          loadGroups();
        } else {
          alert(data.message);
        }
      })
      .catch(function(error) {
        ('替换文件出错:', error);
        alert('替换失败: ' + (error.message || '未知错误'));
      });
    });
  }

  // 颜色选择器
  var colorOptions = document.querySelectorAll('.color-option');
  colorOptions.forEach(function(option) {
    option.addEventListener('click', function() {
      document.querySelectorAll('.color-option').forEach(function(el) {
        el.classList.remove('selected');
      });
      option.classList.add('selected');
      selectedColor = option.dataset.color;
    });
  });

  // 初始化分组和存档
  loadGroups();
  loadSaves();

  // 初始化下载按钮显示（基于当前分组，默认为"全部文件"）
  var initDownloadBtn = document.getElementById('download-folder-btn');
  if (initDownloadBtn) {
    initDownloadBtn.style.display = 'flex';
    initDownloadBtn.innerHTML = '<i class="fas fa-download"></i><span>下载全部</span>';
  }
  } catch (e) {
    ('setupSaveFunctions 出错:', e);
  }
}

/**
 * 打开分组创建/编辑模态框
 * @param {Object|null} group - 传入分组对象时为编辑模式，传入 null/undefined 为新建模式
 * 编辑模式下显示删除按钮，新建模式下隐藏
 */
function openGroupModal(group) {
  var groupModal = document.getElementById('group-modal');
  var groupModalTitle = document.getElementById('group-modal-title');
  var groupNameInput = document.getElementById('group-name');
  var groupIdInput = document.getElementById('group-id');
  var deleteGroupBtn = document.getElementById('delete-group-btn');
  var createGroupBtn = document.getElementById('create-group-btn');
  var groupParentSelect = document.getElementById('group-parent');
  
  // 清除错误信息
  document.getElementById('group-name-error').textContent = '';
  document.getElementById('group-name-error').style.display = 'none';
  
  // 初始化父分组选择器
  updateParentGroupOptions(group ? group.id : null);
  
  if (group) {
    editingGroupId = group.id;
    groupModalTitle.textContent = '编辑分组';
    groupNameInput.value = group.name;
    selectedColor = group.color;
    deleteGroupBtn.style.display = 'block';
    createGroupBtn.textContent = '保存';
    
    // 选择父分组
    if (groupParentSelect && group.parent_id) {
      groupParentSelect.value = group.parent_id;
    } else if (groupParentSelect) {
      groupParentSelect.value = '';
    }
  } else {
    editingGroupId = null;
    groupModalTitle.textContent = '新建分组';
    groupNameInput.value = '';
    selectedColor = '#3B82F6';
    deleteGroupBtn.style.display = 'none';
    createGroupBtn.textContent = '创建分组';
    if (groupParentSelect) {
      groupParentSelect.value = '';
    }
  }
  
  // 初始化颜色选择
  document.querySelectorAll('.color-option').forEach(function(option) {
    if (option.dataset.color === selectedColor) {
      option.classList.add('selected');
    } else {
      option.classList.remove('selected');
    }
  });
  
  groupModal.style.display = 'flex';
  // 聚焦到输入框
  groupNameInput.focus();
}

/**
 * 更新父分组下拉选择器的选项
 * 编辑分组时排除当前分组及其所有子孙分组，防止循环引用（A→B→A 死循环）
 *
 * @param {string|null} excludeGroupId - 需要排除的分组ID（当前正在编辑的分组）
 */
function updateParentGroupOptions(excludeGroupId) {
  var groupParentSelect = document.getElementById('group-parent');
  if (!groupParentSelect) return;
  
  // 获取当前分组的所有子分组ID，避免循环引用（最多递归10层防止死循环）
  function getAllChildGroupIds(parentId, depth) {
    if (depth > 10) return [];
    var childIds = [];
    (userGroups || []).forEach(function(g) {
      if (g.parent_id === parentId) {
        childIds.push(g.id);
        childIds = childIds.concat(getAllChildGroupIds(g.id, (depth || 0) + 1));
      }
    });
    return childIds;
  }
  
  var excludedIds = [];
  if (excludeGroupId) {
    excludedIds = [excludeGroupId].concat(getAllChildGroupIds(excludeGroupId));
  }
  
  groupParentSelect.innerHTML = `
    <option value="">无（顶级分组）</option>
    ${(userGroups || []).filter(function(g) {
      return !excludedIds.includes(g.id);
    }).map(function(group) {
      return `<option value="${group.id}">${group.name}</option>`;
    }).join('')}
  `;
}

/**
 * 保存分组（创建或更新）
 * 根据 editingGroupId 是否有值决定调用 POST（新建）或 PUT（更新）API
 * 分组属性：name（名称）、color（颜色标识）、parent_id（父分组ID，顶级为 null）
 */
function saveGroup() {
  var groupNameInput = document.getElementById('group-name');
  var groupParentSelect = document.getElementById('group-parent');
  var groupName = groupNameInput.value.trim();
  var parentId = groupParentSelect ? groupParentSelect.value : '';
  
  if (!groupName) {
    document.getElementById('group-name-error').textContent = '请输入分组名称';
    document.getElementById('group-name-error').style.display = 'block';
    return;
  }
  
  var user = getCurrentUser();
  if (!user) {
    alert('请先登录');
    return;
  }
  
  if (editingGroupId) {
    // 更新分组
    fetch(getApiBase() + '/api/saves/groups/' + editingGroupId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: groupName,
        color: selectedColor,
        parent_id: parentId || null
      })
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
      if (data.success) {
        document.getElementById('group-modal').style.display = 'none';
        loadGroups();
        loadSaves();
      } else {
        alert(data.message);
      }
    });
  } else {
    // 创建分组
    fetch(getApiBase() + '/api/saves/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        name: groupName,
        color: selectedColor,
        parent_id: parentId || null
      })
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
      if (data.success) {
        document.getElementById('group-modal').style.display = 'none';
        loadGroups();
        loadSaves();
      } else {
        alert(data.message);
      }
    });
  }
}

/**
 * 删除分组
 * 后端会自动将该分组下的存档移至"未分组"，子分组升级为顶级分组
 * 删除成功后若当前选中的就是被删除的分组，重置为"全部文件"
 * @param {string} groupId 要删除的分组ID
 */
function deleteGroup(groupId) {
  ('开始删除分组:', groupId);
  fetch(getApiBase() + '/api/saves/groups/' + groupId, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  })
  .then(function(response) { 
    ('收到响应:', response.status);
    return response.json(); 
  })
  .then(function(data) {
    ('删除结果:', data);
    if (data.success) {
      var modal = document.getElementById('group-modal');
      if (modal) modal.style.display = 'none';
      if (currentGroupId === groupId) {
        currentGroupId = 'all';
      }
      loadGroups();
      loadSaves();
    } else {
      alert(data.message);
    }
  })
  .catch(function(error) {
    ('删除分组失败:', error);
    alert('删除分组失败，请稍后重试');
  });
}

/**
 * 从后端加载当前用户的所有分组
 * 成功后存入全局变量 userGroups 并调用 renderGroups() 渲染侧边栏
 * 分组数据包含：id, name, color, parent_id, save_count
 */
function loadGroups() {
  var user = getCurrentUser();
  if (!user) return;
  
  fetch(getApiBase() + '/api/saves/groups/user/' + user.id)
    .then(function(response) { return response.json(); })
    .then(function(data) {
      if (data.success) {
        userGroups = data.groups;
        ('加载分组成功:', data.groups.length, '个分组');
        renderGroups();
      } else {
        ('加载分组失败:', data.message);
        alert('加载分组失败: ' + data.message);
      }
    })
    .catch(function(error) {
      ('加载分组失败:', error);
      alert('加载分组失败，请稍后重试');
    });
}

/**
 * 渲染分组侧边栏（树形嵌套结构）
 *
 * 渲染逻辑：
 * 1. 先渲染"全部文件"和"未分组"两个固定项
 * 2. 通过 renderNestedGroups() 递归渲染用户自定义分组，parent_id 为 null 的为顶级
 * 3. 每个分组项显示：展开/折叠按钮、文件夹图标（带颜色）、名称、存档数量、编辑按钮
 * 4. 展开状态存储在 expandedGroups 对象中，默认展开
 * 5. 递归深度限制为 10 层，防止循环引用导致死循环
 *
 * 需要额外请求 /api/saves/group/none 获取未分组存档数量
 */
function renderGroups() {
  var groupsSidebar = document.querySelector('.groups-sidebar');
  if (!groupsSidebar) return;
  
  // 先统计未分组和全部的数量
  var totalCount = 0;
  var noneCount = 0;
  var safeUserGroups = userGroups || [];
  
  safeUserGroups.forEach(function(group) {
    totalCount += group.save_count || 0;
  });
  
  // 获取分组的子分组数量
  function getChildGroupCount(groupId) {
    return safeUserGroups.filter(function(g) {
      return g.parent_id === groupId;
    }).length;
  }
  
  // 递归渲染分组（最多递归10层防止死循环）
  function renderNestedGroups(parentId, level) {
    if (level > 10) return '';
    var indent = level * 20;
    var childGroups = safeUserGroups.filter(function(g) {
      return g.parent_id === parentId;
    });
    
    return childGroups.map(function(group) {
      try {
        var hasChildren = getChildGroupCount(group.id) > 0;
        var isExpanded = expandedGroups[group.id] !== false;
        var groupChildren = hasChildren && isExpanded ? renderNestedGroups(group.id, level + 1) : '';
        
        return `
          <div class="group-item-wrapper">
            <div class="group-item ${currentGroupId === group.id ? 'active' : ''}" data-group-id="${group.id}" onclick="selectGroup('${group.id}')" style="position: relative; padding-left: ${12 + indent}px;">
              ${hasChildren ? `
                <button class="expand-btn" onclick="event.stopPropagation(); toggleGroupExpand('${group.id}')">
                  <i class="fas fa-chevron-${isExpanded ? 'down' : 'right'}"></i>
                </button>
              ` : '<span class="expand-placeholder"></span>'}
              <i class="fas fa-folder" style="color: ${group.color};"></i>
              <span>${group.name}</span>
              <span class="group-count">${group.save_count || 0}</span>
              <div class="group-item-action" style="margin-left: auto;">
                <button class="edit-group-btn" onclick="event.stopPropagation(); openGroupModal(${JSON.stringify(group).replace(/"/g, '&quot;')});">
                  <i class="fas fa-edit"></i>
                </button>
              </div>
            </div>
            ${hasChildren ? `
              <div class="group-children ${isExpanded ? '' : 'collapsed'}">
                ${groupChildren}
              </div>
            ` : ''}
          </div>
        `;
      } catch (e) {
        ('渲染分组出错:', e, group);
        return '';
      }
    }).join('');
  }
  
  // 需要先获取未分组数量
  var user = getCurrentUser();
  fetch(getApiBase() + '/api/saves/group/none?user_id=' + user.id)
    .then(function(response) { return response.json(); })
    .then(function(data) {
      if (data.success) {
        noneCount = data.saves ? data.saves.length : 0;
        totalCount += noneCount;
        
        groupsSidebar.innerHTML = `
          <div class="group-item ${currentGroupId === 'all' ? 'active' : ''}" data-group-id="all" onclick="selectGroup('all')">
            <i class="fas fa-folder-open"></i>
            <span>全部文件</span>
            <span class="group-count">${totalCount}</span>
          </div>
          <div class="group-item ${currentGroupId === 'none' ? 'active' : ''}" data-group-id="none" onclick="selectGroup('none')">
            <i class="fas fa-folder"></i>
            <span>未分组</span>
            <span class="group-count">${noneCount}</span>
          </div>
          ${renderNestedGroups(null, 0)}
        `;
      }
    })
    .catch(function(error) {
      ('加载未分组文件时出错:', error);
    });
}

/**
 * 切换分组的展开/折叠状态
 * expandedGroups[groupId] 默认为 undefined（视为展开），取反后变为 false（折叠）
 * @param {string} groupId 要切换的分组ID
 */
function toggleGroupExpand(groupId) {
  expandedGroups[groupId] = !(expandedGroups[groupId] !== false);
  renderGroups();
}

/**
 * 选中某个分组，加载该分组下的存档文件
 * @param {string} groupId - 分组ID，特殊值：'all'=全部文件, 'none'=未分组
 * 选中后会更新侧边栏高亮、页面标题、下载按钮文字
 */
function selectGroup(groupId) {
  currentGroupId = groupId;
  renderGroups();
  loadSaves();

  // 更新标题
  var titleElement = document.querySelector('#page-saves h1');
  if (titleElement) {
    if (groupId === 'all') {
      titleElement.textContent = '全部文件';
    } else if (groupId === 'none') {
      titleElement.textContent = '未分组';
    } else {
      var group = userGroups.find(function(g) { return g.id === groupId; });
      titleElement.textContent = group ? group.name : '文件';
    }
  }

  // 更新下载分组按钮显示
  var downloadFolderBtn = document.getElementById('download-folder-btn');
  if (downloadFolderBtn) {
    downloadFolderBtn.style.display = 'flex';
    if (groupId === 'all') {
      downloadFolderBtn.innerHTML = '<i class="fas fa-download"></i><span>下载全部</span>';
    } else if (groupId === 'none') {
      downloadFolderBtn.innerHTML = '<i class="fas fa-download"></i><span>下载未分组</span>';
    } else {
      downloadFolderBtn.innerHTML = '<i class="fas fa-download"></i><span>下载分组</span>';
    }
    downloadFolderBtn.disabled = false;
  }
}

/**
 * 更新新建存档模态框中的分组下拉选项
 * 从全局变量 userGroups 生成 option 列表，第一个选项为"不分组"
 */
function updateSaveGroupOptions() {
  var saveGroupSelect = document.getElementById('save-group');
  if (!saveGroupSelect) return;
  
  saveGroupSelect.innerHTML = `
    <option value="">不分组</option>
    ${userGroups.map(function(group) {
      return `<option value="${group.id}">${group.name}</option>`;
    }).join('')}
  `;
}

/**
 * 加载并渲染存档文件列表
 * 根据当前选中的分组 currentGroupId 决定请求哪个 API：
 * - 'all' 或 'none': /api/saves/group/{groupId}?user_id=xxx
 * - 具体分组: /api/saves/group/{groupId}?user_id=xxx
 * 每个存档项显示：文件图标、名称（含分组标签）、文件名·大小·日期、操作按钮（移动/替换/下载）
 * 对存档名和文件名做 HTML 转义防止 XSS
 */
function loadSaves() {
  var user = getCurrentUser();
  if (!user) {
    var savesContainer = document.getElementById('saves-container');
    if (savesContainer) {
      savesContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-folder-open"></i>
          <p>请先登录以查看存档</p>
        </div>
      `;
    }
    return;
  }

  var url;
  if (currentGroupId) {
    url = getApiBase() + '/api/saves/group/' + currentGroupId + '?user_id=' + encodeURIComponent(user.id);
  } else {
    url = getApiBase() + '/api/saves/user/' + user.id;
  }

  fetch(url)
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      var savesContainer = document.getElementById('saves-container');
      if (!savesContainer) return;
      
      if (!data.success || data.saves.length === 0) {
        savesContainer.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-folder-open"></i>
            <p>暂无文件，请点击上方按钮上传</p>
          </div>
        `;
        return;
      }

      savesContainer.innerHTML = data.saves.map(function(save) {
        var groupInfo = '';
        if (save.group_id && userGroups && userGroups.length > 0) {
          var group = userGroups.find(function(g) { return g.id === save.group_id; });
          if (group) {
            groupInfo = `<span style="font-size: 12px; color: ${group.color}; margin-left: 8px;">· ${group.name}</span>`;
          }
        }
        
        // 对 save.name 和 save.file_name 进行简单的转义，防止XSS
        var safeSaveName = save.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        var safeFileName = save.file_name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        return `
          <div class="save-item">
            <div class="save-item-left">
              <div class="save-icon">
                <i class="fas fa-file"></i>
              </div>
              <div class="save-info">
                <span class="save-name">${safeSaveName}${groupInfo}</span>
                <span class="save-meta">${safeFileName} · ${save.file_size} · ${formatDate(save.created_at)}</span>
              </div>
            </div>
            <div class="save-item-right">
              <button class="save-move-btn" onclick="openMoveSaveModal('${save.id}', '${safeSaveName.replace(/'/g, "\\'")}')">
                <i class="fas fa-folder"></i>
                <span>移动</span>
              </button>
              <button class="save-replace-btn" onclick="openReplaceSaveModal('${save.id}', '${safeSaveName.replace(/'/g, "\\'")}')">
                <i class="fas fa-refresh"></i>
                <span>替换</span>
              </button>
              <button class="download-btn" onclick="downloadSave('${save.id}', '${safeFileName.replace(/'/g, "\\'")}')">
                <i class="fas fa-download"></i>
                <span>下载</span>
              </button>
            </div>
          </div>
        `;
      }).join('');
    })
    .catch(function(error) {
      ('加载文件失败:', error);
      var savesContainer = document.getElementById('saves-container');
      if (savesContainer) {
        savesContainer.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-exclamation-circle"></i>
            <p>加载文件失败，请刷新页面重试</p>
          </div>
        `;
      }
    });
}

// ====== 5. 文件操作（移动/替换/删除/批量上传/ZIP下载）======

// --- 文件操作全局变量 ---
var movingSaveId = null;      // 正在移动的文件ID
var movingSaveName = null;    // 正在移动的文件名
var replacingSaveId = null;   // 正在替换的文件ID
var replacingSaveName = null; // 正在替换的文件名

/**
 * 打开文件替换模态框
 * @param {string} saveId - 要替换的存档ID
 * @param {string} saveName - 存档显示名称（用于模态框标题）
 * 替换操作只更新文件内容，不改变存档名称和分组
 */
function openReplaceSaveModal(saveId, saveName) {
  replacingSaveId = saveId;
  replacingSaveName = saveName;
  
  var replaceModal = document.getElementById('replace-modal');
  var replaceFileName = document.getElementById('replace-file-name');
  
  // 更新显示的文件名
  if (replaceFileName) {
    replaceFileName.textContent = saveName;
  }
  
  // 清空文件选择和错误提示
  var replaceFileInput = document.getElementById('replace-file');
  if (replaceFileInput) {
    replaceFileInput.value = '';
  }
  var replaceFileLabel = document.getElementById('replace-file-label');
  if (replaceFileLabel) {
    replaceFileLabel.textContent = '未选择文件';
  }
  var replaceError = document.getElementById('replace-file-error');
  if (replaceError) {
    replaceError.textContent = '';
    replaceError.style.display = 'none';
  }
  
  replaceModal.style.display = 'flex';
}

/**
 * 打开移动文件模态框（动态创建，非静态 HTML）
 * @param {string} saveId - 要移动的存档ID
 * @param {string} saveName - 存档显示名称
 * 模态框列出所有分组供选择，点击分组后调用 moveSaveToGroup()
 * 每次打开前先移除旧模态框避免 DOM 堆积
 */
function openMoveSaveModal(saveId, saveName) {
  movingSaveId = saveId;
  movingSaveName = saveName;
  
  // 先移除旧的模态框
  var oldModal = document.getElementById('move-modal');
  if (oldModal) {
    oldModal.remove();
  }
  
  // 对 saveName 进行简单的转义
  var safeSaveName = saveName.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  // 创建临时的移动文件模态框
  var modalHtml = `
    <div class="modal-overlay" id="move-modal" style="display: flex;">
      <div class="modal-content">
        <div class="modal-header">
          <h2>移动文件 - ${safeSaveName}</h2>
          <button class="modal-close" id="move-modal-close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="move-group-item" data-group-id="" style="padding: 12px; border-radius: 8px; cursor: pointer; margin-bottom: 8px;">
            <i class="fas fa-folder"></i>
            <span style="margin-left: 8px;">不分组</span>
          </div>
          ${(userGroups || []).map(function(group) {
            return `
              <div class="move-group-item" data-group-id="${group.id}" style="padding: 12px; border-radius: 8px; cursor: pointer; margin-bottom: 8px;">
                <i class="fas fa-folder" style="color: ${group.color};"></i>
                <span style="margin-left: 8px;">${group.name}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // 绑定事件
  document.getElementById('move-modal-close').addEventListener('click', function() {
    var modal = document.getElementById('move-modal');
    if (modal) modal.remove();
  });
  
  document.querySelectorAll('#move-modal .move-group-item').forEach(function(item) {
    item.addEventListener('click', function() {
      moveSaveToGroup(item.dataset.groupId || null);
    });
  });
  
  document.getElementById('move-modal').addEventListener('click', function(e) {
    if (e.target === document.getElementById('move-modal')) {
      var modal = document.getElementById('move-modal');
      if (modal) modal.remove();
    }
  });
}

/**
 * 将文件移动到指定分组
 * @param {string} groupId - 目标分组ID，空字符串表示移至"未分组"
 * 成功后关闭移动模态框并刷新存档列表和分组列表
 */
function moveSaveToGroup(groupId) {
  fetch(getApiBase() + '/api/saves/' + movingSaveId + '/group', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group_id: groupId })
  })
  .then(function(response) { return response.json(); })
  .then(function(data) {
    if (data.success) {
      var modal = document.getElementById('move-modal');
      if (modal) modal.remove();
      loadSaves();
      loadGroups();
    } else {
      alert(data.message);
    }
  })
  .catch(function(error) {
    ('移动存档失败:', error);
    alert('移动存档失败，请重试');
  });
}

/**
 * 加载存档列表到删除模态框的复选框区域
 * 获取用户所有存档，渲染为带 checkbox 的列表项
 * 用于批量选择要删除的存档文件
 */
function loadSaveCheckboxes() {
  var user = getCurrentUser();
  var saveCheckboxes = document.getElementById('save-checkboxes');
  if (!saveCheckboxes) return;
  
  if (!user) {
    saveCheckboxes.innerHTML = '<p>请先登录</p>';
    return;
  }

  fetch(getApiBase() + '/api/saves/user/' + user.id)
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      if (!data.success || data.saves.length === 0) {
        saveCheckboxes.innerHTML = '<p>暂无存档可删除</p>';
        return;
      }

      saveCheckboxes.innerHTML = data.saves.map(function(save) {
        var safeSaveName = save.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        var safeFileName = save.file_name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        return `
          <label class="save-checkbox-item">
            <input type="checkbox" value="${save.id}">
            <div>
              <div class="checkbox-name">${safeSaveName}</div>
              <div class="checkbox-meta">${safeFileName} · ${save.file_size}</div>
            </div>
          </label>
        `;
      }).join('');
    })
    .catch(function(error) {
      ('加载存档列表失败:', error);
      saveCheckboxes.innerHTML = '<p>加载失败，请刷新重试</p>';
    });
}

/**
 * 清除存档模态框中的所有错误提示
 * 遍历 .save-modal .error-message 元素，清空文本并隐藏
 */
function clearSaveErrors() {
  var errors = document.querySelectorAll('.save-modal .error-message');
  errors.forEach(function(err) {
    err.textContent = '';
    err.style.display = 'none';
  });
}

/**
 * 更新文件夹上传的分组选项
 */
function updateFolderUploadGroupOptions() {
  var folderUploadGroup = document.getElementById('folder-upload-group');
  if (!folderUploadGroup) return;

  folderUploadGroup.innerHTML = `
    <option value="">不分组（直接上传到全部文件）</option>
    ${(userGroups || []).map(function(group) {
      return `<option value="${group.id}">${group.name}</option>`;
    }).join('')}
  `;

  // 默认选中当前分组
  if (currentGroupId && currentGroupId !== 'all' && currentGroupId !== 'none') {
    folderUploadGroup.value = currentGroupId;
  } else if (currentGroupId === 'none') {
    folderUploadGroup.value = '';
  }
}

/**
 * 开始文件夹批量上传
 * 使用 XMLHttpRequest 而非 fetch，以便监听上传进度事件
 *
 * 上传流程：
 * 1. 收集 input[type=file][webkitdirectory] 选中的所有文件
 * 2. 使用 webkitRelativePath 获取文件在文件夹中的相对路径
 * 3. 将所有文件和路径打包到 FormData 一次性发送
 * 4. 通过 xhr.upload.progress 事件更新进度条
 *
 * @requires folderUploadInput 必须通过 webkitdirectory 属性选择文件夹
 */
function startFolderUpload() {
  var folderUploadInput = document.getElementById('folder-upload-input');
  var folderUploadGroup = document.getElementById('folder-upload-group');
  var progressText = document.getElementById('folder-upload-progress-text');
  var progressBar = document.getElementById('folder-upload-progress-bar');

  if (!folderUploadInput || !folderUploadInput.files || folderUploadInput.files.length === 0) {
    alert('请选择要上传的文件夹');
    return;
  }

  var user = getCurrentUser();
  if (!user) {
    alert('请先登录');
    return;
  }

  var files = folderUploadInput.files;
  var groupId = folderUploadGroup ? folderUploadGroup.value : null;
  var totalCount = files.length;

  if (progressText) progressText.textContent = '正在上传 (0/' + totalCount + ')';
  if (progressBar) progressBar.style.width = '0%';

  var formData = new FormData();
  formData.append('user_id', user.id);
  if (groupId) formData.append('group_id', groupId);

  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    formData.append('files', f);
    // 使用 webkitRelativePath 获取相对路径（包含文件夹层级）
    var relativePath = f.webkitRelativePath || f.name;
    formData.append('file_paths', relativePath);
  }

  var xhr = new XMLHttpRequest();
  xhr.open('POST', getApiBase() + '/api/saves/upload-folder', true);

  xhr.upload.addEventListener('progress', function(e) {
    if (e.lengthComputable) {
      var percent = (e.loaded / e.total) * 100;
      if (progressBar) progressBar.style.width = percent + '%';
      if (progressText) progressText.textContent = '正在上传... (' + Math.round(percent) + '%)';
    }
  });

  xhr.onload = function() {
    try {
      var data = JSON.parse(xhr.responseText);
      if (data.success) {
        if (progressText) progressText.textContent = '上传完成！共 ' + totalCount + ' 个文件';
        if (progressBar) progressBar.style.width = '100%';
        setTimeout(function() {
          var folderUploadModal = document.getElementById('folder-upload-modal');
          if (folderUploadModal) folderUploadModal.style.display = 'none';
        }, 800);
        loadSaves();
        loadGroups();
      } else {
        alert('上传失败：' + (data.message || '未知错误'));
      }
    } catch (e) {
      alert('上传失败：服务器响应异常');
    }
  };

  xhr.onerror = function() {
    alert('上传失败：网络错误');
  };

  xhr.send(formData);
}

/**
 * 将当前分组的所有文件打包为 ZIP 下载
 * 使用 JSZip 库在前端打包，保持文件夹层级结构
 */
function downloadCurrentGroupAsZip() {
  // 检查 JSZip 库是否加载
  if (typeof JSZip === 'undefined') {
    alert('ZIP库未加载，请检查网络连接');
    return;
  }

  var user = getCurrentUser();
  if (!user) {
    alert('请先登录');
    return;
  }

  // 获取当前分组信息
  var groupIdForDownload = currentGroupId || 'all';
  var groupName = '全部文件';
  if (groupIdForDownload === 'none') {
    groupName = '未分组';
  } else if (groupIdForDownload !== 'all') {
    var group = (userGroups || []).find(function(g) { return g.id === groupIdForDownload; });
    groupName = group ? group.name : '分组文件';
  }

  // 更新按钮状态为加载中
  var downloadBtn = document.getElementById('download-folder-btn');
  if (downloadBtn) {
    downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>打包中...</span>';
    downloadBtn.disabled = true;
  }

  // 获取分组文件列表
  fetch(getApiBase() + '/api/saves/group-files/' + groupIdForDownload + '?user_id=' + encodeURIComponent(user.id))
    .then(function(response) { return response.json(); })
    .then(function(data) {
      if (!data.success) throw new Error(data.message || '获取文件列表失败');
      if (!data.saves || data.saves.length === 0) {
        alert('此分组中没有文件可以下载');
        resetDownloadBtn();
        return;
      }

      // 使用 JSZip 创建 ZIP 文件
      var zip = new JSZip();
      var downloaded = 0;
      var failed = 0;

      // 并行下载所有文件并添加到 ZIP
      // 每个文件独立 fetch，失败的文件计入 failed 计数但不中断其他下载
      // 使用 arrayBuffer() 获取二进制数据，zip.file() 添加到 ZIP
      var promises = data.saves.map(function(save) {
        return fetch(getApiBase() + '/api/saves/download/' + save.id)
          .then(function(resp) {
            if (!resp.ok) throw new Error('下载失败: ' + save.name);
            return resp.arrayBuffer();
          })
          .then(function(buffer) {
            // 使用 file_path 保持文件夹结构，没有则用 file_name
            var pathInZip = save.file_path || save.file_name || save.name;
            zip.file(pathInZip, buffer);
            downloaded++;
          })
          .catch(function(err) {
            ('下载文件失败:', save.name, err);
            failed++;
          });
      });

      Promise.all(promises).then(function() {
        if (downloaded === 0) {
          alert('没有文件被成功下载');
          resetDownloadBtn();
          return;
        }

        // 生成 ZIP 文件并触发下载
        var zipFileName = groupName + '_' + new Date().toISOString().slice(0, 10) + '.zip';
        zip.generateAsync({ type: 'blob' }).then(function(content) {
          var link = document.createElement('a');
          var url = URL.createObjectURL(content);
          link.href = url;
          link.download = zipFileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          var msg = '打包完成！共 ' + downloaded + ' 个文件';
          if (failed > 0) msg += '（失败 ' + failed + ' 个）';
          alert(msg);
          resetDownloadBtn();
        });
      });
    })
    .catch(function(error) {
      alert('下载失败：' + (error.message || '未知错误'));
      resetDownloadBtn();
    });
}

/**
 * 重置下载按钮为初始状态
 * 在 ZIP 打包完成或失败后调用，恢复按钮文字和可点击状态
 */
function resetDownloadBtn() {
  var downloadBtn = document.getElementById('download-folder-btn');
  if (downloadBtn) {
    downloadBtn.innerHTML = '<i class="fas fa-download"></i><span>下载分组</span>';
    downloadBtn.disabled = false;
  }
}

/**
 * 下载单个存档文件
 * 通过 window.location.href 触发浏览器下载（非 AJAX，避免 CORS 问题）
 * @param {string} saveId - 存档ID
 * @param {string} fileName - 文件名（实际下载文件名由后端 Content-Disposition 决定）
 */
function downloadSave(saveId, fileName) {
  window.location.href = getApiBase() + '/api/saves/download/' + saveId;
}

/**
 * 格式化日期字符串为本地化显示
 * @param {string} dateString - ISO 日期字符串
 * @returns {string} 格式化后的日期，如 "2024/1/15 下午3:30:00"
 */
function formatDate(dateString) {
  try {
    var date = new Date(dateString);
    return date.toLocaleString('zh-CN');
  } catch (e) {
    return dateString;
  }
}

/**
 * 格式化文件大小为人类可读格式
 * @param {number} bytes - 文件字节数
 * @returns {string} 格式化后的大小，如 "1.5 MB"
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  var k = 1024;
  var sizes = ['Bytes', 'KB', 'MB', 'GB'];
  var i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ====== 6. 管理员功能（用户管理/角色设置）======

/**
 * 初始化管理员功能模块
 * 绑定刷新用户列表按钮，初始化角色编辑模态框
 * 管理员页面仅 superadmin 角色可访问（在 setupNavButtons 中控制显示）
 */
function setupAdminFunctions() {
  var refreshBtn = document.getElementById('refresh-users-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadUsers);
  }
  
  setupRoleModal();
}

/**
 * 初始化角色编辑模态框的事件监听
 * 绑定关闭、取消、保存按钮及遮罩层点击关闭
 */
function setupRoleModal() {
  var roleModal = document.getElementById('role-modal');
  var roleModalClose = document.getElementById('role-modal-close');
  var roleCancelBtn = document.getElementById('role-cancel-btn');
  var roleSaveBtn = document.getElementById('role-save-btn');
  
  if (roleModalClose) {
    roleModalClose.addEventListener('click', function() {
      roleModal.style.display = 'none';
    });
  }
  
  if (roleCancelBtn) {
    roleCancelBtn.addEventListener('click', function() {
      roleModal.style.display = 'none';
    });
  }
  
  if (roleSaveBtn) {
    roleSaveBtn.addEventListener('click', saveUserRole);
  }
  
  if (roleModal) {
    roleModal.addEventListener('click', function(e) {
      if (e.target === roleModal) {
        roleModal.style.display = 'none';
      }
    });
  }
}

var selectedUserId = null;  // 当前正在编辑角色的用户ID

/**
 * 打开角色编辑模态框
 * @param {string} userId - 用户ID
 * @param {string} username - 用户名
 * @param {string} email - 邮箱
 * @param {string} currentRole - 当前角色（user/developer/admin/superadmin）
 */
function openRoleModal(userId, username, email, currentRole) {
  selectedUserId = userId;
  
  document.getElementById('modal-username').textContent = username;
  document.getElementById('modal-email').textContent = email;
  document.getElementById('role-select').value = currentRole || 'user';
  
  document.getElementById('role-modal').style.display = 'flex';
}

/**
 * 保存用户角色修改
 * 调用 PUT /api/user/{id} 更新角色，成功后关闭模态框并刷新用户列表
 * 角色层级：user → developer → admin → superadmin
 */
function saveUserRole() {
  if (!selectedUserId) return;
  
  var newRole = document.getElementById('role-select').value;
  
  fetch(getApiBase() + '/api/user/' + selectedUserId, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ role: newRole })
  })
  .then(function(response) {
    return response.json();
  })
  .then(function(data) {
    if (data.success) {
      alert('权限设置成功');
      document.getElementById('role-modal').style.display = 'none';
      loadUsers();
    } else {
      alert('设置失败: ' + data.message);
    }
  })
  .catch(function(error) {
    ('设置权限失败:', error);
    alert('设置失败');
  });
}

/**
 * 加载所有用户列表（管理员功能）
 * 调用 GET /api/users 获取全部用户，渲染为可点击的用户卡片
 * 每个卡片显示：用户名、角色徽章、邮箱、注册时间
 * 普通用户显示"开发者申请"标签（可点击升级为开发者）
 */
function loadUsers() {
  var usersList = document.getElementById('users-list');
  if (!usersList) return;
  
  usersList.innerHTML = `
    <div class="empty-state">
      <i class="fas fa-users"></i>
      <p>加载用户列表中...</p>
    </div>
  `;
  
  fetch(getApiBase() + '/api/users')
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      if (!data.success || data.users.length === 0) {
        usersList.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-users"></i>
            <p>暂无用户</p>
          </div>
        `;
        return;
      }
      
      usersList.innerHTML = data.users.map(function(user) {
        var roleInfo = getRoleInfo(user.role || 'user');
        var hasDeveloperRequest = (user.role === 'user');
        
        return `
          <button class="user-button" onclick="openRoleModal('${user.id}', '${user.username}', '${user.email}', '${user.role || 'user'}')">
            <div class="user-button-header">
              <span class="user-name">${user.username}</span>
              <span class="user-role-badge role-${user.role || 'user'}">${roleInfo.name}</span>
            </div>
            <div class="user-email">${user.email}</div>
            <div class="user-meta">
              <span>${formatDate(user.created_at)}</span>
            </div>
            ${hasDeveloperRequest ? '<div class="developer-request-badge"><i class="fas fa-star"></i> 开发者申请</div>' : ''}
          </button>
        `;
      }).join('');
    })
    .catch(function(error) {
      ('加载用户列表失败:', error);
      usersList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-users"></i>
          <p>加载失败</p>
        </div>
      `;
    });
}

// ====== 7. 游戏管理 ======

/**
 * 初始化游戏管理模块
 * 根据用户角色控制功能可见性：
 * - developer/admin/superadmin: 显示"发布游戏"按钮
 * - admin/superadmin/developer: 显示"删除游戏"按钮
 * 绑定搜索框实时过滤、删除游戏模态框、确认删除事件
 * 整个函数包裹在 try-catch 中防止初始化失败
 */
function setupGameFunctions() {
  try {
    var currentUser = getCurrentUser();
    var gameActions = document.getElementById('game-actions');
    var newGameBtn = document.getElementById('new-game-btn');
    var deleteGameBtn = document.getElementById('delete-game-btn');
    var deleteGameModal = document.getElementById('delete-game-modal');
    var deleteGameModalClose = document.getElementById('delete-game-modal-close');
    var deleteGameCancelBtn = document.getElementById('delete-game-cancel-btn');
    var confirmDeleteGameBtn = document.getElementById('confirm-delete-game-btn');
    var searchInput = document.getElementById('search-input');

    if (currentUser && (currentUser.role === 'developer' || currentUser.role === 'admin' || currentUser.role === 'superadmin')) {
      if (gameActions) {
        gameActions.style.display = 'flex';
      }
    }

    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin' || currentUser.role === 'developer')) {
      if (deleteGameBtn) {
        deleteGameBtn.style.display = 'flex';
      }
    }

    if (newGameBtn) {
      newGameBtn.addEventListener('click', function() {
        window.location.href = 'create-game.html';
      });
    }

    if (deleteGameBtn) {
      deleteGameBtn.addEventListener('click', function() {
        loadGameCheckboxes();
        if (deleteGameModal) deleteGameModal.style.display = 'flex';
      });
    }

    if (deleteGameModalClose) {
      deleteGameModalClose.addEventListener('click', function() {
        if (deleteGameModal) deleteGameModal.style.display = 'none';
      });
    }

    if (deleteGameCancelBtn) {
      deleteGameCancelBtn.addEventListener('click', function() {
        if (deleteGameModal) deleteGameModal.style.display = 'none';
      });
    }

    if (confirmDeleteGameBtn) {
      confirmDeleteGameBtn.addEventListener('click', confirmDeleteGame);
    }

    if (deleteGameModal) {
      deleteGameModal.addEventListener('click', function(e) {
        if (e.target === deleteGameModal) {
          deleteGameModal.style.display = 'none';
        }
      });
    }

    // 搜索功能
    if (searchInput) {
      searchInput.addEventListener('input', function(e) {
        var searchQuery = e.target.value.trim();
        loadGames(searchQuery);
      });
    }
  } catch (e) {
    ('setupGameFunctions 出错:', e);
  }
}

/**
 * 加载游戏列表并渲染为卡片网格
 * @param {string} [searchQuery] - 搜索关键词，传入时请求带 search 参数的 API
 * URL 中附加时间戳参数 t 防止浏览器缓存旧数据
 * 每张卡片显示：封面图（有图则显示 img，无图显示游戏手柄图标）、
 *               游戏名称、作者、简介（2行截断）
 */
function loadGames(searchQuery) {
  var gamesContainer = document.getElementById('games-container');
  if (!gamesContainer) return;

  gamesContainer.innerHTML = `
    <div class="empty-state">
      <i class="fas fa-gamepad"></i>
      <p>加载游戏列表中...</p>
    </div>
  `;

  var url = getApiBase() + '/api/games?t=' + new Date().getTime();
  if (searchQuery) {
    url += '&search=' + encodeURIComponent(searchQuery);
  }

  fetch(url)
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      if (!data.success || data.games.length === 0) {
        var message = searchQuery ? '未找到匹配的游戏' : '暂无游戏';
        gamesContainer.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-gamepad"></i>
            <p>${message}</p>
          </div>
        `;
        return;
      }

      gamesContainer.innerHTML = data.games.map(function(game) {
        var hasImage = game.has_image === 1 || game.has_image === true;
        var gameImageUrl = getApiBase() + '/api/games/image/' + game.id;
        var coverHtml = hasImage ? `
              <div class="game-cover">
                <img src="${gameImageUrl}" alt="${game.name}">
              </div>
            ` : `
              <div class="game-cover">
                <i class="fas fa-gamepad"></i>
              </div>
            `;
        
        return `
          <div class="game-card" onclick="goToGameDetail('${game.id}')" style="cursor: pointer;">
            ${coverHtml}
            <div class="game-card-body">
              <h3 class="game-card-title">${game.name}</h3>
              <p class="game-card-author"><i class="fas fa-user"></i>${game.author_name || '未知作者'}</p>
              <p class="game-card-desc" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${game.description || '暂无简介'}</p>
            </div>
          </div>
        `;
      }).join('');
    })
    .catch(function(error) {
      ('加载游戏列表失败:', error);
      gamesContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-gamepad"></i>
          <p>加载失败</p>
        </div>
      `;
    });
}

/**
 * 加载游戏列表到删除模态框的复选框区域
 * 开发者角色只能看到自己发布的游戏（前端过滤 author_id）
 * 管理员/超级管理员可以看到所有游戏
 */
function loadGameCheckboxes() {
  var gameCheckboxes = document.getElementById('game-checkboxes');
  var currentUser = getCurrentUser();
  if (!gameCheckboxes || !currentUser) return;

  fetch(getApiBase() + '/api/games')
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      if (!data.success || data.games.length === 0) {
        gameCheckboxes.innerHTML = '<p>暂无游戏可删除</p>';
        return;
      }

      var filteredGames = data.games;
      if (currentUser.role === 'developer') {
        filteredGames = data.games.filter(function(g) { return g.author_id === currentUser.id; });
      }

      if (filteredGames.length === 0) {
        gameCheckboxes.innerHTML = '<p>暂无游戏可删除</p>';
        return;
      }

      gameCheckboxes.innerHTML = filteredGames.map(function(game) {
        return `
          <label class="save-checkbox-item">
            <input type="checkbox" value="${game.id}">
            <div>
              <div class="checkbox-name">${game.name}</div>
              <div class="checkbox-meta">${game.author_name || '未知作者'}</div>
            </div>
          </label>
        `;
      }).join('');
    })
    .catch(function(error) {
      ('加载游戏列表失败:', error);
    });
}

/**
 * 确认删除选中的游戏
 * 使用 Promise.all 并行发送多个 DELETE 请求
 * URL 中携带 user_id 和 user_role 参数，后端据此验证删除权限
 * 部分失败时汇总错误信息提示用户
 */
function confirmDeleteGame() {
  var selectedGames = document.querySelectorAll('#game-checkboxes input[type="checkbox"]:checked');
  var currentUser = getCurrentUser();

  if (selectedGames.length === 0) {
    alert('请选择要删除的游戏');
    return;
  }

  if (!confirm('确定要删除选中的游戏吗？此操作不可撤销。')) {
    return;
  }

  var deletePromises = [];
  selectedGames.forEach(function(checkbox) {
    var gameId = checkbox.value;
    var url = getApiBase() + '/api/games/' + gameId + '?user_id=' + encodeURIComponent(currentUser.id) + '&user_role=' + encodeURIComponent(currentUser.role);
    deletePromises.push(
      fetch(url, {
        method: 'DELETE'
      }).then(function(response) {
        return response.json();
      })
    );
  });

  Promise.all(deletePromises)
    .then(function(results) {
      var allSuccess = results.every(function(result) {
        return result.success;
      });

      if (allSuccess) {
        alert('游戏删除成功');
        document.getElementById('delete-game-modal').style.display = 'none';
        loadGames();
      } else {
        var errors = results.filter(function(r) { return !r.success; }).map(function(r) { return r.message; }).join('; ');
        alert('删除失败: ' + errors);
        loadGames();
      }
    })
    .catch(function(error) {
      alert('删除失败: ' + error.message);
    });
}

/**
 * 跳转到游戏详情页
 * @param {string} gameId - 游戏 ID
 */
function goToGameDetail(gameId) {
  window.location.href = 'game-detail.html?id=' + gameId;
}

/**
 * 下载游戏
 * 优先使用后端 API 下载（有 fileName 表示上传了游戏文件）
 * 其次使用外部 URL（新窗口打开）
 * @param {string} gameId - 游戏 ID
 * @param {string} url - 外部下载链接
 * @param {string} fileName - 上传的文件名（有值则走 API 下载）
 */
function downloadGame(gameId, url, fileName) {
  if (fileName) {
    window.location.href = getApiBase() + '/api/games/download/' + gameId;
  } else if (url) {
    window.open(url, '_blank');
  } else {
    alert('该游戏暂无下载地址');
  }
}

/**
 * 设置"下载所有游戏"按钮（仅超级管理员可见）
 * 点击后通过隐藏的 <a> 标签触发后端 /api/admin/download-all-games
 * 后端将所有游戏文件打包为 ZIP 返回，浏览器自动下载
 * @param {Object} user - 当前登录用户对象
 */
function setupDownloadAllGamesButton(user) {
  var downloadBtn = document.getElementById('download-all-games-btn');
  
  if (downloadBtn) {
    downloadBtn.addEventListener('click', function() {
      if (!user || user.role !== 'superadmin') {
        alert('只有主管理员可以下载所有游戏');
        return;
      }

      // 创建一个隐藏的a标签来触发下载
      var url = '/api/admin/download-all-games?user_id=' + encodeURIComponent(user.id);
      var a = document.createElement('a');
      a.href = url;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // 显示下载提示
      alert('正在准备下载，请稍候...');
    });
  }
}

// ====== 8. 公告管理 ======

/**
 * 设置公告功能（仅超级管理员可见发布按钮）
 */
function setupAnnouncementFunctions(user) {
  var addAnnouncementBtn = document.getElementById('add-announcement-btn');
  var announcementModal = document.getElementById('announcement-modal');
  var announcementModalClose = document.getElementById('announcement-modal-close');
  var announcementCancelBtn = document.getElementById('announcement-cancel-btn');
  var announcementSaveBtn = document.getElementById('announcement-save-btn');

  if (user && user.role === 'superadmin') {
    if (addAnnouncementBtn) {
      addAnnouncementBtn.style.display = 'flex';
    }
  }

  if (addAnnouncementBtn) {
    addAnnouncementBtn.addEventListener('click', function() {
      document.getElementById('announcement-title').value = '';
      document.getElementById('announcement-content').value = '';
      if (announcementModal) announcementModal.style.display = 'flex';
    });
  }

  if (announcementModalClose) {
    announcementModalClose.addEventListener('click', function() {
      if (announcementModal) announcementModal.style.display = 'none';
    });
  }

  if (announcementCancelBtn) {
    announcementCancelBtn.addEventListener('click', function() {
      if (announcementModal) announcementModal.style.display = 'none';
    });
  }

  if (announcementSaveBtn) {
    announcementSaveBtn.addEventListener('click', publishAnnouncement);
  }

  if (announcementModal) {
    announcementModal.addEventListener('click', function(e) {
      if (e.target === announcementModal) {
        announcementModal.style.display = 'none';
      }
    });
  }
}

/**
 * 加载公告列表
 */
function loadAnnouncements() {
  var announcementsList = document.getElementById('announcements-list');
  if (!announcementsList) return;

  announcementsList.innerHTML = `
    <div class="empty-state">
      <i class="fas fa-newspaper"></i>
      <p>加载公告中...</p>
    </div>
  `;

  fetch(getApiBase() + '/api/announcements')
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      if (!data.success || data.announcements.length === 0) {
        announcementsList.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-newspaper"></i>
            <p>暂无公告</p>
          </div>
        `;
        return;
      }

      var currentUser = getCurrentUser();
      var isSuperadmin = currentUser && currentUser.role === 'superadmin';

      announcementsList.innerHTML = data.announcements.map(function(announcement) {
        return `
          <div class="announcement-card">
            <div class="announcement-title">${announcement.title}</div>
            <div class="announcement-content">${announcement.content}</div>
            <div class="announcement-meta">
              <span class="announcement-author">
                <i class="fas fa-user"></i> ${announcement.author_name}
              </span>
              <span>${formatDate(announcement.created_at)}</span>
              ${isSuperadmin ? `<button class="delete-announcement-btn" onclick="deleteAnnouncement('${announcement.id}')">
                <i class="fas fa-trash"></i> 删除
              </button>` : ''}
            </div>
          </div>
        `;
      }).join('');
    })
    .catch(function(error) {
      ('加载公告失败:', error);
      announcementsList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-circle"></i>
          <p>公告加载失败</p>
        </div>
      `;
    });
}

/**
 * 发布公告
 */
function publishAnnouncement() {
  var title = document.getElementById('announcement-title').value.trim();
  var content = document.getElementById('announcement-content').value.trim();
  var currentUser = getCurrentUser();

  if (!title) {
    alert('请输入公告标题');
    return;
  }

  if (!content) {
    alert('请输入公告内容');
    return;
  }

  fetch(getApiBase() + '/api/announcements', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: title,
      content: content,
      author_id: currentUser.id
    })
  })
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      if (data.success) {
        alert('公告发布成功');
        document.getElementById('announcement-modal').style.display = 'none';
        loadAnnouncements();
      } else {
        alert('发布失败: ' + (data.message || '未知错误'));
      }
    })
    .catch(function(error) {
      ('发布公告失败:', error);
      alert('发布公告失败: ' + (error.message || '网络错误'));
    });
}

/**
 * 删除公告
 */
function deleteAnnouncement(announcementId) {
  if (!confirm('确定要删除这条公告吗？')) {
    return;
  }

  var currentUser = getCurrentUser();

  fetch(getApiBase() + '/api/announcements/' + announcementId + '?user_id=' + encodeURIComponent(currentUser.id), {
    method: 'DELETE'
  })
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      if (data.success) {
        alert('公告已删除');
        loadAnnouncements();
      } else {
        alert('删除失败: ' + (data.message || '未知错误'));
      }
    })
    .catch(function(error) {
      ('删除公告失败:', error);
      alert('删除公告失败: ' + (error.message || '网络错误'));
    });
}

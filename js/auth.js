/**
 * Snow Box - 用户认证模块
 * 负责处理用户登录、注册、状态管理等功能
 * 依赖：无（纯原生 JavaScript）
 */

// ============== 配置常量 ==============
// Cloudflare Worker API 基础 URL
// 直接连接云端 Worker，无需本地服务器中转
const API_BASE_URL = '';

// localStorage 中存储当前用户的键名
const CURRENT_USER_KEY = 'current_user';

/**
 * 获取 API 基础 URL
 * @returns {string} API 基础地址
 */
function getApiBase() {
  return API_BASE_URL;
}

/**
 * 从 localStorage 获取当前登录用户
 * @returns {Object|null} 用户对象，未登录返回 null
 */
function getCurrentUser() {
  const user = localStorage.getItem(CURRENT_USER_KEY);
  return user ? JSON.parse(user) : null;
}

/**
 * 保存用户信息到 localStorage（登录成功后调用）
 * @param {Object} user 用户对象
 */
function setCurrentUser(user) {
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

/**
 * 清除 localStorage 中的用户信息（登出时调用）
 */
function clearCurrentUser() {
  localStorage.removeItem(CURRENT_USER_KEY);
}

/**
 * 格式化日期为中文格式
 * @param {string|Date} date 日期字符串或 Date 对象
 * @returns {string} 格式化后的日期（如：2024年12月15日）
 */
function formatDate(date) {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * 切换密码输入框的显示/隐藏
 * @param {string} fieldId 密码输入框的 ID
 */
function togglePassword(fieldId) {
  var field = document.getElementById(fieldId);
  var icons = document.querySelectorAll('.toggle-password');
  var icon = null;
  for (var i = 0; i < icons.length; i++) {
    if (icons[i].onclick && icons[i].onclick.toString().includes(fieldId)) {
      icon = icons[i];
      break;
    }
  }
  if (!icon) return;
  
  if (field.type === 'password') {
    field.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    field.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

/**
 * DOM 加载完成后初始化事件绑定
 */
document.addEventListener('DOMContentLoaded', function() {
  var loginForm = document.getElementById('login-form');
  var registerForm = document.getElementById('register-form');

  // 绑定登录表单提交事件
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      login();
    });
  }

  // 绑定注册表单提交事件
  if (registerForm) {
    registerForm.addEventListener('submit', function(e) {
      e.preventDefault();
      register();
    });
  }

  // 绑定登出按钮点击事件
  var logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
});

/**
 * 用户登录函数
 * 发送登录请求到 /api/login
 */
async function login() {
  var email = document.getElementById('email').value.trim();
  var password = document.getElementById('password').value;

  hideAllErrors();
  var loginError = document.getElementById('login-error');
  if (loginError) {
    loginError.style.display = 'none';
  }

  // 表单验证
  if (!email) {
    showError('email-error', '请输入邮箱地址');
    return;
  }

  if (!password) {
    showError('password-error', '请输入密码');
    return;
  }

  try {
    var response = await fetch(getApiBase() + '/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify({ email: email, password: password }),
      cache: 'no-store'
    });

    if (!response.ok) {
      var errorMessage = '';
      switch (response.status) {
        case 400:
          errorMessage = '请求参数错误，请检查输入';
          break;
        case 401:
          errorMessage = '邮箱或密码错误';
          break;
        case 403:
          errorMessage = '账号已被封禁，请联系管理员';
          break;
        case 500:
          errorMessage = '服务器内部错误，请稍后重试';
          break;
        default:
          errorMessage = '登录请求失败，状态码: ' + response.status;
      }
      if (loginError) {
        var errorMsgEl = document.getElementById('login-error-message');
        if (errorMsgEl) {
          errorMsgEl.textContent = errorMessage;
        }
        loginError.style.display = 'flex';
      }
      return;
    }

    var data = await response.json();

    if (data.success) {
      setCurrentUser(data.data);
      window.location.href = 'dashboard.html';
    } else {
      if (loginError) {
        var errorMsgEl = document.getElementById('login-error-message');
        if (errorMsgEl) {
          errorMsgEl.textContent = data.message || '登录失败';
        }
        loginError.style.display = 'flex';
      }
    }
  } catch (error) {
    ('登录失败:', error);
    if (loginError) {
      var errorMsgEl = document.getElementById('login-error-message');
      if (errorMsgEl) {
        var errorMsg = '登录失败';
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          errorMsg = '无法连接到服务器，请检查网络或稍后重试';
        } else if (error.name === 'AbortError') {
          errorMsg = '请求已取消';
        } else {
          errorMsg = '登录失败: ' + (error.message || '未知错误');
        }
        errorMsgEl.textContent = errorMsg;
      }
      loginError.style.display = 'flex';
    }
  }
}

/**
 * 触发浏览器保存密码功能（备用方法，当前未使用）
 * @param {string} email 邮箱
 * @param {string} password 密码
 */
function triggerSavePassword(email, password) {
  var form = document.createElement('form');
  form.action = '/api/login';
  form.method = 'POST';
  form.style.display = 'none';
  
  var emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.name = 'email';
  emailInput.value = email;
  emailInput.autocomplete = 'username';
  
  var passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.name = 'password';
  passwordInput.value = password;
  passwordInput.autocomplete = 'current-password';
  
  form.appendChild(emailInput);
  form.appendChild(passwordInput);
  document.body.appendChild(form);
  form.submit();
}

/**
 * 用户注册函数
 * 发送注册请求到 /api/register
 */
async function register() {
  var username = document.getElementById('username').value.trim();
  var email = document.getElementById('email').value.trim();
  var password = document.getElementById('password').value;
  var confirmPassword = document.getElementById('confirm-password').value;
  var agreeTermsCheckbox = document.getElementById('agree-terms');
  var agreeTerms = agreeTermsCheckbox ? agreeTermsCheckbox.checked : false;

  hideAllErrors();
  var registerSuccess = document.getElementById('register-success');
  var registerError = document.getElementById('register-error');
  if (registerSuccess) {
    registerSuccess.style.display = 'none';
  }
  if (registerError) {
    registerError.style.display = 'none';
  }

  var isValid = true;

  // 表单验证
  if (!username) {
    showError('username-error', '请输入用户名');
    isValid = false;
  } else if (username.length < 3) {
    showError('username-error', '用户名至少需要3个字符');
    isValid = false;
  }

  if (!email) {
    showError('email-error', '请输入邮箱地址');
    isValid = false;
  }

  if (!password) {
    showError('password-error', '请输入密码');
    isValid = false;
  } else if (password.length < 6) {
    showError('password-error', '密码至少需要6个字符');
    isValid = false;
  }

  if (!confirmPassword) {
    showError('confirm-password-error', '请再次输入密码');
    isValid = false;
  } else if (password !== confirmPassword) {
    showError('confirm-password-error', '两次输入的密码不一致');
    isValid = false;
  }

  if (!agreeTerms) {
    showError('username-error', '请同意服务条款和隐私政策');
    isValid = false;
  }

  if (!isValid) return;

  try {
    var response = await fetch(getApiBase() + '/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify({ 
        username: username, 
        email: email, 
        password: password 
      }),
      cache: 'no-store'
    });

    if (!response.ok) {
      var errorMessage = '';
      switch (response.status) {
        case 400:
          errorMessage = '请求参数错误，请检查输入';
          break;
        case 409:
          errorMessage = '该邮箱已被注册，请使用其他邮箱';
          break;
        case 500:
          errorMessage = '服务器内部错误，请稍后重试';
          break;
        default:
          errorMessage = '注册请求失败，状态码: ' + response.status;
      }
      showRegisterError(errorMessage);
      return;
    }

    var data = await response.json();

    if (data.success) {
      showRegisterSuccess();
    } else {
      showRegisterError(data.message || '注册失败');
    }
  } catch (error) {
    ('注册失败:', error);
    var errorMsg = '注册失败';
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      errorMsg = '无法连接到服务器，请检查网络或稍后重试';
    } else if (error.name === 'AbortError') {
      errorMsg = '请求已取消';
    } else {
      errorMsg = '注册失败: ' + (error.message || '未知错误');
    }
    showRegisterError(errorMsg);
  }
}

function showRegisterSuccess() {
  var registerSuccess = document.getElementById('register-success');
  var registerError = document.getElementById('register-error');
  if (registerError) {
    registerError.style.display = 'none';
  }
  if (registerSuccess) {
    registerSuccess.style.display = 'flex';
  }
  setTimeout(function() {
    window.location.href = 'login.html';
  }, 2000);
}

function showRegisterError(message) {
  var registerSuccess = document.getElementById('register-success');
  var registerError = document.getElementById('register-error');
  var errorMsgEl = document.getElementById('register-error-message');
  
  if (registerSuccess) {
    registerSuccess.style.display = 'none';
  }
  
  if (errorMsgEl) {
    errorMsgEl.textContent = message;
  }
  
  if (registerError) {
    registerError.style.display = 'flex';
  } else {
    alert(message);
  }
}

/**
 * 用户登出函数
 * 清除用户信息并跳转登录页
 */
function logout() {
  clearCurrentUser();
  window.location.href = 'login.html';
}



/**
 * 显示指定 ID 的错误信息
 * @param {string} id 错误元素的 ID
 * @param {string} message 错误消息
 */
function showError(id, message) {
  var errorElement = document.getElementById(id);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }
}

/**
 * 隐藏所有错误信息
 */
function hideAllErrors() {
  var errorElements = document.querySelectorAll('.error-message');
  errorElements.forEach(function(el) {
    el.style.display = 'none';
    el.textContent = '';
  });
}

/**
 * 获取所有用户列表（管理员功能）
 * @returns {Array} 用户列表
 */
async function fetchUsers() {
  try {
    var response = await fetch(getApiBase() + '/api/users');
    var data = await response.json();
    if (data.success) {
      return data.users;
    }
    return [];
  } catch (error) {
    ('获取用户列表失败:', error);
    return [];
  }
}

/**
 * 获取单个用户信息
 * @param {string} userId 用户 ID
 * @returns {Object|null} 用户对象
 */
async function fetchUser(userId) {
  try {
    var response = await fetch(getApiBase() + '/api/user/' + userId);
    var data = await response.json();
    if (data.success) {
      return data.user;
    }
    return null;
  } catch (error) {
    ('获取用户信息失败:', error);
    return null;
  }
}

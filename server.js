const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// ===== 中间件 =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(path.join(__dirname)));

// ===== 模拟用户数据库 =====
const USERS = {
  admin: {
    password: '123456',
    nickname: 'Samy',
    role: 'admin',
    userId: 10086
  },
  user: {
    password: 'password',
    nickname: '普通用户',
    role: 'user',
    userId: 10087
  },
  test: {
    password: 'test123',
    nickname: '测试账号',
    role: 'user',
    userId: 10088
  }
};

// ===== 生成模拟 Token =====
function generateSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

function generateJWT(user) {
  // 模拟 JWT（base64 编码，非真正签名）
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: user.userId,
    username: user.nickname,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', 'connecthub-secret-key')
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

// ===== 登录接口 =====
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  console.log(`[LOGIN] 收到登录请求: username=${username}`);

  // 验证用户
  const user = USERS[username];
  if (!user || user.password !== password) {
    console.log(`[LOGIN] 登录失败: 用户名或密码错误`);
    return res.status(401).json({
      success: false,
      message: '用户名或密码错误'
    });
  }

  // 生成 Token
  const sessionId = generateSessionId();
  const jwtToken = generateJWT(user);
  const csrfToken = crypto.randomBytes(8).toString('hex');

  console.log(`[LOGIN] 登录成功: ${user.nickname} (${username})`);
  console.log(`[LOGIN] Session ID: ${sessionId}`);
  console.log(`[LOGIN] JWT Token: ${jwtToken}`);

  // ========================================================
  // 🔑 关键：通过 HTTP Set-Cookie 响应头设置 Cookie
  //    这些 Cookie 可以通过 Burp Suite / Wireshark 抓包看到
  // ========================================================
  res.setHeader('Set-Cookie', [
    `session_id=${sessionId}; Path=/; Max-Age=86400`,
    `auth_token=${jwtToken}; Path=/; Max-Age=86400`,
    `csrf_token=${csrfToken}; Path=/; Max-Age=86400`,
    `user_id=${user.userId}; Path=/; Max-Age=86400`,
    `username=${username}; Path=/; Max-Age=86400`,
    `role=${user.role}; Path=/; Max-Age=86400`
  ]);

  // 注意：这里故意 **不加** HttpOnly 和 Secure 标志
  // 这样 XSS 攻击才能通过 document.cookie 读取到这些 Cookie
  // 在真实生产环境中应该加上 HttpOnly; Secure; SameSite=Strict

  res.json({
    success: true,
    message: '登录成功',
    user: {
      userId: user.userId,
      nickname: user.nickname,
      role: user.role
    }
  });
});

// ===== 获取当前用户信息（验证 Cookie 是否有效） =====
app.get('/api/me', (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');

  if (!cookies.session_id || !cookies.auth_token) {
    return res.status(401).json({
      success: false,
      message: '未登录，请先登录'
    });
  }

  res.json({
    success: true,
    message: '已登录',
    cookies: cookies
  });
});

// ===== 登出 =====
app.post('/api/logout', (req, res) => {
  // 清除所有 Cookie
  res.setHeader('Set-Cookie', [
    'session_id=; Path=/; Max-Age=0',
    'auth_token=; Path=/; Max-Age=0',
    'csrf_token=; Path=/; Max-Age=0',
    'user_id=; Path=/; Max-Age=0',
    'username=; Path=/; Max-Age=0',
    'role=; Path=/; Max-Age=0'
  ]);

  res.json({ success: true, message: '已登出' });
});

// ===== 银行用户数据 =====
const BANK_USERS = {
  admin: {
    password: '123456',
    name: 'Samy',
    accountNo: '6222 0000 0000 8888',
    balance: 1286453.00
  },
  user: {
    password: 'password',
    name: '李华',
    accountNo: '6222 0000 0000 6666',
    balance: 85320.50
  }
};

// ===== 银行登录接口 =====
app.post('/api/bank/login', (req, res) => {
  const { username, password } = req.body;

  console.log(`[BANK LOGIN] 收到登录请求: username=${username}`);

  const bankUser = BANK_USERS[username];
  if (!bankUser || bankUser.password !== password) {
    console.log(`[BANK LOGIN] 登录失败`);
    return res.status(401).json({
      success: false,
      message: '账户名或密码错误，请重试'
    });
  }

  const sessionId = generateSessionId();
  const jwtToken = generateJWT({ userId: username, nickname: bankUser.name, role: 'bank_user' });
  const csrfToken = crypto.randomBytes(8).toString('hex');

  console.log(`[BANK LOGIN] 登录成功: ${bankUser.name}`);
  console.log(`[BANK LOGIN] Session: ${sessionId}`);
  console.log(`[BANK LOGIN] Token: ${jwtToken}`);

  // 🔑 通过 Set-Cookie 响应头下发 Cookie（抓包可见）
  res.setHeader('Set-Cookie', [
    `bank_session_id=${sessionId}; Path=/; Max-Age=86400`,
    `bank_auth_token=${jwtToken}; Path=/; Max-Age=86400`,
    `bank_csrf_token=${csrfToken}; Path=/; Max-Age=86400`,
    `bank_user_name=${encodeURIComponent(bankUser.name)}; Path=/; Max-Age=86400`,
    `bank_account=${username}; Path=/; Max-Age=86400`
  ]);

  res.json({
    success: true,
    message: '登录成功',
    user: {
      name: bankUser.name,
      accountNo: bankUser.accountNo
    }
  });
});

// ===== 银行登出 =====
app.post('/api/bank/logout', (req, res) => {
  res.setHeader('Set-Cookie', [
    'bank_session_id=; Path=/; Max-Age=0',
    'bank_auth_token=; Path=/; Max-Age=0',
    'bank_csrf_token=; Path=/; Max-Age=0',
    'bank_user_name=; Path=/; Max-Age=0',
    'bank_account=; Path=/; Max-Age=0'
  ]);
  res.json({ success: true, message: '已登出' });
});

// =============================================================
// ⚠️ 反射型 XSS 漏洞：服务器端直接将用户输入拼接到 HTML 中
//    不做任何转义，<script> 标签在 HTML 初次解析时直接执行
// =============================================================
app.get('/bank/search', (req, res) => {
  const keyword = req.query.keyword || '';

  console.log(`[BANK SEARCH] 搜索关键词: ${keyword}`);

  // ⚠️ 漏洞！直接把 keyword 拼接到 HTML 中，没有做 HTML 转义
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>交易查询 - BlackStone Bank</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --black: #000; --gray-900: #141414; --gray-850: #1a1a1a; --gray-800: #222;
      --gray-700: #333; --gray-600: #4a4a4a; --gray-500: #666; --gray-400: #888;
      --gray-300: #aaa; --gray-200: #ccc; --gray-100: #e5e5e5; --white: #fff;
      --green: #34d399; --red: #f87171;
    }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: var(--black); color: var(--white);
      min-height: 100vh; -webkit-font-smoothing: antialiased;
    }
    .top-bar {
      height: 64px; background: var(--black); border-bottom: 1px solid var(--gray-800);
      display: flex; align-items: center; justify-content: space-between; padding: 0 32px;
    }
    .logo-mark {
      display: flex; align-items: center; gap: 12px; text-decoration: none; color: var(--white);
    }
    .logo-mark .mark {
      width: 32px; height: 32px; border: 2px solid var(--white); border-radius: 4px;
      display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14px;
    }
    .logo-mark span { font-weight: 700; font-size: 16px; letter-spacing: 1.5px; }
    .container { max-width: 900px; margin: 0 auto; padding: 40px 32px; }
    h1 { font-size: 24px; font-weight: 800; margin-bottom: 8px; letter-spacing: -0.5px; }
    .subtitle { color: var(--gray-500); font-size: 14px; margin-bottom: 32px; }
    .search-box {
      display: flex; gap: 12px; margin-bottom: 32px;
    }
    .search-box input {
      flex: 1; padding: 14px 16px; background: var(--gray-900); border: 1px solid var(--gray-700);
      border-radius: 8px; color: var(--white); font-size: 15px; font-family: inherit; outline: none;
      transition: border-color 0.2s;
    }
    .search-box input:focus { border-color: var(--white); box-shadow: 0 0 0 3px rgba(255,255,255,0.06); }
    .search-box input::placeholder { color: var(--gray-600); }
    .search-box button {
      padding: 14px 28px; background: var(--white); border: none; border-radius: 8px;
      color: var(--black); font-size: 14px; font-weight: 700; font-family: inherit;
      cursor: pointer; transition: all 0.2s;
    }
    .search-box button:hover { background: var(--gray-100); transform: translateY(-1px); }
    .result-header {
      padding: 16px 20px; background: var(--gray-900); border: 1px solid var(--gray-800);
      border-radius: 10px; margin-bottom: 20px; font-size: 15px;
    }
    .result-header .kw { color: var(--white); font-weight: 700; }
    .result-header .label { color: var(--gray-500); }
    .tx-panel {
      background: var(--gray-900); border: 1px solid var(--gray-800); border-radius: 12px; overflow: hidden;
    }
    .tx-panel .panel-title {
      padding: 16px 20px; border-bottom: 1px solid var(--gray-800);
      font-size: 14px; font-weight: 600; color: var(--gray-400);
    }
    .tx-item {
      display: flex; align-items: center; gap: 16px; padding: 16px 20px;
      border-bottom: 1px solid var(--gray-800); transition: background 0.1s;
    }
    .tx-item:last-child { border-bottom: none; }
    .tx-item:hover { background: var(--gray-850); }
    .tx-icon {
      width: 40px; height: 40px; border-radius: 10px; background: var(--gray-800);
      display: flex; align-items: center; justify-content: center; font-size: 16px;
      color: var(--gray-300); flex-shrink: 0;
    }
    .tx-info { flex: 1; }
    .tx-name { font-size: 14px; font-weight: 600; margin-bottom: 2px; }
    .tx-desc { font-size: 12px; color: var(--gray-500); }
    .tx-right { text-align: right; }
    .tx-amt { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .tx-amt.inc { color: var(--green); }
    .tx-amt.exp { color: var(--white); }
    .tx-time { font-size: 11px; color: var(--gray-600); margin-top: 2px; }
    .back-link {
      display: inline-flex; align-items: center; gap: 6px; margin-bottom: 24px;
      color: var(--gray-400); text-decoration: none; font-size: 13px; font-weight: 500;
      transition: color 0.15s;
    }
    .back-link:hover { color: var(--white); }
    .no-result {
      text-align: center; padding: 48px; color: var(--gray-500); font-size: 14px;
    }
    .no-result i { font-size: 36px; color: var(--gray-700); display: block; margin-bottom: 12px; }
  </style>
</head>
<body>
  <header class="top-bar">
    <a href="/bank-dashboard.html" class="logo-mark">
      <div class="mark">BS</div>
      <span>BLACKSTONE</span>
    </a>
  </header>
  <div class="container">
    <a href="/bank-dashboard.html" class="back-link"><i class="fas fa-arrow-left"></i> 返回总览</a>
    <h1>交易查询</h1>
    <p class="subtitle">搜索您的历史交易记录</p>

    <form class="search-box" method="GET" action="/bank/search">
      <input type="text" name="keyword" placeholder="输入交易关键词，如：京东、工资、转账..." value="${keyword}">
      <button type="submit"><i class="fas fa-search"></i> 查询</button>
    </form>

    ${keyword ? `
    <div class="result-header">
      <span class="label">搜索关键词：</span><span class="kw">${keyword}</span>
      <span class="label" style="margin-left:16px;">共找到 3 条相关交易</span>
    </div>

    <div class="tx-panel">
      <div class="panel-title">查询结果</div>
      <div class="tx-item">
        <div class="tx-icon"><i class="fas fa-cart-shopping"></i></div>
        <div class="tx-info">
          <div class="tx-name">京东商城 - MacBook Pro</div>
          <div class="tx-desc">在线购物 · 储蓄卡 尾号8888</div>
        </div>
        <div class="tx-right">
          <div class="tx-amt exp">- ¥12,999.00</div>
          <div class="tx-time">2026-03-20 14:23</div>
        </div>
      </div>
      <div class="tx-item">
        <div class="tx-icon"><i class="fas fa-building"></i></div>
        <div class="tx-info">
          <div class="tx-name">工资收入</div>
          <div class="tx-desc">杭州科技有限公司 · 代发工资</div>
        </div>
        <div class="tx-right">
          <div class="tx-amt inc">+ ¥28,500.00</div>
          <div class="tx-time">2026-03-15 09:00</div>
        </div>
      </div>
      <div class="tx-item">
        <div class="tx-icon"><i class="fas fa-arrow-right-arrow-left"></i></div>
        <div class="tx-info">
          <div class="tx-name">转账 - Lily Chen</div>
          <div class="tx-desc">个人转账 · 储蓄卡 尾号8888</div>
        </div>
        <div class="tx-right">
          <div class="tx-amt exp">- ¥5,000.00</div>
          <div class="tx-time">2026-03-12 16:20</div>
        </div>
      </div>
    </div>
    ` : `
    <div class="no-result">
      <i class="fas fa-magnifying-glass"></i>
      请输入关键词开始搜索
    </div>
    `}
  </div>
</body>
</html>`;

  res.type('html').send(html);
});

// =============================================================
// ⚠️ 存储型 XSS 漏洞：个人简介接口
//    服务器不做任何 HTML 过滤/转义，直接存储用户输入
//    前端使用 innerHTML 渲染，恶意脚本会被执行
// =============================================================

// 模拟数据库：存储用户个人简介（内存中，服务器重启会清空）
const userProfiles = {};

// 保存个人简介（不做任何过滤！）
app.post('/api/profile/bio', (req, res) => {
  const { bio } = req.body;

  console.log(`[PROFILE] 保存个人简介: ${bio}`);

  // ⚠️ 漏洞！直接存储用户输入，不做任何 HTML 转义或过滤
  // 恶意输入如 <img src=x onerror=alert('XSS')> 会被原样保存
  userProfiles['admin'] = {
    bio: bio  // 直接存储，不做任何处理
  };

  res.json({
    success: true,
    message: '个人简介已保存',
    bio: bio  // 原样返回，不做转义
  });
});

// 获取个人简介（原样返回存储的内容）
app.get('/api/profile/bio', (req, res) => {
  const profile = userProfiles['admin'];

  if (profile && profile.bio) {
    console.log(`[PROFILE] 读取个人简介: ${profile.bio}`);

    // ⚠️ 漏洞！直接返回存储的原始内容，不做转义
    res.json({
      success: true,
      bio: profile.bio
    });
  } else {
    res.json({
      success: true,
      bio: null
    });
  }
});

// ===== 默认路由 =====
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Cookie 解析
function parseCookies(cookieStr) {
  const cookies = {};
  cookieStr.split(';').forEach(pair => {
    const [key, ...val] = pair.trim().split('=');
    if (key) cookies[key] = val.join('=');
  });
  return cookies;
}

// ===== 启动服务器 =====
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔═══════════════════════════════════════════════════════╗');
  console.log('  ║     🌐 ConnectHub + BlackStone Bank Server           ║');
  console.log(`  ║     📡 地址: http://localhost:${PORT}                      ║`);
  console.log('  ║                                                       ║');
  console.log('  ║     社交平台:                                         ║');
  console.log('  ║       登录   → http://localhost:3000/login.html       ║');
  console.log('  ║       首页   → http://localhost:3000/index.html       ║');
  console.log('  ║       XSS    → http://localhost:3000/search.html      ║');
  console.log('  ║       个人中心→ http://localhost:3000/profile.html     ║');
  console.log('  ║       (存储型XSS: 在个人简介中输入恶意脚本)            ║');
  console.log('  ║                                                       ║');
  console.log('  ║     银行系统:                                         ║');
  console.log('  ║       登录   → http://localhost:3000/bank-login.html  ║');
  console.log('  ║                                                       ║');
  console.log('  ║     演示账号: admin / 123456                          ║');
  console.log('  ╚═══════════════════════════════════════════════════════╝');
  console.log('');
});

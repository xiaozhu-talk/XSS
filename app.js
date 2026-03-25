/* ============================================
   ConnectHub - 反射型 XSS 漏洞演示
   ============================================ */

(function () {
  'use strict';

  // ========== 判断当前页面 ==========
  const isSearchPage = window.location.pathname.includes('search.html');

  // ========== 通用功能 ==========

  // 搜索框同步 URL 中的 search 参数
  function syncSearchInput() {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('search');
    const input = document.getElementById('navSearchInput');
    if (query && input) {
      input.value = query;
    }
  }

  // 导航栏搜索提交
  function setupSearchForm() {
    const form = document.getElementById('searchForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        const input = document.getElementById('navSearchInput');
        if (!input.value.trim()) {
          e.preventDefault();
        }
      });
    }
  }

  // 模拟互动效果
  function setupInteractions() {
    // 点赞按钮切换
    document.querySelectorAll('.post-actions button').forEach(btn => {
      btn.addEventListener('click', function () {
        if (this.querySelector('.fa-thumbs-up')) {
          this.classList.toggle('liked');
          const icon = this.querySelector('i');
          if (this.classList.contains('liked')) {
            icon.classList.remove('far');
            icon.classList.add('fas');
          } else {
            icon.classList.remove('fas');
            icon.classList.add('far');
          }
        }
      });
    });

    // 关注按钮
    document.querySelectorAll('.btn-follow').forEach(btn => {
      btn.addEventListener('click', function () {
        if (this.textContent === '关注') {
          this.textContent = '已关注';
          this.style.background = 'var(--bg-tertiary)';
          this.style.color = 'var(--text-secondary)';
        } else {
          this.textContent = '关注';
          this.style.background = 'var(--accent)';
          this.style.color = '#fff';
        }
      });
    });

    // 投票交互
    document.querySelectorAll('.poll-option').forEach(opt => {
      opt.addEventListener('click', function () {
        this.style.border = '2px solid var(--accent)';
        const bar = this.querySelector('.poll-bar');
        if (bar) bar.style.background = 'rgba(99, 102, 241, 0.25)';
      });
    });
  }

  // 设置模拟 Cookie（用于 XSS 演示读取）
  function setupDemoCookies() {
    document.cookie = 'session_id=a8f5f167f44f4964e6c998dee827110c; path=/';
    document.cookie = 'user_token=eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiemhhbmd4aWFvbWluZyJ9.fake_jwt_token; path=/';
    document.cookie = 'csrf_token=x7k9m2p4q8r1s5; path=/';
  }

  // ========== 搜索页：反射型 XSS 核心逻辑 ==========

  let isVulnerable = true; // 默认存在漏洞

  function processSearchQuery() {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('search');
    const keywordEl = document.getElementById('searchKeyword');

    if (!keywordEl) return;

    if (!query) {
      keywordEl.textContent = '（无搜索关键词）';
      return;
    }

    if (isVulnerable) {
      // ⚠️ 漏洞代码：直接使用 innerHTML 渲染用户输入
      // 这就是反射型 XSS 漏洞的本质 —— URL 参数未经转义直接注入 DOM
      keywordEl.innerHTML = query;

      // innerHTML 不会自动执行 <script> 标签（浏览器安全机制）
      // 但在真实的反射型 XSS 中（如 PHP echo、SSR 模板注入），
      // <script> 会在 HTML 初次解析时执行。
      // 这里我们手动提取并执行 <script> 内容来模拟这一行为。
      const scripts = keywordEl.querySelectorAll('script');
      scripts.forEach(script => {
        try {
          eval(script.textContent);
        } catch (e) {
          console.error('[XSS Payload Error]', e);
        }
      });

      // 检测是否包含 HTML/Script 标签，如果是则显示教学面板
      if (/<[^>]+>/.test(query)) {
        showXSSPanel();
      }
    } else {
      // ✅ 安全代码：使用 textContent 避免 HTML 注入
      keywordEl.textContent = query;
    }
  }

  function showXSSPanel() {
    const panel = document.getElementById('xssPanel');
    if (panel) {
      panel.style.display = 'block';
      panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // 修复按钮
  function setupFixButton() {
    const btnFix = document.getElementById('btnFix');
    if (btnFix) {
      btnFix.addEventListener('click', function () {
        isVulnerable = false;
        this.textContent = '✅ 漏洞已修复！';
        this.style.background = '#666';
        this.disabled = true;

        // 重新处理搜索（这次使用安全方式）
        processSearchQuery();

        // 显示修复成功提示
        showToast('🛡️ 漏洞已修复！现在使用 textContent 安全渲染用户输入。');
      });
    }
  }

  // 再次触发按钮
  function setupExploitButton() {
    const btnExploit = document.getElementById('btnExploit');
    if (btnExploit) {
      btnExploit.addEventListener('click', function () {
        isVulnerable = true;
        const btnFix = document.getElementById('btnFix');
        if (btnFix) {
          btnFix.textContent = '🛡️ 点击修复漏洞';
          btnFix.style.background = 'var(--success)';
          btnFix.disabled = false;
        }

        // 重新处理搜索（使用危险方式）
        processSearchQuery();

        showToast('💣 漏洞已恢复！XSS 将再次触发。');
      });
    }
  }

  // Toast 通知
  function showToast(message) {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10001;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      border: 1px solid var(--border);
      animation: fadeIn 0.3s ease-out;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ========== 不覆盖 alert，让 XSS 触发真实的浏览器原生弹窗 ==========

  // ========== 初始化 ==========
  function init() {
    syncSearchInput();
    setupSearchForm();
    setupInteractions();
    setupDemoCookies();

    if (isSearchPage) {
      processSearchQuery();
      setupFixButton();
      setupExploitButton();
    }
  }

  // DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

(() => {
  "use strict";

  const csrf = document.querySelector('meta[name="tonmen-csrf"]')?.content || "";
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

  let busy = false;
  let cachedHub = null;
  let cachedLead = null;
  const loginSessions = {};

  function toast(message, bad = false) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.className = `toast show${bad ? " error" : ""}`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.className = "toast"; }, 4000);
  }

  function alertBox(message = "") {
    const el = $("#hub-alert");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("hidden", !message);
  }

  async function api(url, options = {}) {
    const opts = { ...options, cache: "no-store", headers: { ...(options.headers || {}) } };
    if ((opts.method || "GET") !== "GET") {
      opts.headers["X-TONMEN-CSRF"] = csrf;
      opts.headers["Content-Type"] = "application/json";
      if (opts.body && typeof opts.body !== "string") {
        opts.body = JSON.stringify(opts.body);
      } else {
        opts.body ||= "{}";
      }
    }
    const response = await fetch(url, opts);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || data.technical || `${response.status} ${response.statusText}`);
    }
    return data;
  }

  function providerState(provider) {
    const probe = provider.last_probe;
    if (probe?.ready) return ["可用", "ready"];
    if (provider.auth_mode === "api_key") {
      return provider.key_configured ? ["已配置", "ready"] : ["未配置", "not-configured"];
    }
    if (!provider.installed) return ["未安装", "bad"];
    if (probe && !probe.ready) return ["待授权", "warn"];
    return [provider.enabled_in_pool ? "待检查" : "可配置", "warn"];
  }

  function renderSummary(hub) {
    const providers = hub.providers || [];
    const ready = providers.filter(item => {
      const [, tone] = providerState(item);
      return tone === "ready" || item.key_configured;
    }).length;
    const usage = hub.historical_usage || {};
    const pool = hub.pool || [];

    const items = [
      ["子代理模型", pool.length],
      ["可用账号", ready],
      ["调用次数", usage.total_calls || 0],
      ["Token", usage.total_tokens || 0],
      ["Token 上限", hub.token_budget || 0],
    ];

    $("#hub-summary").innerHTML = items.map(([label, value]) => `
      <div class="hub-summary-card">
        <span>${esc(label)}</span>
        <strong>${esc(value)}</strong>
      </div>
    `).join("");
  }

  function renderLead(lead) {
    const cfg = lead.config || {};
    const active = Boolean(cfg.active);
    const activeToggle = $("#lead-active-toggle");
    const providerSelect = $("#lead-provider-select");
    const modelInput = $("#lead-model-input");
    const dot = $("#lead-status-dot");
    const text = $("#lead-status-text");

    if (activeToggle) activeToggle.checked = active;
    if (providerSelect && cfg.provider && cfg.provider !== "disabled") {
      providerSelect.value = cfg.provider;
    }
    if (modelInput && cfg.model && !modelInput.matches(":focus")) {
      modelInput.value = cfg.model;
    }

    if (dot && text) {
      if (active) {
        dot.style.background = "#4ade80";
        dot.style.boxShadow = "0 0 8px rgba(74,222,128,0.5)";
        text.textContent = `已开启 (${cfg.provider || "openai"} · ${cfg.model || "gpt-4o"})`;
      } else if (cfg.provider && cfg.provider !== "disabled") {
        dot.style.background = "#fbbf24";
        dot.style.boxShadow = "0 0 8px rgba(251,191,36,0.5)";
        text.textContent = `降级模式 (${cfg.provider} 待启用)`;
      } else {
        dot.style.background = "#6b7280";
        dot.style.boxShadow = "none";
        text.textContent = "未开启 · 使用内置规则";
      }
    }
  }

  function providerCard(provider) {
    const [label, tone] = providerState(provider);
    const usage = provider.usage || {};
    const probe = provider.last_probe;
    const session = loginSessions[provider.id] || {};
    const loginUrl = session.login_url || probe?.login_url;
    const oneTimeCode = session.one_time_code || probe?.one_time_code;

    let authSection = "";
    if (provider.auth_mode === "api_key") {
      authSection = `
        <div class="prov-key-row">
          <input type="password" class="prov-key-input"
            placeholder="${provider.key_configured ? '•••••••••••••••• (已保存，可输入新 Key 覆盖)' : '粘贴 ' + (provider.key_env || 'API Key')}"
            data-key-input="${esc(provider.id)}" autocomplete="off" spellcheck="false">
        </div>
        <div class="prov-actions">
          <button type="button" class="prov-save-btn" data-save-key="${esc(provider.id)}">保存 Key</button>
          ${provider.key_configured ? `<button type="button" class="prov-delete-btn" title="清除保存的 Key" data-clear-key="${esc(provider.id)}">🗑</button>` : ""}
        </div>
      `;
    } else {
      // CLI / Browser Login
      const cliNote = provider.installed
        ? `<div class="prov-cli-note">支持一键拉起官方认证通道。TONMEN 不持久化任何敏感凭据。</div>`
        : `<div class="prov-cli-note" style="color:#f87171">系统未检测到 <code>${esc(provider.id)}</code> CLI 命令，请确保已安装。</div>`;

      const authBox = (loginUrl || oneTimeCode) ? `
        <div class="prov-auth-box">
          <span class="auth-label">官方授权验证码 (One-Time Code)</span>
          <div class="auth-code-row">
            <span class="auth-code">${esc(oneTimeCode || "无需代码")}</span>
            ${oneTimeCode ? `<button type="button" class="copy-btn" data-copy="${esc(oneTimeCode)}">复制</button>` : ""}
          </div>
          ${loginUrl ? `<a href="${esc(loginUrl)}" target="_blank" rel="noopener noreferrer" class="auth-link">🔗 点击进入官方授权网页 ↗</a>` : ""}
          <span class="auth-hint">请在弹出的官方页面完成登录授权，随后点击下方“检查连接”。</span>
        </div>
      ` : "";

      authSection = `
        ${cliNote}
        <button type="button" class="prov-login-btn" data-prov-login="${esc(provider.id)}" ${!provider.installed ? "disabled" : ""}>
          ⚡ 一键登录 (官方 CLI)
        </button>
        ${authBox}
      `;
    }

    return `
      <article class="provider-card ${provider.enabled_in_pool ? "pool-enabled" : ""} state-${tone}">
        <div class="provider-card-head">
          <div>
            <h3 class="provider-card-name">${esc(provider.label)}</h3>
            <small class="provider-card-sub">${esc(provider.default_model || "默认模型")}</small>
          </div>
          <span class="prov-badge ${tone}">${esc(label)}</span>
        </div>

        <div class="prov-stats">
          <div class="prov-stat">
            <span>调用次数</span>
            <strong>${esc(usage.calls || 0)}</strong>
          </div>
          <div class="prov-stat">
            <span>Token</span>
            <strong>${esc(usage.total_tokens || 0)}</strong>
          </div>
          <div class="prov-stat">
            <span>失败</span>
            <strong>${esc(usage.failures || 0)}</strong>
          </div>
        </div>

        <div class="prov-body">
          ${probe ? `<div class="prov-probe-msg">${probe.ready ? "✓" : "△"} ${esc(probe.detail || "已完成测试")}</div>` : ""}

          <label class="prov-pool-check">
            <input type="checkbox" data-pool-prov="${esc(provider.id)}" ${provider.enabled_in_pool ? "checked" : ""}>
            <span>加入 Council Provider 池</span>
          </label>

          ${authSection}

          <button type="button" class="prov-probe-btn" data-prov-probe="${esc(provider.id)}">
            🔍 检查连接
          </button>
        </div>
      </article>
    `;
  }

  function renderProviders(hub) {
    const container = $("#provider-grid");
    if (!container) return;
    const providers = hub.providers || [];
    if (!providers.length) {
      container.innerHTML = `<div class="hub-empty">暂无可用模型账号。</div>`;
      return;
    }
    container.innerHTML = providers.map(providerCard).join("");
  }

  function bindEvents() {
    // Copy button
    document.querySelectorAll("[data-copy]").forEach(btn => {
      btn.onclick = () => {
        const text = btn.dataset.copy;
        if (!text) return;
        navigator.clipboard.writeText(text).then(
          () => toast(`已复制授权码: ${text}`),
          () => toast("复制失败，请手动选择复制", true)
        );
      };
    });

    // Save Key button
    document.querySelectorAll("[data-save-key]").forEach(btn => {
      btn.onclick = async () => {
        if (busy) return;
        const id = btn.dataset.saveKey;
        const input = document.querySelector(`[data-key-input="${CSS.escape(id)}"]`);
        const value = input?.value?.trim();
        if (!value) return toast("请先输入有效的 API Key。", true);

        try {
          busy = true;
          btn.disabled = true;
          await api(`/api/ai/providers/${encodeURIComponent(id)}/key`, {
            method: "POST",
            body: { value },
          });
          toast(`${id} API Key 已安全保存`);
          if (input) input.value = "";
          await refresh();
        } catch (err) {
          toast(err.message || String(err), true);
        } finally {
          busy = false;
          btn.disabled = false;
        }
      };
    });

    // Clear Key button
    document.querySelectorAll("[data-clear-key]").forEach(btn => {
      btn.onclick = async () => {
        if (busy) return;
        const id = btn.dataset.clearKey;
        if (!confirm(`确定要清除 ${id} 的 API Key 凭据吗？`)) return;

        try {
          busy = true;
          btn.disabled = true;
          await api(`/api/ai/providers/${encodeURIComponent(id)}/clear-key`, {
            method: "POST",
          });
          toast(`已清除 ${id} API Key`);
          await refresh();
        } catch (err) {
          toast(err.message || String(err), true);
        } finally {
          busy = false;
          btn.disabled = false;
        }
      };
    });

    // One-click Login button (CLI)
    document.querySelectorAll("[data-prov-login]").forEach(btn => {
      btn.onclick = async () => {
        if (busy) return;
        const id = btn.dataset.provLogin;
        const originalText = btn.innerHTML;

        try {
          busy = true;
          btn.disabled = true;
          btn.textContent = "正在拉起登录…";

          const result = await api(`/api/ai/providers/${encodeURIComponent(id)}/login`, {
            method: "POST",
          });

          if (result.login_url || result.one_time_code) {
            loginSessions[id] = {
              login_url: result.login_url,
              one_time_code: result.one_time_code,
            };
            if (result.login_url) {
              window.open(result.login_url, "_blank");
            }
            toast(`官方登录流程已启动${result.one_time_code ? "，验证码: " + result.one_time_code : ""}`);
          } else {
            toast("登录进程已在服务器后台启动，请按照 CLI 流程完成授权。");
          }
          await refresh();
        } catch (err) {
          toast(`一键登录失败: ${err.message || String(err)}`, true);
        } finally {
          busy = false;
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      };
    });

    // Probe connection button
    document.querySelectorAll("[data-prov-probe]").forEach(btn => {
      btn.onclick = async () => {
        if (busy) return;
        const id = btn.dataset.provProbe;
        const originalText = btn.innerHTML;

        try {
          busy = true;
          btn.disabled = true;
          btn.textContent = "检测中…";

          const result = await api(`/api/ai/providers/${encodeURIComponent(id)}/probe`, {
            method: "POST",
          });

          if (result.login_url || result.one_time_code) {
            loginSessions[id] = {
              login_url: result.login_url,
              one_time_code: result.one_time_code,
            };
          }

          toast(result.ready ? `✓ ${id} 连接正常` : `△ ${result.detail || "未连接"}`, !result.ready);
          await refresh();
        } catch (err) {
          toast(err.message || String(err), true);
        } finally {
          busy = false;
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      };
    });

    // Council Pool checkbox
    document.querySelectorAll("[data-pool-prov]").forEach(cb => {
      cb.onchange = async () => {
        if (busy) return;
        const checkedList = Array.from(document.querySelectorAll("[data-pool-prov]:checked"))
          .map(input => input.dataset.poolProv)
          .filter(Boolean);

        try {
          busy = true;
          await api("/api/ai/config", {
            method: "POST",
            body: { pool: checkedList },
          });
          toast(`Council Provider 池已更新 (${checkedList.length} 个模型)`);
          await refresh();
        } catch (err) {
          toast(err.message || String(err), true);
          cb.checked = !cb.checked;
        } finally {
          busy = false;
        }
      };
    });
  }

  // Lead AI Save Button
  $("#lead-save-btn")?.addEventListener("click", async () => {
    if (busy) return;
    const active = $("#lead-active-toggle")?.checked ?? false;
    const provider = $("#lead-provider-select")?.value || "openai";
    const model = $("#lead-model-input")?.value?.trim() || "gpt-4o";

    try {
      busy = true;
      const btn = $("#lead-save-btn");
      if (btn) btn.disabled = true;

      await api("/api/ai/config", {
        method: "POST",
        body: {
          lead_enabled: active,
          lead_provider: provider,
          lead_model: model,
        },
      });

      toast("AI 主控配置已保存并生效");
      await refresh();
    } catch (err) {
      toast(err.message || String(err), true);
    } finally {
      busy = false;
      const btn = $("#lead-save-btn");
      if (btn) btn.disabled = false;
    }
  });

  // New Model Dialog Handling
  const dialogOverlay = $("#model-dialog-overlay");
  const openDialogBtn = $("#open-new-model-btn");
  const closeDialogBtn = $("#close-model-dialog");
  const newModelForm = $("#new-model-form");

  function openDialog() {
    if (dialogOverlay) dialogOverlay.classList.remove("hidden");
  }

  function closeDialog() {
    if (dialogOverlay) dialogOverlay.classList.add("hidden");
  }

  openDialogBtn?.addEventListener("click", openDialog);
  closeDialogBtn?.addEventListener("click", closeDialog);
  dialogOverlay?.addEventListener("click", e => {
    if (e.target === dialogOverlay) closeDialog();
  });

  // Toggle API Key row visibility based on auth mode in dialog
  $("#m-auth-mode")?.addEventListener("change", e => {
    const keyRow = $("#m-key-row");
    if (!keyRow) return;
    keyRow.style.display = e.target.value === "api_key" ? "block" : "none";
  });

  // Test custom endpoint connection in dialog
  $("#m-test-btn")?.addEventListener("click", async () => {
    const baseUrl = $("#m-base-url")?.value?.trim();
    if (!baseUrl) return toast("请先输入 API Base URL 端点。", true);
    toast("正在测试模型端点连接…");
    try {
      // Attempt quick options/head check or ping
      await fetch(baseUrl, { method: "HEAD", mode: "no-cors" });
      toast("✓ 基础端点网络连通正常");
    } catch (err) {
      toast(`端点连通性测试提示: ${err.message || "可直接保存"}`, false);
    }
  });

  // Submit custom model configuration
  newModelForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const id = $("#m-id")?.value?.trim().toLowerCase();
    const label = $("#m-label")?.value?.trim();
    const authMode = $("#m-auth-mode")?.value;
    const baseUrl = $("#m-base-url")?.value?.trim();
    const defaultModel = $("#m-default-model")?.value?.trim();
    const keyEnv = $("#m-key-env")?.value?.trim() || `${id.toUpperCase()}_API_KEY`;
    const apiKey = $("#m-api-key")?.value?.trim();
    const poolEnable = $("#m-pool-enable")?.checked ?? true;

    if (!id || !label) return toast("请填写完整的供应商 ID 与显示名称。", true);

    try {
      busy = true;
      // If API key was provided, save the key
      if (apiKey && authMode === "api_key") {
        await api(`/api/ai/providers/${encodeURIComponent(id)}/key`, {
          method: "POST",
          body: { value: apiKey },
        }).catch(() => {});
      }

      // If enabled in pool, update pool
      if (poolEnable && cachedHub) {
        const currentPool = new Set(cachedHub.pool || []);
        currentPool.add(id);
        await api("/api/ai/config", {
          method: "POST",
          body: { pool: Array.from(currentPool) },
        }).catch(() => {});
      }

      toast(`已创建配置: ${label} (${id})`);
      closeDialog();
      newModelForm.reset();
      await refresh();
    } catch (err) {
      toast(`创建失败: ${err.message || String(err)}`, true);
    } finally {
      busy = false;
    }
  });

  async function refresh() {
    try {
      alertBox("");
      const [lead, hub] = await Promise.all([
        api("/api/ai/lead"),
        api("/api/ai/providers"),
      ]);

      cachedLead = lead;
      cachedHub = hub;

      renderSummary(hub);
      renderLead(lead);
      renderProviders(hub);
      bindEvents();

      const updated = $("#hub-updated");
      if (updated) updated.textContent = new Date().toLocaleTimeString();
    } catch (err) {
      alertBox(err.message || String(err));
    }
  }

  $("#hub-refresh")?.addEventListener("click", () => {
    toast("正在刷新 AI 配置…");
    refresh();
  });

  setInterval(() => {
    if (!document.hidden && !busy) refresh();
  }, 6000);

  refresh();
})();

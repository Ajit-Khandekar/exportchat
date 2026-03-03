// Content script for claude.ai
// Responsible for extracting the current conversation and title
// and wiring it into the global ExportChat namespace.

(function initClaudeExportChat() {
  if (window.ExportChat && window.ExportChat.platformInitialized) {
    return;
  }

  window.ExportChat = window.ExportChat || {};

  window.ExportChat.platform = "claude";
  window.ExportChat.platformInitialized = true;

  /**
   * Get actual conversation title (for filename); avoid sidebar/generic labels.
   */
  function getClaudeTitle() {
    const inMain = document.querySelector("main h1, main [data-testid='chat-title'], main [data-test='conversation-title']");
    if (inMain && inMain.textContent && inMain.textContent.trim()) {
      return inMain.textContent.trim();
    }
    const possibleSelectors = [
      'header h1',
      '[data-testid="chat-title"]',
      '[data-test="conversation-title"]',
      'h1',
    ];
    for (const sel of possibleSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent && el.textContent.trim().length > 0) {
        return el.textContent.trim();
      }
    }
    if (document.title && document.title.trim()) {
      return document.title.replace(/ - Claude.*$/i, "").trim();
    }
    return "claude-chat";
  }

  function findClaudeConversationRoot() {
    const possibleSelectors = [
      "main [data-testid='conversation-view']",
      "main [data-test='conversation-view']",
      "main [data-testid='chat']",
      "main [data-test='chat']",
      "main [role='main']",
      "main",
    ];

    for (const sel of possibleSelectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }

    return null;
  }

  function escapeHtml(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeWhitespace(str) {
    return (str || "").replace(/\s+/g, " ").trim();
  }

  function extractClaudeMessages() {
    const humanEls = Array.from(
      document.querySelectorAll('div[class*="font-user-message"]')
    );
    const claudeEls = Array.from(
      document.querySelectorAll('div[class*="font-claude"]')
    );

    const maxLen = Math.max(humanEls.length, claudeEls.length);
    const messages = [];

    for (let i = 0; i < maxLen; i++) {
      const humanEl = humanEls[i];
      if (humanEl) {
        const text = normalizeWhitespace(humanEl.innerText || "");
        if (text) {
          messages.push({ role: "human", text });
        }
      }

      const claudeEl = claudeEls[i];
      if (claudeEl) {
        const text = normalizeWhitespace(claudeEl.innerText || "");
        if (text) {
          messages.push({ role: "assistant", text });
        }
      }
    }

    return messages;
  }

  function buildClaudeConversationHTML(title, messages) {
    const safeTitle = escapeHtml(title || "Claude Chat");
    const parts = [`<h1>${safeTitle}</h1>`, '<div class="exportchat-conversation">'];

    messages.forEach((msg) => {
      const label = msg.role === "human" ? "User:" : "Claude:";
      parts.push(
        `<p><strong>${label}</strong> ${escapeHtml(msg.text)}</p>`
      );
    });

    parts.push("</div>");
    return parts.join("");
  }

  function buildClaudeConversationText(title, messages) {
    const lines = [];
    lines.push((title || "Claude Chat").trim());
    lines.push("");

    messages.forEach((msg) => {
      const label = msg.role === "human" ? "User:" : "Claude:";
      lines.push(`${label} ${msg.text.trim()}`);
      lines.push("");
    });

    return lines.join("\n").trimEnd();
  }

  /**
   * Public function used by the shared UI to collect
   * the current conversation content and metadata.
   */
  window.ExportChat.getCurrentChat = function getCurrentChatClaude() {
    const title = getClaudeTitle();
    const messages = extractClaudeMessages();

    const html = buildClaudeConversationHTML(title, messages);
    const text = buildClaudeConversationText(title, messages);

    return {
      platform: "claude",
      title,
      html,
      text,
      exportedAt: new Date().toISOString(),
    };
  };
})();


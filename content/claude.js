/**
 * ExportChat - Export AI chats to MD, PDF, TXT, HTML, JSON
 * Copyright (c) 2026 Ajit Khandekar
 * https://github.com/Ajit-Khandekar/exportchat
 * Licensed under the MIT License
 */
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

  // Generic labels Claude.ai shows regardless of which chat is open.
  const GENERIC_TITLES = new Set(["claude", "claude.ai", "new conversation", "new chat"]);

  function titleFromFirstUserMessage() {
    const firstHuman = document.querySelector('div[class*="font-user-message"]');
    if (!firstHuman) return null;
    const raw = (firstHuman.innerText || "").trim();
    if (!raw) return null;
    return raw
      .slice(0, 50)
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  /**
   * Get actual conversation title (for filename); avoid sidebar/generic labels.
   */
  function getClaudeTitle() {
    // document.title is "Conversation title - Claude" for named chats.
    if (document.title && document.title.trim()) {
      const fromPageTitle = document.title.replace(/ - Claude.*$/i, "").trim();
      if (fromPageTitle && !GENERIC_TITLES.has(fromPageTitle.toLowerCase())) {
        return fromPageTitle;
      }
    }

    // Try specific conversation title selectors only — not bare h1 which grabs the nav heading.
    const titleSelectors = [
      'main [data-testid="chat-title"]',
      'main [data-test="conversation-title"]',
      '[data-testid="chat-title"]',
      '[data-test="conversation-title"]',
    ];
    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent && el.textContent.trim()) {
        const t = el.textContent.trim();
        if (!GENERIC_TITLES.has(t.toLowerCase())) {
          return t;
        }
      }
    }

    return titleFromFirstUserMessage() || "Claude-Chat";
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

  function extractTextFromElement(el) {
    const clone = el.cloneNode(true);
    const preEls = Array.from(el.querySelectorAll("pre"));
    const clonePres = Array.from(clone.querySelectorAll("pre"));
    preEls.forEach(function(pre, i) {
      const code = pre.querySelector("code");
      const lang = (code ? code.className : "").replace(/.*\blanguage-(\S+).*/, "$1") || "";
      // Read from <code> only to exclude any language label elements inside <pre>
      const content = code ? (code.innerText || code.textContent || "") : (pre.innerText || pre.textContent || "");
      if (clonePres[i]) {
        // Remove preceding sibling if it looks like an external language label
        const prevSib = clonePres[i].previousElementSibling;
        if (prevSib && lang && prevSib.textContent.trim().length < 60 &&
            prevSib.textContent.trim().toLowerCase().includes(lang.toLowerCase())) {
          prevSib.remove();
        }
        clonePres[i].replaceWith("\n```" + lang + "\n" + content + "\n```\n");
      }
    });
    clone.querySelectorAll("br").forEach(function(br) { br.replaceWith("\n"); });
    clone.querySelectorAll("p").forEach(function(p) { p.after("\n"); });
    var text = (clone.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
    // Safety net: remove language label still on the line just before its opening fence
    text = text.replace(/^(\w+)\n(```\1)/gm, "$2");
    return text;
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
        const text = extractTextFromElement(humanEl);
        if (text) {
          messages.push({ role: "human", text });
        }
      }

      const claudeEl = claudeEls[i];
      if (claudeEl) {
        const text = extractTextFromElement(claudeEl);
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


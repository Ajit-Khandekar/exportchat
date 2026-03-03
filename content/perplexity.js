// Content script for Perplexity (perplexity.ai)

(function initPerplexityExportChat() {
  window.ExportChat = window.ExportChat || {};

  if (window.ExportChat.platformInitialized) {
    return;
  }

  window.ExportChat.platform = "perplexity";
  window.ExportChat.platformInitialized = true;

  function getPerplexityTitle() {
    const mainTitle = document.querySelector("main h1, main [data-testid='conversation-title']");
    if (mainTitle && mainTitle.textContent && mainTitle.textContent.trim()) {
      return mainTitle.textContent.trim();
    }
    const possibleSelectors = [
      'header h1',
      '[data-testid="conversation-title"]',
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
      return document.title.replace(/ - Perplexity.*$/i, "").trim();
    }
    return "perplexity-chat";
  }

  function findPerplexityConversationRoot() {
    const possibleSelectors = [
      "main [data-testid='chat-scroll-container']",
      "main [data-test='chat-scroll-container']",
      "main [data-testid='conversation-view']",
      "main [data-test='conversation-view']",
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

  function extractPerplexityMessages(root) {
    if (!root) return [];

    const messages = [];

    const candidates = root.querySelectorAll(
      "[data-testid*='message'], [data-test*='message'], article, section"
    );

    candidates.forEach((node) => {
      const text = normalizeWhitespace(node.textContent || "");
      if (!text) return;

      const roleHint =
        node.getAttribute("data-author") ||
        node.getAttribute("data-message-author-role") ||
        node.getAttribute("data-testid") ||
        node.getAttribute("data-test") ||
        "";

      const lower = roleHint.toLowerCase();
      let role = "assistant";
      if (lower.includes("user") || lower.includes("human") || lower.includes("question")) {
        role = "human";
      } else if (lower.includes("assistant") || lower.includes("answer") || lower.includes("perplexity")) {
        role = "assistant";
      }

      messages.push({ role, text });
    });

    return messages;
  }

  function buildPerplexityConversationHTML(title, messages) {
    const safeTitle = escapeHtml(title || "Perplexity Chat");
    const parts = [`<h1>${safeTitle}</h1>`, '<div class="exportchat-conversation">'];

    messages.forEach((msg) => {
      const label = msg.role === "human" ? "User:" : "Perplexity:";
      parts.push(
        `<p><strong>${label}</strong> ${escapeHtml(msg.text)}</p>`
      );
    });

    parts.push("</div>");
    return parts.join("");
  }

  function buildPerplexityConversationText(title, messages) {
    const lines = [];
    lines.push((title || "Perplexity Chat").trim());
    lines.push("");

    messages.forEach((msg) => {
      const label = msg.role === "human" ? "User:" : "Perplexity:";
      lines.push(`${label} ${msg.text.trim()}`);
      lines.push("");
    });

    return lines.join("\n").trimEnd();
  }

  window.ExportChat.getCurrentChat = function getCurrentChatPerplexity() {
    const title = getPerplexityTitle();
    const root = findPerplexityConversationRoot();
    const messages = extractPerplexityMessages(root);

    const html = buildPerplexityConversationHTML(title, messages);
    const text = buildPerplexityConversationText(title, messages);

    return {
      platform: "perplexity",
      title,
      html,
      text,
      exportedAt: new Date().toISOString(),
    };
  };
})();


// Content script for Gemini (gemini.google.com)

(function initGeminiExportChat() {
  window.ExportChat = window.ExportChat || {};

  if (window.ExportChat.platformInitialized) {
    return;
  }

  window.ExportChat.platform = "gemini";
  window.ExportChat.platformInitialized = true;

  function getGeminiTitle() {
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
      return document.title.replace(/ - Gemini.*$/i, "").trim();
    }

    return "gemini-chat";
  }

  function findGeminiConversationRoot() {
    const possibleSelectors = [
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

  function extractGeminiMessages(root) {
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
      if (lower.includes("user") || lower.includes("human")) {
        role = "human";
      } else if (lower.includes("assistant") || lower.includes("model") || lower.includes("gemini")) {
        role = "assistant";
      }

      messages.push({ role, text });
    });

    return messages;
  }

  function buildGeminiConversationHTML(title, messages) {
    const safeTitle = escapeHtml(title || "Gemini Chat");
    const parts = [`<h1>${safeTitle}</h1>`, '<div class="exportchat-conversation">'];

    messages.forEach((msg) => {
      const label = msg.role === "human" ? "User:" : "Gemini:";
      parts.push(
        `<p><strong>${label}</strong> ${escapeHtml(msg.text)}</p>`
      );
    });

    parts.push("</div>");
    return parts.join("");
  }

  function buildGeminiConversationText(title, messages) {
    const lines = [];
    lines.push((title || "Gemini Chat").trim());
    lines.push("");

    messages.forEach((msg) => {
      const label = msg.role === "human" ? "User:" : "Gemini:";
      lines.push(`${label} ${msg.text.trim()}`);
      lines.push("");
    });

    return lines.join("\n").trimEnd();
  }

  window.ExportChat.getCurrentChat = function getCurrentChatGemini() {
    const title = getGeminiTitle();
    const root = findGeminiConversationRoot();
    const messages = extractGeminiMessages(root);

    const html = buildGeminiConversationHTML(title, messages);
    const text = buildGeminiConversationText(title, messages);

    return {
      platform: "gemini",
      title,
      html,
      text,
      exportedAt: new Date().toISOString(),
    };
  };
})();


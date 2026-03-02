// Content script for ChatGPT (chat.openai.com)

(function initChatGPTExportChat() {
  window.ExportChat = window.ExportChat || {};

  if (window.ExportChat.platformInitialized) {
    return;
  }

  window.ExportChat.platform = "chatgpt";
  window.ExportChat.platformInitialized = true;

  function getChatGPTTitle() {
    // Try to read the conversation title from the left sidebar or header
    const possibleSelectors = [
      'nav [data-testid="conversation-title"]',
      'nav [data-test="conversation-title"]',
      'header h1',
      'h1',
      'nav [role="treeitem"][aria-current="page"] span',
    ];

    for (const sel of possibleSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent && el.textContent.trim().length > 0) {
        return el.textContent.trim();
      }
    }

    if (document.title && document.title.trim()) {
      return document.title.replace(/ - ChatGPT.*$/i, "").trim();
    }

    return "chatgpt-chat";
  }

  function findChatGPTConversationRoot() {
    const possibleSelectors = [
      "main [data-testid='conversation-turns']",
      "main [data-test='conversation-turns']",
      "main [role='presentation']",
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

  function extractChatGPTMessages(root) {
    if (!root) return [];

    const messages = [];

    const turns = root.querySelectorAll("[data-testid='conversation-turn'], [data-test='conversation-turn'], article, section");

    turns.forEach((turn) => {
      const segments = turn.querySelectorAll("[data-message-author-role], [data-testid*='message'], [data-test*='message']");

      if (segments.length > 0) {
        segments.forEach((seg) => {
          const roleAttr =
            seg.getAttribute("data-message-author-role") ||
            seg.getAttribute("data-testid") ||
            seg.getAttribute("data-test") ||
            "";
          const lower = roleAttr.toLowerCase();
          let role = "assistant";
          if (lower.includes("user")) role = "human";
          else if (lower.includes("assistant")) role = "assistant";

          const text = normalizeWhitespace(seg.textContent || "");
          if (!text) return;
          messages.push({ role, text });
        });
      } else {
        const text = normalizeWhitespace(turn.textContent || "");
        if (!text) return;
        const isUserLike =
          turn.className.toLowerCase().includes("user") ||
          turn.getAttribute("data-testid")?.toLowerCase().includes("user") ||
          turn.getAttribute("data-test")?.toLowerCase().includes("user");
        const role = isUserLike ? "human" : "assistant";
        messages.push({ role, text });
      }
    });

    return messages;
  }

  function buildChatGPTConversationHTML(title, messages) {
    const safeTitle = escapeHtml(title || "ChatGPT Chat");
    const parts = [`<h1>${safeTitle}</h1>`, '<div class="exportchat-conversation">'];

    messages.forEach((msg) => {
      const label = msg.role === "human" ? "User:" : "ChatGPT:";
      parts.push(
        `<p><strong>${label}</strong> ${escapeHtml(msg.text)}</p>`
      );
    });

    parts.push("</div>");
    return parts.join("");
  }

  function buildChatGPTConversationText(title, messages) {
    const lines = [];
    lines.push((title || "ChatGPT Chat").trim());
    lines.push("");

    messages.forEach((msg) => {
      const label = msg.role === "human" ? "User:" : "ChatGPT:";
      lines.push(`${label} ${msg.text.trim()}`);
      lines.push("");
    });

    return lines.join("\n").trimEnd();
  }

  window.ExportChat.getCurrentChat = function getCurrentChatChatGPT() {
    const title = getChatGPTTitle();
    const root = findChatGPTConversationRoot();
    const messages = extractChatGPTMessages(root);

    const html = buildChatGPTConversationHTML(title, messages);
    const text = buildChatGPTConversationText(title, messages);

    return {
      platform: "chatgpt",
      title,
      html,
      text,
      exportedAt: new Date().toISOString(),
    };
  };
})();


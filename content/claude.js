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

  const EXPORT_CHAT_SCROLL_SETTLE_MS = 1500;

  /**
   * Programmatically scroll the chat area to the top so virtualized messages mount,
   * then wait EXPORT_CHAT_SCROLL_SETTLE_MS before scraping.
   */
  function scrollChatToTopForCapture() {
    window.scrollTo(0, 0);
    const root = findClaudeConversationRoot();
    if (root) {
      root.scrollTop = 0;
      let el = root;
      while (el && el !== document.documentElement) {
        if (el.scrollHeight > el.clientHeight) {
          el.scrollTop = 0;
        }
        el = el.parentElement;
      }
    }
  }

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
    // Strip tool call, search status badges, and collapsible thinking blocks
    clone.querySelectorAll("button, [data-testid*='tool'], div[class*='tool'], div[class*='searched'], [aria-label*='Search'], [data-testid*='thinking']").forEach(function(b) {
      b.remove();
    });

    const preEls = Array.from(el.querySelectorAll("pre"));
    const clonePres = Array.from(clone.querySelectorAll("pre"));
    preEls.forEach(function(pre, i) {
      const code = pre.querySelector("code");
      const lang = (code ? code.className : "").replace(/.*\blanguage-(\S+).*/, "$1") || "";
      const content = code ? (code.innerText || code.textContent || "") : (pre.innerText || pre.textContent || "");
      if (clonePres[i]) {
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
    text = text.replace(/^(\w+)\n(```\1)/gm, "$2");
    // Strip Private Use Area control symbols (e.g. \uE02A) injected by search status indicators
    text = text.replace(/[\uE000-\uF8FF]/g, "").replace(/\uE02A/g, "").trim();
    return text;
  }

  function extractClaudeMessages() {
    const selector = [
      'div[class*="font-user-message"]',
      '[data-testid="user-message"]',
      'div[class*="user-message"]',
      'div.font-user-message',
      'div[class*="UserMessage"]',
      'div[class*="font-claude"]',
      '[data-testid="assistant-message"]',
      'div[class*="claude-message"]',
      'div.font-claude-message',
      'div[class*="AssistantMessage"]'
    ].join(", ");

    const rawNodes = Array.from(document.querySelectorAll(selector));

    // Filter out inner/nested elements so we only process top-level message blocks
    const turnNodes = rawNodes.filter(
      (el) => !rawNodes.some((other) => other !== el && other.contains(el))
    );

    const messages = [];

    turnNodes.forEach((node) => {
      const cls = (node.className || "").toLowerCase();
      const testId = (node.getAttribute("data-testid") || "").toLowerCase();

      const isUser =
        cls.includes("user") ||
        testId.includes("user") ||
        cls.includes("font-user");

      const role = isUser ? "user" : "assistant";
      const text = extractTextFromElement(node);
      if (text) {
        messages.push({ role, text });
      }
    });

    return messages;
  }

  function buildClaudeConversationHTML(title, messages) {
    const safeTitle = escapeHtml(title || "Claude Chat");
    const parts = [`<h1>${safeTitle}</h1>`, '<div class="exportchat-conversation">'];

    messages.forEach((msg) => {
      const label = (msg.role === "user" || msg.role === "human") ? "User:" : "Claude:";
      const htmlFormatted = escapeHtml(msg.text).replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>");
      parts.push(
        `<p><strong>${label}</strong> ${htmlFormatted}</p>`
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
      const label = (msg.role === "user" || msg.role === "human") ? "User:" : "Claude:";
      lines.push(`${label} ${msg.text.trim()}`);
      lines.push("");
    });

    return lines.join("\n").trimEnd();
  }

  function findAllScrollableContainers() {
    const list = new Set();
    const sampleMsg = document.querySelector(
      'div[class*="font-user-message"], [data-testid="user-message"], [data-testid="assistant-message"], div[class*="font-claude"]'
    );
    if (sampleMsg) {
      let el = sampleMsg.parentElement;
      while (el && el !== document.documentElement && el !== document.body) {
        if (el.scrollHeight > el.clientHeight + 10) {
          list.add(el);
        }
        el = el.parentElement;
      }
    }

    const candidates = [
      "main [class*='overflow-y-auto']",
      "[class*='overflow-y-auto']",
      "main",
    ];

    candidates.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (el && el.scrollHeight > el.clientHeight + 10) {
          list.add(el);
        }
      });
    });

    if (list.size === 0) {
      list.add(document.documentElement);
    }

    return Array.from(list);
  }

  function findScrollableContainer() {
    const containers = findAllScrollableContainers();
    return containers[0] || document.documentElement;
  }

  async function scrollChatToTopForCapture() {
    const containers = findAllScrollableContainers();
    let previousTops = containers.map((c) => (c !== document.documentElement && c.scrollTop !== undefined ? c.scrollTop : window.scrollY));
    let stuckCount = 0;
    const maxSteps = 50;

    for (let i = 0; i < maxSteps; i++) {
      const allAtZero = containers.every((c) => (c === document.documentElement ? window.scrollY === 0 : c.scrollTop === 0));

      if (allAtZero) {
        containers.forEach((c) => {
          if (c !== document.documentElement && c.scrollTop !== undefined) c.scrollTop = 0;
          try { c.dispatchEvent(new Event("scroll", { bubbles: true })); } catch (e) {}
        });
        window.scrollTo(0, 0);
        try { window.dispatchEvent(new Event("scroll", { bubbles: true })); } catch (e) {}

        await new Promise((resolve) => setTimeout(resolve, 350));
        const stillAllZero = containers.every((c) => (c === document.documentElement ? window.scrollY === 0 : c.scrollTop === 0));
        if (stillAllZero) {
          break;
        }
      }

      containers.forEach((c) => {
        if (c !== document.documentElement && c.scrollTop !== undefined) {
          c.scrollTop = Math.max(0, c.scrollTop - 2500);
        }
        try { c.dispatchEvent(new Event("scroll", { bubbles: true })); } catch (e) {}
      });
      window.scrollBy(0, -2500);
      try { window.dispatchEvent(new Event("scroll", { bubbles: true })); } catch (e) {}

      await new Promise((resolve) => setTimeout(resolve, 250));

      const currentTops = containers.map((c) => (c !== document.documentElement && c.scrollTop !== undefined ? c.scrollTop : window.scrollY));
      const isUnchanged = currentTops.every((top, idx) => top === previousTops[idx]);

      if (isUnchanged && !allAtZero) {
        stuckCount++;
        if (stuckCount >= 8) {
          break;
        }
      } else {
        stuckCount = 0;
      }
      previousTops = currentTops;
    }

    containers.forEach((c) => {
      if (c !== document.documentElement && c.scrollTop !== undefined) {
        c.scrollTop = 0;
      }
      try { c.dispatchEvent(new Event("scroll", { bubbles: true })); } catch (e) {}
    });
    window.scrollTo(0, 0);
    try { window.dispatchEvent(new Event("scroll", { bubbles: true })); } catch (e) {}

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  window.ExportChat.scrollChatToTop = scrollChatToTopForCapture;

  window.ExportChat.getCurrentChat = async function getCurrentChatClaude() {
    await scrollChatToTopForCapture();
    const title = getClaudeTitle();
    const messages = extractClaudeMessages();

    const html = buildClaudeConversationHTML(title, messages);
    const text = buildClaudeConversationText(title, messages);

    return {
      platform: "claude",
      title,
      messages,
      html,
      text,
      exportedAt: new Date().toISOString(),
    };
  };
})();



/**
 * ExportChat - Export AI chats to MD, PDF, TXT, HTML, JSON
 * Copyright (c) 2026 Ajit Khandekar
 * https://github.com/Ajit-Khandekar/exportchat
 * Licensed under the MIT License
 */
// Content script for ChatGPT (chat.openai.com and chatgpt.com)

(function initChatGPTExportChat() {
  window.ExportChat = window.ExportChat || {};

  if (window.ExportChat.platformInitialized) {
    return;
  }

  window.ExportChat.platform = "chatgpt";
  window.ExportChat.platformInitialized = true;

  const EXPORT_CHAT_SCROLL_SETTLE_MS = 1500;

  function getChatGPTTitle() {
    // Prefer active conversation in sidebar (actual chat title), then main/header
    const sidebarActive = document.querySelector('nav [role="treeitem"][aria-current="page"] span, nav [data-testid="conversation-title"]');
    if (sidebarActive && sidebarActive.textContent && sidebarActive.textContent.trim()) {
      return sidebarActive.textContent.trim();
    }
    const mainTitle = document.querySelector("main h1, header h1");
    if (mainTitle && mainTitle.textContent && mainTitle.textContent.trim()) {
      return mainTitle.textContent.trim();
    }
    if (document.title && document.title.trim()) {
      return document.title.replace(/ - ChatGPT.*$/i, "").trim();
    }
    return "chatgpt-chat";
  }

  function findAllScrollableContainers() {
    const list = new Set();
    const sampleTurn = document.querySelector("[data-testid='conversation-turn'], [data-test='conversation-turn'], article, section");
    if (sampleTurn) {
      let el = sampleTurn.parentElement;
      while (el && el !== document.documentElement && el !== document.body) {
        if (el.scrollHeight > el.clientHeight + 10) {
          list.add(el);
        }
        el = el.parentElement;
      }
    }

    const possibleSelectors = [
      "main [data-testid='conversation-turns']",
      "main [data-test='conversation-turns']",
      "main [role='presentation']",
      "main [class*='overflow-y-auto']",
      "main [class*='react-scroll-to-bottom']",
      "main",
    ];

    for (const sel of possibleSelectors) {
      document.querySelectorAll(sel).forEach((el) => {
        if (el && el.scrollHeight > el.clientHeight + 10) {
          list.add(el);
        }
      });
    }

    if (list.size === 0) {
      list.add(document.documentElement);
    }

    return Array.from(list);
  }

  function findChatGPTConversationRoot() {
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
          if (lower.includes("user")) role = "user";
          else if (lower.includes("assistant")) role = "assistant";

          const text = extractTextFromElement(seg);
          if (!text) return;
          messages.push({ role, text });
        });
      } else {
        const text = extractTextFromElement(turn);
        if (!text) return;
        const isUserLike =
          turn.className.toLowerCase().includes("user") ||
          turn.getAttribute("data-testid")?.toLowerCase().includes("user") ||
          turn.getAttribute("data-test")?.toLowerCase().includes("user");
        const role = isUserLike ? "user" : "assistant";
        messages.push({ role, text });
      }
    });

    return messages;
  }

  function buildChatGPTConversationHTML(title, messages) {
    const safeTitle = escapeHtml(title || "ChatGPT Chat");
    const parts = [`<h1>${safeTitle}</h1>`, '<div class="exportchat-conversation">'];

    messages.forEach((msg) => {
      const label = (msg.role === "user" || msg.role === "human") ? "User:" : "ChatGPT:";
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
      const label = (msg.role === "user" || msg.role === "human") ? "User:" : "ChatGPT:";
      lines.push(`${label} ${msg.text.trim()}`);
      lines.push("");
    });

    return lines.join("\n").trimEnd();
  }

  window.ExportChat.getCurrentChat = async function getCurrentChatChatGPT() {
    await scrollChatToTopForCapture();
    const title = getChatGPTTitle();
    const root = findChatGPTConversationRoot();
    const messages = extractChatGPTMessages(root);

    const html = buildChatGPTConversationHTML(title, messages);
    const text = buildChatGPTConversationText(title, messages);

    return {
      platform: "chatgpt",
      title,
      messages,
      html,
      text,
      exportedAt: new Date().toISOString(),
    };
  };
})();


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

  function findChatGPTConversationRoot() {
    const sampleTurn = document.querySelector("[data-testid='conversation-turn'], [data-test='conversation-turn'], article, section");
    if (sampleTurn) {
      let el = sampleTurn.parentElement;
      while (el && el !== document.documentElement && el !== document.body) {
        if (el.scrollHeight > el.clientHeight + 20) {
          const overflow = window.getComputedStyle(el).overflowY;
          if (overflow === "auto" || overflow === "scroll" || overflow === "overlay") {
            return el;
          }
        }
        el = el.parentElement;
      }
    }

    const possibleSelectors = [
      "main [data-testid='conversation-turns']",
      "main [data-test='conversation-turns']",
      "main [role='presentation']",
      "main",
    ];

    for (const sel of possibleSelectors) {
      const el = document.querySelector(sel);
      if (el && el.scrollHeight > el.clientHeight + 20) return el;
    }

    return document.querySelector("main") || document.documentElement;
  }

  async function scrollChatToTopForCapture(onProgressCb) {
    const container = findChatGPTConversationRoot();
    let previousTop = -1;
    let stuckCount = 0;
    const maxSteps = 40;
    const accumulatedList = [];
    const seenKeys = new Set();

    function collectCurrentDOM() {
      const root = findChatGPTConversationRoot();
      const currentMsgs = extractChatGPTMessages(root);
      currentMsgs.forEach((m) => {
        const key = m.role + "::" + m.text;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          accumulatedList.push(m);
        }
      });
      if (typeof onProgressCb === "function") {
        onProgressCb({ count: accumulatedList.length });
      }
    }

    collectCurrentDOM();

    for (let i = 0; i < maxSteps; i++) {
      const currentScrollTop = container !== document.documentElement && container.scrollTop !== undefined ? container.scrollTop : window.scrollY;

      if (container !== document.documentElement && container.scrollTop === 0) {
        container.scrollTop = 0;
        window.scrollTo(0, 0);
        container.dispatchEvent(new Event("scroll", { bubbles: true }));
        window.dispatchEvent(new Event("scroll", { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 300));
        collectCurrentDOM();
        if (container.scrollTop === 0) {
          break;
        }
      }

      if (container !== document.documentElement && container.scrollTop !== undefined) {
        container.scrollTop = Math.max(0, container.scrollTop - 2000);
      }
      window.scrollBy(0, -2000);

      try {
        container.dispatchEvent(new Event("scroll", { bubbles: true }));
        window.dispatchEvent(new Event("scroll", { bubbles: true }));
      } catch (e) {}

      await new Promise((resolve) => setTimeout(resolve, 250));
      collectCurrentDOM();

      const newScrollTop = container !== document.documentElement && container.scrollTop !== undefined ? container.scrollTop : window.scrollY;
      if (newScrollTop === previousTop) {
        stuckCount++;
        if (stuckCount >= 2) break;
      } else {
        stuckCount = 0;
      }
      previousTop = newScrollTop;
    }

    if (container !== document.documentElement && container.scrollTop !== undefined) {
      container.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    try {
      container.dispatchEvent(new Event("scroll", { bubbles: true }));
      window.dispatchEvent(new Event("scroll", { bubbles: true }));
    } catch (e) {}

    await new Promise((resolve) => setTimeout(resolve, 400));
    collectCurrentDOM();

    const finalRoot = findChatGPTConversationRoot();
    const finalMsgs = extractChatGPTMessages(finalRoot);
    finalMsgs.forEach((m) => {
      const key = m.role + "::" + m.text;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        accumulatedList.push(m);
      }
    });

    if (typeof onProgressCb === "function") {
      onProgressCb({ count: accumulatedList.length });
    }

    return accumulatedList;
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
    clone.querySelectorAll("button, [data-testid*='action'], [data-testid*='copy'], [data-testid*='show-more'], [aria-label*='Show more']").forEach((b) => b.remove());

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
    clone.querySelectorAll("p, h1, h2, h3, h4, h5, h6, blockquote").forEach(function(p) { p.after("\n\n"); });
    clone.querySelectorAll("li").forEach(function(li) { li.after("\n"); });
    var text = (clone.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
    text = text.replace(/^(\w+)\n(```\1)/gm, "$2");
    text = text.replace(/Show more\s*Show less/gi, "").trim();
    return text;
  }

  function extractChatGPTMessages(root) {
    if (!root) return [];

    const rawTurns = Array.from(root.querySelectorAll("[data-testid='conversation-turn'], [data-test='conversation-turn'], article"));
    let turnNodes = rawTurns.filter(
      (el) => !rawTurns.some((other) => other !== el && other.contains(el))
    );

    if (turnNodes.length === 0) {
      turnNodes = Array.from(root.querySelectorAll("article, section"));
    }

    const messages = [];

    turnNodes.forEach((turn) => {
      const segments = turn.querySelectorAll("[data-message-author-role], [data-testid*='message'], [data-test*='message']");
      const topLevelSegments = Array.from(segments).filter(
        (seg) => !Array.from(segments).some((other) => other !== seg && other.contains(seg))
      );

      if (topLevelSegments.length > 0) {
        topLevelSegments.forEach((seg) => {
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
          if (!text || text === "Show moreShow less") return;
          messages.push({ role, text });
        });
      } else {
        const text = extractTextFromElement(turn);
        if (!text || text === "Show moreShow less") return;
        const isUserLike =
          turn.className.toLowerCase().includes("user") ||
          turn.getAttribute("data-testid")?.toLowerCase().includes("user") ||
          turn.getAttribute("data-test")?.toLowerCase().includes("user");
        const role = isUserLike ? "user" : "assistant";
        messages.push({ role, text });
      }
    });

    const deduplicated = [];
    messages.forEach((msg) => {
      const last = deduplicated[deduplicated.length - 1];
      if (!last || last.role !== msg.role || last.text !== msg.text) {
        deduplicated.push(msg);
      }
    });

    return deduplicated;
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

  window.ExportChat.getCurrentChat = async function getCurrentChatChatGPT(onProgressCb) {
    const accumulatedMessages = await scrollChatToTopForCapture(onProgressCb);
    const title = getChatGPTTitle();
    const root = findChatGPTConversationRoot();
    let messages = extractChatGPTMessages(root);

    if (messages.length < accumulatedMessages.length) {
      messages = accumulatedMessages;
    }

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


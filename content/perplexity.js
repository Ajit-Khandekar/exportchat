/**
 * ExportChat - Export AI chats to MD, PDF, TXT, HTML, JSON
 * Copyright (c) 2026 Ajit Khandekar
 * https://github.com/Ajit-Khandekar/exportchat
 * Licensed under the MIT License
 */
// Content script for Perplexity (perplexity.ai)

(function initPerplexityExportChat() {
  window.ExportChat = window.ExportChat || {};

  if (window.ExportChat.platformInitialized) {
    return;
  }

  window.ExportChat.platform = "perplexity";
  window.ExportChat.platformInitialized = true;

  const EXPORT_CHAT_SCROLL_SETTLE_MS = 1500;

  function getPerplexityTitle() {
    // Try the page h1 first (Perplexity renders the query as an h1 on search pages).
    const h1 = document.querySelector("h1");
    if (h1 && h1.innerText && h1.innerText.trim()) {
      return h1.innerText.trim();
    }

    // Derive from URL: /search/my-chat-topic-abc123 → "my chat topic"
    // Perplexity appends a short random ID as the last hyphen-segment; drop it.
    const searchSegment = window.location.pathname.split("/search/")[1];
    if (searchSegment) {
      const slug = searchSegment.split("-").slice(0, -1).join(" ").trim();
      if (slug) return slug;
    }

    return "perplexity-chat";
  }

  function extractTextFromElement(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll("a[href*='#'], button, [class*='citation'], [class*='badge'], [class*='source']").forEach((b) => b.remove());

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
    return text;
  }

  function stripCitationBadges(text) {
    if (!text) return "";
    return text
      .replace(/\s+[a-zA-Z0-9.-]+(\.[a-zA-Z]{2,})?\s*\+\d+/g, "")
      .replace(/\s+[a-zA-Z]+(\s+[a-zA-Z]+)?\s+\+\d+/g, "")
      .trim();
  }

  function escapeHtml(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function extractPerplexityCitations(container) {
    if (!container) return [];
    const links = Array.from(container.querySelectorAll("a[href^='http']"));
    const citations = [];
    const seenUrls = new Set();
    links.forEach((a) => {
      const url = a.getAttribute("href");
      const title = (a.innerText || a.textContent || url).replace(/\s+/g, " ").trim();
      if (url && !seenUrls.has(url) && !url.includes("perplexity.ai")) {
        seenUrls.add(url);
        citations.push({ title, url });
      }
    });
    return citations;
  }

  function extractPerplexityMessages() {
    const userNodes = Array.from(
      document.querySelectorAll("span.font-sans.text-base.break-words.select-text, [data-testid*='user'], div[class*='user-query']")
    );

    const allAncestors = [];
    const seen = new Set();
    document.querySelectorAll("p.my-2, div.markdown").forEach((p) => {
      const ancestor = p.parentElement?.parentElement || p.parentElement;
      if (ancestor && !seen.has(ancestor)) {
        seen.add(ancestor);
        allAncestors.push(ancestor);
      }
    });

    const responseContainers = allAncestors.filter(
      (el) => !allAncestors.some((other) => other !== el && other.contains(el))
    );

    const items = [];
    userNodes.forEach((node) => items.push({ node, role: "user" }));
    responseContainers.forEach((node) => items.push({ node, role: "assistant" }));

    items.sort((a, b) => {
      const pos = a.node.compareDocumentPosition(b.node);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });

    const messages = [];
    items.forEach(({ node, role }) => {
      if (role === "user") {
        const text = (node.innerText || node.textContent || "").trim();
        if (text) messages.push({ role, text });
      } else {
        let text = stripCitationBadges(extractTextFromElement(node));
        const citations = extractPerplexityCitations(node);
        if (citations.length > 0) {
          text += "\n\nSources:\n" + citations.map((c, idx) => `[${idx + 1}] ${c.title || c.url} (${c.url})`).join("\n");
        }
        if (text) messages.push({ role, text });
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

  function buildHtml(title, messages) {
    const safeTitle = escapeHtml(title || "Perplexity Chat");
    const parts = [`<h1>${safeTitle}</h1>`, '<div class="exportchat-conversation">'];
    messages.forEach((msg) => {
      const label = (msg.role === "user" || msg.role === "human") ? "User:" : "Perplexity:";
      parts.push(`<p><strong>${label}</strong> ${escapeHtml(msg.text)}</p>`);
    });
    parts.push("</div>");
    return parts.join("");
  }

  function buildText(title, messages) {
    const lines = [(title || "Perplexity Chat").trim()];
    messages.forEach((msg) => {
      const label = (msg.role === "user" || msg.role === "human") ? "User:" : "Perplexity:";
      lines.push("");
      lines.push(`${label} ${msg.text.trim()}`);
    });
    return lines.join("\n").trimEnd();
  }

  function findScrollableContainer() {
    const sampleMsg = document.querySelector("span.font-sans, p.my-2, [data-testid='thread']");
    if (sampleMsg) {
      let el = sampleMsg.parentElement;
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

    return (
      document.querySelector("main") ||
      document.querySelector("[data-testid='thread']") ||
      document.documentElement
    );
  }

  async function scrollChatToTopForCapture(onProgressCb) {
    const container = findScrollableContainer();
    let previousTop = -1;
    let stuckCount = 0;
    const maxSteps = 40;
    const accumulatedList = [];
    const seenKeys = new Set();

    function collectCurrentDOM() {
      const currentMsgs = extractPerplexityMessages();
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

    return accumulatedList;
  }

  window.ExportChat.scrollChatToTop = scrollChatToTopForCapture;

  window.ExportChat.getCurrentChat = async function getCurrentChatPerplexity(onProgressCb) {
    const accumulatedMessages = await scrollChatToTopForCapture(onProgressCb);
    const title = getPerplexityTitle();
    let messages = extractPerplexityMessages();

    if (messages.length < accumulatedMessages.length) {
      messages = accumulatedMessages;
    }

    return {
      platform: "perplexity",
      title,
      messages,
      html: buildHtml(title, messages),
      text: buildText(title, messages),
      exportedAt: new Date().toISOString(),
    };
  };
})();

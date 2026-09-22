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

  function stripCitationBadges(text) {
    // Remove inline source citation badges like "amazon +5" or "source +1"
    // that Perplexity injects at the end of response blocks.
    return text.replace(/\s+[a-zA-Z]+(\s+[a-zA-Z]+)?\s+\+\d+/g, "").trim();
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
    // User messages: <span> with all four confirmed classes.
    const userEls = [
      ...document.querySelectorAll(
        "span.font-sans.text-base.break-words.select-text"
      ),
    ];

    // AI response containers: collect the grandparent of every p.my-2 element.
    const allAncestors = [];
    const seen = new Set();
    document.querySelectorAll("p.my-2").forEach((p) => {
      const ancestor = p.parentElement?.parentElement || p.parentElement;
      if (ancestor && !seen.has(ancestor)) {
        seen.add(ancestor);
        allAncestors.push(ancestor);
      }
    });

    const responseContainers = allAncestors.filter(
      (el) => !allAncestors.some((other) => other !== el && other.contains(el))
    );

    const messages = [];
    const maxLen = Math.max(userEls.length, responseContainers.length);
    for (let i = 0; i < maxLen; i++) {
      if (userEls[i]) {
        const text = userEls[i].innerText.trim();
        if (text) messages.push({ role: "user", text });
      }
      if (responseContainers[i]) {
        let text = stripCitationBadges(extractTextFromElement(responseContainers[i]));
        const citations = extractPerplexityCitations(responseContainers[i]);
        if (citations.length > 0) {
          text += "\n\nSources:\n" + citations.map((c, idx) => `[${idx + 1}] ${c.title || c.url} (${c.url})`).join("\n");
        }
        if (text) messages.push({ role: "assistant", text });
      }
    }
    return messages;
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

  function findAllScrollableContainers() {
    const list = new Set();
    const sampleMsg = document.querySelector("span.font-sans, p.my-2, [data-testid='thread']");
    if (sampleMsg) {
      let el = sampleMsg.parentElement;
      while (el && el !== document.documentElement && el !== document.body) {
        if (el.scrollHeight > el.clientHeight + 10) {
          list.add(el);
        }
        el = el.parentElement;
      }
    }

    const possibleSelectors = [
      "main",
      "[data-testid='thread']",
      "[class*='overflow-y-auto']",
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

  window.ExportChat.getCurrentChat = async function getCurrentChatPerplexity() {
    await scrollChatToTopForCapture();
    const title = getPerplexityTitle();
    const messages = extractPerplexityMessages();
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

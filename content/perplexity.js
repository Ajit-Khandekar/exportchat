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
      const content = pre.innerText || pre.textContent || "";
      if (clonePres[i]) {
        clonePres[i].replaceWith("\n```" + lang + "\n" + content + "\n```\n");
      }
    });
    clone.querySelectorAll("br").forEach(function(br) { br.replaceWith("\n"); });
    clone.querySelectorAll("p").forEach(function(p) { p.after("\n"); });
    return (clone.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
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

  function extractPerplexityMessages() {
    // User messages: <span> with all four confirmed classes.
    const userEls = [
      ...document.querySelectorAll(
        "span.font-sans.text-base.break-words.select-text"
      ),
    ];

    // AI response containers: collect the grandparent of every p.my-2 element.
    // Using grandparent (not immediate parent) ensures bullet-list items share
    // a common ancestor (the list container), so the whole response collapses
    // into one block instead of each bullet becoming a separate message.
    const allAncestors = [];
    const seen = new Set();
    document.querySelectorAll("p.my-2").forEach((p) => {
      const ancestor = p.parentElement?.parentElement || p.parentElement;
      if (ancestor && !seen.has(ancestor)) {
        seen.add(ancestor);
        allAncestors.push(ancestor);
      }
    });

    // Discard any container that is a descendant of another — keep outermost only.
    // This collapses any remaining nesting into a single block per response.
    const responseContainers = allAncestors.filter(
      (el) => !allAncestors.some((other) => other !== el && other.contains(el))
    );

    const messages = [];
    const maxLen = Math.max(userEls.length, responseContainers.length);
    for (let i = 0; i < maxLen; i++) {
      if (userEls[i]) {
        const text = userEls[i].innerText.trim();
        if (text) messages.push({ role: "human", text });
      }
      if (responseContainers[i]) {
        const text = stripCitationBadges(extractTextFromElement(responseContainers[i]));
        if (text) messages.push({ role: "assistant", text });
      }
    }
    return messages;
  }

  function buildHtml(title, messages) {
    const safeTitle = escapeHtml(title || "Perplexity Chat");
    const parts = [`<h1>${safeTitle}</h1>`, '<div class="exportchat-conversation">'];
    messages.forEach((msg) => {
      const label = msg.role === "human" ? "User:" : "Perplexity:";
      parts.push(`<p><strong>${label}</strong> ${escapeHtml(msg.text)}</p>`);
    });
    parts.push("</div>");
    return parts.join("");
  }

  function buildText(title, messages) {
    const lines = [(title || "Perplexity Chat").trim()];
    messages.forEach((msg) => {
      const label = msg.role === "human" ? "User:" : "Perplexity:";
      lines.push("");
      lines.push(`${label} ${msg.text.trim()}`);
    });
    return lines.join("\n").trimEnd();
  }

  window.ExportChat.getCurrentChat = function getCurrentChatPerplexity() {
    const title = getPerplexityTitle();
    const messages = extractPerplexityMessages();
    return {
      platform: "perplexity",
      title,
      html: buildHtml(title, messages),
      text: buildText(title, messages),
      exportedAt: new Date().toISOString(),
    };
  };
})();

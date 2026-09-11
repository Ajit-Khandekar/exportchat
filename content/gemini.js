/**
 * ExportChat - Export AI chats to MD, PDF, TXT, HTML, JSON
 * Copyright (c) 2026 Ajit Khandekar
 * https://github.com/Ajit-Khandekar/exportchat
 * Licensed under the MIT License
 */
// Content script for Gemini (gemini.google.com)
// Selectors: user-query, model-response (custom HTML elements)

(function initGeminiExportChat() {
  window.ExportChat = window.ExportChat || {};

  if (window.ExportChat.platformInitialized) {
    return;
  }

  window.ExportChat.platform = "gemini";
  window.ExportChat.platformInitialized = true;

  const EXPORT_CHAT_SCROLL_SETTLE_MS = 1500;
  const EXPORT_CHAT_SCROLL_STEP_PX = 800;
  const EXPORT_CHAT_SCROLL_PAUSE_MS = 600;

  /**
   * Incrementally scroll upward so Gemini lazy-loads older virtualized messages.
   */
  async function scrollChatToTopForCapture() {
    const scrollContainer =
      document.querySelector("infinite-scroller") ||
      document.querySelector("chat-window") ||
      document.documentElement;

    let previousTop = scrollContainer.scrollTop;
    const startTop = previousTop;

    while (scrollContainer.scrollTop > 0) {
      const nextTop = Math.max(0, scrollContainer.scrollTop - EXPORT_CHAT_SCROLL_STEP_PX);
      scrollContainer.scrollTop = nextTop;

      await new Promise((resolve) => setTimeout(resolve, EXPORT_CHAT_SCROLL_PAUSE_MS));

      const currentTop = scrollContainer.scrollTop;
      // Stop if we can't move upward anymore.
      if (currentTop >= previousTop) {
        break;
      }
      previousTop = currentTop;
    }

    // If scrolling never started (already at top), still allow final settle below.
    if (startTop === 0) {
      scrollContainer.scrollTop = 0;
    }

    // Final settle for late-rendered content after reaching top.
    await new Promise((resolve) => setTimeout(resolve, EXPORT_CHAT_SCROLL_SETTLE_MS));
  }

  // Generic values Gemini always shows regardless of which chat is open.
  const GENERIC_TITLES = new Set(["google gemini", "gemini"]);

  function titleFromFirstUserMessage() {
    const firstQuery = document.querySelector("user-query");
    if (!firstQuery) return null;

    // Use .query-text p (same as extractMessages) to exclude the
    // cdk-visually-hidden "You said" accessibility span.
    const paragraphs = [...firstQuery.querySelectorAll(".query-text p")]
      .map((p) => p.innerText.trim())
      .filter((t) => t.length > 0);

    let raw = paragraphs.join(" ").trim();

    // Fallback to .query-text innerText if no paragraphs found.
    if (!raw) {
      const textEl = firstQuery.querySelector(".query-text");
      raw = textEl ? textEl.innerText.trim() : "";
    }

    if (!raw) return null;

    return raw
      .replace(/^you said[\s,:]*/i, "")
      .trim()
      .slice(0, 50)
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function getFilename() {
    let docTitle = document.title.trim().replace(/^you said[\s,:]*/i, "").trim();
    if (docTitle && !GENERIC_TITLES.has(docTitle.toLowerCase())) {
      return docTitle;
    }

    return titleFromFirstUserMessage() || "Gemini-Chat";
  }

  /**
   * Deep Shadow DOM traversal helper.
   * Recursively walks accessible shadow roots to find all matching elements.
   */
  function deepShadowAll(sel, root = document) {
    const found = [];
    const visited = new WeakSet();
    function walk(node) {
      if (!node || visited.has(node)) return;
      visited.add(node);
      try {
        if (node.querySelectorAll) {
          node.querySelectorAll(sel).forEach((n) => found.push(n));
        }
      } catch (e) {}
      try {
        if (node.querySelectorAll) {
          node.querySelectorAll("*").forEach((el) => {
            if (el.shadowRoot) walk(el.shadowRoot);
          });
        }
      } catch (e) {}
    }
    walk(root);
    return found;
  }

  /**
   * Returns the active conversation container so DOM queries are scoped to the
   * current chat only (not sidebar history or cached panels).
   */
  function findActiveConversationContainer() {
    const container =
      document.querySelector("chat-window") ||
      document.querySelector("infinite-scroller") ||
      document;
    return container;
  }

  function normalizeLineBreaks(text) {
    return (text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function cleanGeminiMessage(text) {
    if (text == null) return "";
    return normalizeLineBreaks(
      String(text)
        .replace(/^Gemini said\s*/i, "")
        .replace(/Show thinking[\s\S]*?(?=\n\n|$)/gi, "")
        .replace(/\d+:\d+\s*\/\s*\d+:\d+/g, "")
        .trim()
    );
  }

  function extractUserQueryText(el) {
    if (!el) return "";
    const paragraphs = [...el.querySelectorAll(".query-text p, .user-query-text p, p")]
      .map((p) => p.innerText.trim())
      .filter((t) => t.length > 0);
    
    let raw = paragraphs.length > 0 ? paragraphs.join("\n\n") : (el.innerText || el.textContent || "");
    raw = raw.replace(/^you said[\s,:]*/i, "").trim();

    if (!raw || raw.length < 2) {
      const hasMedia = el.querySelector("img, video, canvas, file-chip, [aria-label*='file'], [aria-label*='image']");
      if (hasMedia) {
        raw = "[Uploaded Attachment / Image]";
      }
    }
    return cleanMessageTextForTextOutput(raw);
  }

  /**
   * Extract messages using precise DOM selectors & deep shadow DOM traversal
   * so we avoid missing assistant turns or picking up sidebar/UI noise.
   */
  function extractMessages() {
    const container = findActiveConversationContainer();

    // Strategy 1: <ms-chat-turn> elements (newer Gemini layout)
    const msTurns = deepShadowAll("ms-chat-turn", container);
    if (msTurns.length > 0) {
      const messages = [];
      msTurns.forEach((turn) => {
        const model = (turn.getAttribute("model") || "").toLowerCase();
        const role = model === "user" ? "user" : "assistant";
        const text = extractGeminiResponseText(turn);
        if (text) messages.push({ role, text });
      });
      if (messages.length > 0) return messages;
    }

    // Strategy 2: <user-query> / <ms-user-query> and <model-response> / <ms-model-response>
    const userNodes = deepShadowAll("user-query, ms-user-query", container);
    const aiNodes = deepShadowAll("model-response, ms-model-response", container);

    if (userNodes.length > 0 || aiNodes.length > 0) {
      const userMessages = userNodes.map((el) => extractUserQueryText(el));
      const geminiMessages = aiNodes.map((el) => extractGeminiResponseText(el));

      const maxLen = Math.max(userMessages.length, geminiMessages.length);
      const messages = [];
      for (let i = 0; i < maxLen; i++) {
        if (userMessages[i]) messages.push({ role: "user", text: userMessages[i] });
        if (geminiMessages[i]) messages.push({ role: "assistant", text: geminiMessages[i] });
      }
      if (messages.length > 0) return messages;
    }

    // Fallback: querySelectorAll on container
    const userMessages = [...container.querySelectorAll("user-query")].map((el) => extractUserQueryText(el));
    const geminiMessages = [...container.querySelectorAll("model-response")].map((el) =>
      extractGeminiResponseText(el)
    );
    const maxLen = Math.max(userMessages.length, geminiMessages.length);
    const messages = [];
    for (let i = 0; i < maxLen; i++) {
      if (userMessages[i]) messages.push({ role: "user", text: userMessages[i] });
      if (geminiMessages[i]) messages.push({ role: "assistant", text: geminiMessages[i] });
    }
    return messages;
  }

  function escapeHtml(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function cleanMessageTextForTextOutput(text) {
    if (text == null) return "";
    // Preserve line structure (especially fenced code blocks & paragraph breaks).
    return String(text)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\d+:\d+\s*\/\s*\d+:\d+/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim();
  }

  function extractGeminiResponseText(modelResponseEl) {
    if (!modelResponseEl) return "";

    const clone = modelResponseEl.cloneNode(true);

    const codeBlockEls = deepShadowAll("code-block", modelResponseEl);
    if (codeBlockEls.length > 0) {
      codeBlockEls.forEach((cb) => {
        const inner = (cb.shadowRoot || cb).querySelector("code") || cb;
        const raw = (inner.textContent || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        if (raw.trim()) {
          const classAttr = inner.getAttribute("class") || "";
          const langMatch = classAttr.match(/\blanguage-([a-z0-9_+-]+)/i);
          const language = langMatch ? langMatch[1] : "";
          const fenced = "\n```" + language + "\n" + raw.trimEnd() + "\n```\n";
          cb.replaceWith(document.createTextNode(fenced));
        }
      });
    }

    const codeLikeNodes = Array.from(
      clone.querySelectorAll(".code-block, .code-container, pre, code")
    );

    codeLikeNodes.forEach((node) => {
      const raw = (node.textContent || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const isMultiline = raw.includes("\n");
      if (!isMultiline || !raw.trim()) return;

      const classAttr = node.getAttribute("class") || "";
      const langMatch = classAttr.match(/\blanguage-([a-z0-9_+-]+)/i);
      const language = langMatch ? langMatch[1] : "";
      const fenced = "\n```" + language + "\n" + raw.trimEnd() + "\n```\n";

      node.replaceWith(document.createTextNode(fenced));
    });

    const flattened = clone.innerText || clone.textContent || "";
    return cleanGeminiMessage(flattened);
  }

  function buildHtml(title, messages) {
    const safeTitle = escapeHtml(title || "Gemini-Chat");
    const parts = [`<h1>${safeTitle}</h1>`, '<div class="exportchat-conversation">'];
    messages.forEach((msg) => {
      const label = (msg.role === "user" || msg.role === "human") ? "User:" : "Gemini:";
      const cleaned = cleanMessageTextForTextOutput(msg.text);
      const htmlFormatted = escapeHtml(cleaned).replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>");
      parts.push(`<p><strong>${label}</strong> ${htmlFormatted}</p>`);
    });
    parts.push("</div>");
    return parts.join("");
  }

  function buildText(title, messages) {
    const lines = [(title || "Gemini-Chat").trim()];
    messages.forEach((msg, index) => {
      const label = (msg.role === "user" || msg.role === "human") ? "User:" : "Gemini:";
      const cleaned = cleanMessageTextForTextOutput(msg.text);
      // Blank line between each message for clearer separation
      lines.push("");
      lines.push(`${label} ${cleaned}`);
    });
    return lines.join("\n").trimEnd();
  }

  function autoScrollToBottom() {
    return new Promise((resolve) => {
      let lastHeight = 0;
      let unchangedCount = 0;
      const interval = setInterval(() => {
        window.scrollTo(0, document.body.scrollHeight);
        const currentHeight = document.body.scrollHeight;
        if (currentHeight === lastHeight) {
          unchangedCount++;
          if (unchangedCount >= 3) {
            clearInterval(interval);
            resolve();
          }
        } else {
          unchangedCount = 0;
        }
        lastHeight = currentHeight;
      }, 600);
    });
  }

  window.ExportChat.getCurrentChat = async function getCurrentChatGemini() {
    await autoScrollToBottom();
    const title = getFilename();
    const messages = extractMessages();
    return {
      platform: "gemini",
      title,
      messages,
      html: buildHtml(title, messages),
      text: buildText(title, messages),
      exportedAt: new Date().toISOString(),
    };
  };
})();

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
      .replace(/\n{2,}/g, "\n")
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

  /**
   * Extract messages using precise DOM selectors so we avoid sidebar/UI noise.
   */
  function extractMessages() {
    const container = findActiveConversationContainer();

    const userMessages = [...container.querySelectorAll("user-query")].map((el) => {
      // Use '.query-text p' to exclude the cdk-visually-hidden "You said" span
      // which lives outside .query-text, and to avoid the missing-first-word bug.
      const userText = [...el.querySelectorAll(".query-text p")]
        .map((p) => p.innerText.trim())
        .filter((t) => t.length > 0)
        .join(" ")
        .trim();
      return cleanMessageTextForTextOutput(userText);
    });
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
    // Preserve line structure (especially fenced code blocks).
    return String(text)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\d+:\d+\s*\/\s*\d+:\d+/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function extractGeminiResponseText(modelResponseEl) {
    if (!modelResponseEl) return "";

    // Clone first so live page DOM stays untouched.
    const clone = modelResponseEl.cloneNode(true);

    // Replace code-like blocks with fenced placeholders before innerText flattening.
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

    const flattened = clone.innerText || "";
    return cleanGeminiMessage(flattened);
  }

  function buildHtml(title, messages) {
    const safeTitle = escapeHtml(title || "Gemini-Chat");
    const parts = [`<h1>${safeTitle}</h1>`, '<div class="exportchat-conversation">'];
    messages.forEach((msg) => {
      const label = (msg.role === "user" || msg.role === "human") ? "User:" : "Gemini:";
      const cleaned = cleanMessageTextForTextOutput(msg.text);
      parts.push(`<p><strong>${label}</strong> ${escapeHtml(cleaned)}</p>`);
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

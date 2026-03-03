/**
 * ExportChat - Export AI chats to MD, PDF, TXT, HTML, JSON
 * Copyright (c) 2026 Ajit Khandekar (https://github.com/Ajit-Khandekar)
 * A Solvize project - https://solvize.co
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

  // Generic values Gemini always shows regardless of which chat is open.
  const GENERIC_TITLES = new Set(["google gemini", "gemini"]);

  function titleFromFirstUserMessage() {
    const firstQuery = document.querySelector("user-query");
    if (!firstQuery) return null;
    const textEl = firstQuery.querySelector(".query-text");
    const raw = (textEl || firstQuery).innerText?.trim() || "";
    if (!raw) return null;
    return raw
      .slice(0, 50)
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function getFilename() {
    const docTitle = document.title.trim();
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
    console.log("[ExportChat] active container:", container);
    return container;
  }

  /**
   * Extract messages using precise DOM selectors so we avoid "You said", "Gemini said",
   * "Show thinking", and media timestamps (they live in other nodes).
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
    const geminiMessages = [...container.querySelectorAll("model-response")].map((el) => {
      const geminiEl = el.querySelector("div.markdown.markdown-main-panel");
      // Apply timestamp cleanup at extraction time so all export paths are covered.
      const geminiText = geminiEl ? cleanMessageTextForTextOutput(geminiEl.innerText.trim()) : "";
      return geminiText;
    });
    const maxLen = Math.max(userMessages.length, geminiMessages.length);
    const messages = [];
    for (let i = 0; i < maxLen; i++) {
      if (userMessages[i]) messages.push({ role: "human", text: userMessages[i] });
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
    return String(text)
      // Remove media-style timestamps like "0:00 / 0:30"
      .replace(/\d+:\d+\s*\/\s*\d+:\d+/g, "")
      // Collapse multiple spaces left after removal
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function buildHtml(title, messages) {
    const safeTitle = escapeHtml(title || "Gemini-Chat");
    const parts = [`<h1>${safeTitle}</h1>`, '<div class="exportchat-conversation">'];
    messages.forEach((msg) => {
      const label = msg.role === "human" ? "User:" : "Gemini:";
      const cleaned = cleanMessageTextForTextOutput(msg.text);
      parts.push(`<p><strong>${label}</strong> ${escapeHtml(cleaned)}</p>`);
    });
    parts.push("</div>");
    return parts.join("");
  }

  function buildText(title, messages) {
    const lines = [(title || "Gemini-Chat").trim()];
    messages.forEach((msg, index) => {
      const label = msg.role === "human" ? "User:" : "Gemini:";
      const cleaned = cleanMessageTextForTextOutput(msg.text);
      // Blank line between each message for clearer separation
      lines.push("");
      lines.push(`${label} ${cleaned}`);
    });
    return lines.join("\n").trimEnd();
  }

  window.ExportChat.getCurrentChat = function getCurrentChatGemini() {
    const title = getFilename();
    const messages = extractMessages();
    return {
      platform: "gemini",
      title,
      html: buildHtml(title, messages),
      text: buildText(title, messages),
      exportedAt: new Date().toISOString(),
    };
  };
})();

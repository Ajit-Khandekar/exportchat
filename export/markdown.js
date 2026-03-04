/**
 * ExportChat - Export AI chats to MD, PDF, TXT, HTML, JSON
 * Copyright (c) 2026 Ajit Khandekar
 * https://github.com/Ajit-Khandekar/exportchat
 * Licensed under the MIT License
 */
// Markdown export for ExportChat using Turndown.js

(function initExportChatMarkdown() {
  window.ExportChat = window.ExportChat || {};

  function sanitizeFilename(name) {
    return (name || "chat")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "chat";
  }

  function downloadFile(filename, mimeType, content) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function getTurndownService() {
    if (typeof TurndownService === "function") {
      return new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
      });
    }
    console.warn("[ExportChat] TurndownService not available.");
    return null;
  }

  window.ExportChat.exportAsMarkdown = function exportAsMarkdown(chat) {
    if (!chat) {
      console.warn("[ExportChat] No chat content to export.");
      return;
    }

    const turndownService = getTurndownService();
    if (!turndownService) {
      return;
    }

    let markdownBody = "";

    if (chat.html) {
      markdownBody = turndownService.turndown(chat.html);
    } else if (chat.text) {
      markdownBody = chat.text;
    } else {
      console.warn("[ExportChat] No HTML or text content to export.");
      return;
    }

    const headerLines = [
      `# ${chat.title || "AI Chat"}`,
      "",
      `- **Platform**: ${chat.platform || "unknown"}`,
      `- **Exported At**: ${chat.exportedAt || new Date().toISOString()}`,
      "",
      "---",
      "",
    ];

    const filename = sanitizeFilename(chat.title || "chat") + ".md";
    downloadFile(
      filename,
      "text/markdown;charset=utf-8",
      headerLines.join("\n") + markdownBody + "\n\n---\n*Saved via ExportChat · exportchat.pages.dev*"
    );
  };
})();


/**
 * ExportChat - Export AI chats to MD, PDF, TXT, HTML, JSON
 * Copyright (c) 2026 Ajit Khandekar
 * https://github.com/Ajit-Khandekar/exportchat
 * Licensed under the MIT License
 */
// JSON export for ExportChat

(function initExportChatJSON() {
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

  window.ExportChat.exportAsJSON = function exportAsJSON(chat) {
    if (!chat) {
      console.warn("[ExportChat] No chat content to export.");
      return;
    }

    const payload = {
      title: chat.title || "AI Chat",
      platform: chat.platform || "unknown",
      exportedAt: chat.exportedAt || new Date().toISOString(),
      html: chat.html || null,
      text: chat.text || null,
      saved_via: "ExportChat \u00b7 exportchat.pages.dev",
    };

    const filename = sanitizeFilename(chat.title || "chat") + ".json";
    const content = JSON.stringify(payload, null, 2);
    downloadFile(filename, "application/json;charset=utf-8", content);
  };
})();


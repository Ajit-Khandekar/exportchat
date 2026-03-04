/**
 * ExportChat - Export AI chats to MD, PDF, TXT, HTML, JSON
 * Copyright (c) 2026 Ajit Khandekar (https://github.com/Ajit-Khandekar)
 * A Solvize project - https://solvize.co
 * Licensed under the MIT License
 */
// HTML export for ExportChat

(function initExportChatHTML() {
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

  window.ExportChat.exportAsHTML = function exportAsHTML(chat) {
    if (!chat || !chat.html) {
      console.warn("[ExportChat] No HTML content to export.");
      return;
    }

    const title = chat.title || "AI Chat";
    const fullHTML =
      "<!doctype html>" +
      '<html lang="en">' +
      "<head>" +
      '<meta charset="utf-8" />' +
      `<title>${title}</title>` +
      "</head>" +
      "<body>" +
      chat.html +
      '<footer style="text-align:center;padding:1rem;font-size:0.75rem;color:#999;">Saved via <a href="https://exportchat.pages.dev">ExportChat</a></footer>' +
      "</body></html>";

    const filename = sanitizeFilename(chat.title || "chat") + ".html";
    downloadFile(filename, "text/html;charset=utf-8", fullHTML);
  };
})();


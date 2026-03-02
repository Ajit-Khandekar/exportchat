// Plain text export for ExportChat

(function initExportChatText() {
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

  window.ExportChat.exportAsText = function exportAsText(chat) {
    if (!chat) {
      console.warn("[ExportChat] No chat content to export.");
      return;
    }

    let text = chat.text;

    if (!text && chat.html) {
      const tmp = document.createElement("div");
      tmp.innerHTML = chat.html;
      text = tmp.innerText || tmp.textContent || "";
    }

    if (!text) {
      console.warn("[ExportChat] No text content to export.");
      return;
    }

    const headerLines = [
      `Title: ${chat.title || "AI Chat"}`,
      `Platform: ${chat.platform || "unknown"}`,
      `Exported At: ${chat.exportedAt || new Date().toISOString()}`,
      "",
      "Conversation:",
      "",
    ];

    const filename = sanitizeFilename(chat.title || "chat") + ".txt";
    downloadFile(filename, "text/plain;charset=utf-8", headerLines.join("\n") + text);
  };
})();


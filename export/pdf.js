// PDF export for ExportChat using jsPDF

(function initExportChatPDF() {
  window.ExportChat = window.ExportChat || {};

  function sanitizeFilename(name) {
    return (name || "chat")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "chat";
  }

  function removeEmojis(text) {
    return text.replace(/[\u{1F300}-\u{1FFFF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}|\u{FE00}-\u{FE0F}|\u{1F900}-\u{1F9FF}|\u{1FA00}-\u{1FA6F}]/gu, '');
  }

  function createJsPDF() {
    // jsPDF UMD build exposes window.jspdf.jsPDF
    if (window.jspdf && typeof window.jspdf.jsPDF === "function") {
      const { jsPDF } = window.jspdf;
      return new jsPDF({ unit: "pt", format: "a4" });
    }

    // Fallback for non-UMD builds (if present)
    if (typeof window.jsPDF === "function") {
      return new window.jsPDF({ unit: "pt", format: "a4" });
    }

    console.warn("[ExportChat] jsPDF not available.");
    return null;
  }

  window.ExportChat.exportAsPDF = function exportAsPDF(chat) {
    if (!chat) {
      console.warn("[ExportChat] No chat content to export.");
      return;
    }

    const doc = createJsPDF();
    if (!doc) {
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

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 40;
    const maxWidth = pageWidth - margin * 2;
    let cursorY = margin;

    const title = removeEmojis(chat.title || "AI Chat");
    const metadataLines = [
      removeEmojis(`Platform: ${chat.platform || "unknown"}`),
      removeEmojis(`Exported At: ${chat.exportedAt || new Date().toISOString()}`),
      "",
    ];

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    const titleLines = doc.splitTextToSize(title, maxWidth);
    doc.text(titleLines, margin, cursorY);
    cursorY += titleLines.length * 20 + 10;

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    const metaWrapped = doc.splitTextToSize(metadataLines.join("\n"), maxWidth);
    doc.text(metaWrapped, margin, cursorY);
    cursorY += metaWrapped.length * 14 + 10;

    doc.setFontSize(11);
    const cleanedText = removeEmojis(text);
    const contentLines = doc.splitTextToSize(cleanedText, maxWidth);

    const lineHeight = 14;
    contentLines.forEach((line) => {
      if (cursorY + lineHeight > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
      doc.text(line, margin, cursorY);
      cursorY += lineHeight;
    });

    const filename = sanitizeFilename(title) + ".pdf";
    doc.save(filename);
  };
})();


(function() {

  function sanitizeForPDF(text) {
    if (!text) return '';
    text = text.replace(/[\u{1F000}-\u{1FFFF}]/gu, '');
    text = text.replace(/[\u{2600}-\u{27BF}]/gu, '');
    text = text.replace(/[\u{1D400}-\u{1D7FF}]/gu, '');
    text = text.replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
    text = text.replace(/,\s*,/g, '');
    text = text.replace(/\s{2,}/g, ' ');
    return text.trim();
  }

  function sanitizeFilename(name) {
    return (name || 'chat')
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) || 'chat';
  }

  function exportAsPDF(chat) {
    if (!chat) {
      console.warn('[ExportChat] No chat content to export.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const margin = 15;
    const pageWidth = doc.internal.pageSize.width;
    const maxWidth = pageWidth - (margin * 2);
    let y = 20;

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(sanitizeForPDF(chat.title || 'Exported Chat'), margin, y);
    y += 8;

    // Metadata
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(130, 130, 130);
    doc.text(
      'Platform: ' + (chat.platform || '') +
      '   |   Exported: ' +
      (chat.exportedAt || new Date().toISOString()),
      margin, y
    );
    y += 5;

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Content from text field
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    var rawText = chat.text || '';
    // Split BEFORE sanitizing — sanitizeForPDF collapses \s{2,} which includes \n,
    // so splitting afterward would find nothing to split on.
    var paragraphs = rawText.split('\n').map(function(p) { return sanitizeForPDF(p); });

    // Do not repeat the title in the body content
    var titleLine = sanitizeForPDF(chat.title || 'Exported Chat');
    paragraphs = paragraphs.filter(function(para, idx) {
      var trimmed = para.trim();
      if (!trimmed) return false;
      if (idx === 0 && trimmed === titleLine) return false;
      return true;
    });

    paragraphs.forEach(function(para) {
      para = para.trim();
      if (!para) {
        y += 4;
        return;
      }

      if (y > 265) { doc.addPage(); y = 20; }

      // Require a space after the colon so only exact role labels are bolded
      // (e.g. "User: hello" matches, but "Lyrics:" or bare "User:" do not).
      var isRoleLabel = /^(User|Gemini|Claude|ChatGPT|Perplexity):\s/.test(para);

      if (isRoleLabel) {
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setFont('helvetica', 'normal');
      }

      // Wrap long lines so nothing overflows the page width.
      var wrappedLines = doc.splitTextToSize(para, maxWidth);
      wrappedLines.forEach(function(line) {
        if (y > 265) { doc.addPage(); y = 20; }
        doc.text(line, margin, y);
        y += 5;
      });

      // Always reset to normal after rendering a role label block.
      if (isRoleLabel) {
        doc.setFont('helvetica', 'normal');
      }

      y += 3;
    });

    var filename = sanitizeFilename(chat.title || 'ExportChat');
    doc.save(filename + '.pdf');
  }

  window.ExportChat = window.ExportChat || {};
  window.ExportChat.exportAsPDF = exportAsPDF;

})();

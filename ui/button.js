/**
 * ExportChat - Export AI chats to MD, PDF, TXT, HTML, JSON
 * Copyright (c) 2026 Ajit Khandekar
 * https://github.com/Ajit-Khandekar/exportchat
 * Licensed under the MIT License
 */
(function initExportChatButton() {
  if (window.ExportChat && window.ExportChat.uiInitialized) {
    return;
  }

  window.ExportChat = window.ExportChat || {};
  window.ExportChat.uiInitialized = true;

  function ensureAPIsAvailable() {
    return (
      window.ExportChat &&
      typeof window.ExportChat.getCurrentChat === "function" &&
      typeof window.ExportChat.exportAsMarkdown === "function" &&
      typeof window.ExportChat.exportAsPDF === "function" &&
      typeof window.ExportChat.exportAsText === "function" &&
      typeof window.ExportChat.exportAsHTML === "function" &&
      typeof window.ExportChat.exportAsJSON === "function"
    );
  }

  function createButtonUI() {
    if (document.getElementById("exportchat-floating-root")) {
      return;
    }

    const container = document.createElement("div");
    container.id = "exportchat-floating-root";
    container.className = "exportchat-floating-container";

    const scrollBtn = document.createElement("button");
    scrollBtn.type = "button";
    scrollBtn.className = "exportchat-scroll-btn";
    scrollBtn.title = "Scroll to top of chat";
    scrollBtn.setAttribute("aria-label", "Scroll to top of chat");
    scrollBtn.innerHTML = "&#8593;";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "exportchat-btn";
    button.setAttribute("aria-haspopup", "true");
    button.setAttribute("aria-expanded", "false");

    const img = document.createElement("img");
    img.src = chrome.runtime.getURL("icons/icon48.png");
    img.width = 32;
    img.height = 32;
    img.alt = "";
    img.style.cssText = "width:40px;height:40px;display:block;pointer-events:none;";

    button.appendChild(img);

    const dropdown = document.createElement("div");
    dropdown.className = "exportchat-dropdown hidden";
    dropdown.setAttribute("role", "menu");

    const options = [
      { id: "markdown", label: "Markdown (.md)" },
      { id: "pdf", label: "PDF (.pdf)" },
      { id: "text", label: "Plain Text (.txt)" },
      { id: "html", label: "HTML (.html)" },
      { id: "json", label: "JSON (.json)" },
    ];

    options.forEach((opt) => {
      const item = document.createElement("div");
      item.className = "exportchat-option";
      item.setAttribute("role", "menuitem");
      item.dataset.format = opt.id;
      item.textContent = opt.label;
      dropdown.appendChild(item);
    });

    const tooltip = document.createElement("div");
    tooltip.className = "exportchat-tooltip";
    tooltip.textContent = "Export this chat";

    const progressBanner = document.createElement("div");
    progressBanner.className = "exportchat-progress-banner hidden";
    progressBanner.innerHTML = `
      <div class="exportchat-progress-spinner"></div>
      <div class="exportchat-progress-text">Caching conversation... <span class="exportchat-count">0</span> messages</div>
    `;

    container.appendChild(scrollBtn);
    container.appendChild(button);
    container.appendChild(dropdown);
    container.appendChild(progressBanner);
    container.appendChild(tooltip);
    document.documentElement.appendChild(container);

    function updateProgressUI({ count, isComplete, statusText }) {
      const countEl = progressBanner.querySelector(".exportchat-count");
      const textEl = progressBanner.querySelector(".exportchat-progress-text");
      const spinner = progressBanner.querySelector(".exportchat-progress-spinner");

      if (statusText) {
        textEl.textContent = statusText;
      } else if (count !== undefined && countEl) {
        countEl.textContent = String(count);
      }

      if (isComplete) {
        if (spinner) spinner.style.display = "none";
        textEl.textContent = `✅ ${count || 0} messages captured`;
        setTimeout(() => {
          progressBanner.classList.add("hidden");
          if (spinner) spinner.style.display = "";
        }, 3000);
      } else {
        progressBanner.classList.remove("hidden");
      }
    }

    window.ExportChat.updateProgress = updateProgressUI;

    scrollBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      closeDropdown();
      tooltip.textContent = "Scrolling to top...";
      tooltip.classList.add("visible");
      scrollBtn.style.pointerEvents = "none";
      try {
        if (window.ExportChat && typeof window.ExportChat.scrollChatToTop === "function") {
          await window.ExportChat.scrollChatToTop();
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch (e) {
        console.error("[ExportChat] Scroll to top failed:", e);
      } finally {
        tooltip.textContent = "Scroll to top of chat";
        tooltip.classList.remove("visible");
        scrollBtn.style.pointerEvents = "";
      }
    });

    scrollBtn.addEventListener("mouseenter", () => {
      if (dropdown.classList.contains("hidden")) {
        tooltip.textContent = "Scroll to top of chat";
        tooltip.classList.add("visible");
      }
    });

    scrollBtn.addEventListener("mouseleave", () => {
      tooltip.textContent = "Export this chat";
      tooltip.classList.remove("visible");
    });

    function closeDropdown() {
      dropdown.classList.add("hidden");
      button.setAttribute("aria-expanded", "false");
      tooltip.classList.remove("visible");
    }

    function toggleDropdown() {
      const isHidden = dropdown.classList.contains("hidden");
      if (isHidden) {
        dropdown.classList.remove("hidden");
        button.setAttribute("aria-expanded", "true");
      } else {
        closeDropdown();
      }
    }

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleDropdown();
    });

    button.addEventListener("mouseenter", () => {
      if (dropdown.classList.contains("hidden")) {
        tooltip.textContent = "Export this chat";
        tooltip.classList.add("visible");
      }
    });

    button.addEventListener("mouseleave", () => {
      tooltip.classList.remove("visible");
    });

    dropdown.addEventListener("click", (event) => {
      event.stopPropagation();
      const target = event.target;
      if (!(target instanceof Element)) return;
      const format = target.dataset.format;
      if (!format || !ensureAPIsAvailable()) {
        closeDropdown();
        return;
      }

      button.classList.add("exportchat-loading");
      progressBanner.classList.remove("hidden");
      updateProgressUI({ count: 0, statusText: "Caching conversation... 0 messages" });
      closeDropdown();

      window.ExportChat.getCurrentChat(function(progress) {
        updateProgressUI(progress);
      })
        .then(function(chat) {
          if (!chat) return;
          try {
            switch (format) {
              case "markdown":
                window.ExportChat.exportAsMarkdown(chat);
                break;
              case "pdf":
                window.ExportChat.exportAsPDF(chat);
                break;
              case "text":
                window.ExportChat.exportAsText(chat);
                break;
              case "html":
                window.ExportChat.exportAsHTML(chat);
                break;
              case "json":
                window.ExportChat.exportAsJSON(chat);
                break;
            }
          } catch (e) {
            console.error("[ExportChat] Export failed:", e);
          }
          updateProgressUI({ count: (chat.messages || []).length, isComplete: true });
        })
        .catch(function(e) {
          console.error("[ExportChat] getCurrentChat failed:", e);
          updateProgressUI({ statusText: "❌ Export failed", isComplete: true });
        })
        .finally(function() {
          button.classList.remove("exportchat-loading");
          tooltip.textContent = "Export this chat";
          tooltip.classList.remove("visible");
        });
      return;
    });

    document.addEventListener(
      "click",
      () => {
        closeDropdown();
      },
      true
    );

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeDropdown();
      }
    });
  }

  function bootstrapWhenReady() {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      createButtonUI();
    } else {
      document.addEventListener("DOMContentLoaded", createButtonUI, {
        once: true,
      });
    }
  }

  bootstrapWhenReady();
})();


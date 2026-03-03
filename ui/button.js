/**
 * ExportChat - Export AI chats to MD, PDF, TXT, HTML, JSON
 * Copyright (c) 2026 Ajit Khandekar (https://github.com/Ajit-Khandekar)
 * A Solvize project - https://solvize.co
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

    const button = document.createElement("button");
    button.type = "button";
    button.className = "exportchat-button";
    button.setAttribute("aria-haspopup", "true");
    button.setAttribute("aria-expanded", "false");

    const icon = document.createElement("span");
    icon.className = "exportchat-button-icon";
    icon.textContent = "↓";

    const label = document.createElement("span");
    label.className = "exportchat-button-label";
    label.textContent = "ExportChat";

    button.appendChild(icon);
    button.appendChild(label);

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

    container.appendChild(button);
    container.appendChild(dropdown);
    container.appendChild(tooltip);
    document.documentElement.appendChild(container);

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

      const chat = window.ExportChat.getCurrentChat();
      if (!chat) {
        closeDropdown();
        return;
      }

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

      closeDropdown();
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


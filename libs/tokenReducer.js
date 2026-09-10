/**
 * ExportChat - Token Reduction Engine
 * Lightweight, regex-based message compressor written from scratch.
 * Shields code blocks/inline code while stripping conversational filler and verbosity.
 */

(function initExportChatTokenReducer() {
  window.ExportChat = window.ExportChat || {};

  const FILLER_OPENERS = [
    /^(?:certainly|sure(?: thing)?|of course|absolutely|right)[!,.]?\s*/i,
    /^(?:great|good|excellent|perfect|wonderful|fantastic|awesome|nice)(?: question| point| call| idea)?[!,.]?\s*/i,
    /^(?:no problem|happy to help|glad (?:you asked|to assist)|my pleasure)[!,.]?\s*/i,
    /^I'?d be (?:happy|glad|delighted) to (?:help|assist)[^.]{0,60}[.!]?\s*/i,
    /^I('ll| will) (?:help|assist) (?:you )?(?:with that|now|right away)[^.]{0,40}[.!]?\s*/i,
    /^(?:as an? (?:ai|language model|assistant|llm)|as claude|as chatgpt)[^.]{0,80}[.!]?\s*/i,
  ];

  const FILLER_CLOSERS = [
    /let me know if (?:you (?:have|need|want)|there'?s anything|you'?d like)[^.!?]{0,80}[.!?]?\s*$/i,
    /feel free to (?:ask|reach out)[^.!?]{0,60}[.!?]?\s*$/i,
    /don'?t hesitate to (?:ask|reach out|contact)[^.!?]{0,60}[.!?]?\s*$/i,
    /if you (?:have|need) (?:any )?(?:more |further |additional )?(?:questions?|help|assistance|clarification)[^.!?]{0,80}[.!?]?\s*$/i,
    /I hope (?:this|that) (?:helps?|is helpful|clarifies|answers)[^.!?]{0,60}[.!?]?\s*$/i,
    /(?:this should|that should) (?:help|get you started|do it|work)[^.!?]{0,60}[.!?]?\s*$/i,
    /is there (?:anything|something) (?:else )?(?:I can|I could|you'?d like)[^?]{0,60}\?\s*$/i,
    /would you like (?:me to|to)[^?]{0,80}\?\s*$/i,
    /please (?:let me know|don'?t hesitate)[^.!?]{0,60}[.!?]?\s*$/i,
    /happy to (?:help|assist|answer)[^.]{0,60}[.!]?\s*$/i,
  ];

  const PHRASE_REPLACEMENTS = [
    [/\bin order to\b/gi, 'to'],
    [/\bdue to the fact that\b/gi, 'because'],
    [/\bat this point in time\b/gi, 'now'],
    [/\bprior to\b/gi, 'before'],
    [/\bsubsequent to\b/gi, 'after'],
    [/\bin the near future\b/gi, 'soon'],
    [/\bwith regard to\b/gi, 'about'],
    [/\bwith the exception of\b/gi, 'except'],
    [/\bdespite the fact that\b/gi, 'although'],
    [/\bby means of\b/gi, 'using'],
    [/\bfor the purpose of\b/gi, 'to'],
    [/\bthe reason why is that\b/gi, 'because'],
    [/\bin the case of\b/gi, 'if'],
    [/\ba large number of\b/gi, 'many'],
    [/\bthe vast majority of\b/gi, 'most'],
    [/\bmake use of\b/gi, 'use'],
    [/\btake into account\b/gi, 'consider'],
    [/\bprovide an explanation of\b/gi, 'explain'],
    [/\bprovide an example of\b/gi, 'show'],
    [/\bis able to\b/gi, 'can'],
    [/\bfor example[,]?\s*/gi, 'e.g. '],
    [/\bfor instance[,]?\s*/gi, 'e.g. '],
    [/\bsuch as\b/gi, 'like'],
    [/\bin addition (?:to this|to that)?\s*/gi, 'also '],
    [/\bon the other hand[,]?\s*/gi, 'but '],
    [/\bat the same time[,]?\s*/gi, 'also '],
    [/\bas well as\b/gi, 'and']
  ];

  function compressMessageText(text, role) {
    if (!text || typeof text !== 'string' || text.length < 8) return text;

    const vault = new Map();
    let vaultIndex = 0;

    function protect(match) {
      const key = `\x00P${vaultIndex++}\x00`;
      vault.set(key, match);
      return key;
    }

    let cleaned = text;
    // Vault block code
    cleaned = cleaned.replace(/```[\s\S]*?```/g, protect);
    // Vault inline code
    cleaned = cleaned.replace(/`[^`\n]+`/g, protect);

    // Apply phrase simplifications
    for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
      cleaned = cleaned.replace(pattern, replacement);
    }

    // Whitespace cleanup
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    cleaned = cleaned.replace(/\r\n/g, '\n');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.trim();

    // Strip filler for AI assistant turns
    if (role === 'assistant') {
      // Strip openings
      let openerFound = true;
      while (openerFound) {
        openerFound = false;
        for (const rx of FILLER_OPENERS) {
          const next = cleaned.replace(rx, '');
          if (next !== cleaned) {
            cleaned = next.trimStart();
            openerFound = true;
            break;
          }
        }
      }

      // Strip closings
      let closerFound = true;
      while (closerFound) {
        closerFound = false;
        for (const rx of FILLER_CLOSERS) {
          const next = cleaned.replace(rx, '');
          if (next !== cleaned) {
            cleaned = next.trimEnd();
            closerFound = true;
            break;
          }
        }
      }
    }

    // Restore shielded elements
    for (const [key, original] of vault.entries()) {
      cleaned = cleaned.split(key).join(original);
    }

    return cleaned;
  }

  window.ExportChat.compressMessageText = compressMessageText;
})();

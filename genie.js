/*!
 * Legit — "Ask Legit" genie (pre-auth, advise-only).
 * ---------------------------------------------------------------------------
 * A docked conversational helper for getlegit.com. It can QUOTE, CHECK NAMES,
 * COMPARE, and EXPLAIN — and then HAND OFF to the human-authorized formation
 * flow. It CANNOT form an entity, move money, capture PII, or do anything
 * irreversible. That boundary is the product: "An AI helped you decide; a
 * verified human signs; the system files."
 *
 * Works two ways:
 *   1. Standalone (default) — a deterministic client-side brain (the tools +
 *      a content corpus) so it's genuinely useful on static hosting, with no
 *      backend and no key in the browser.
 *   2. Upgraded — if window.LEGIT_GENIE_ENDPOINT is set, free-text turns POST
 *      there (the /genie backend: a fast model + the same read/quote-only
 *      tools) for real conversation. The seeded chips stay deterministic.
 *
 * Feature flag: set window.LEGIT_GENIE_DISABLED = true to suppress entirely.
 * Drop-in: <script src="genie.js" defer></script>  (use ../genie.js in landers)
 */
(function () {
  "use strict";
  if (window.__legitGenie || window.LEGIT_GENIE_DISABLED) return;
  window.__legitGenie = true;

  // ── canonical facts (single source of truth; mirror of mcp/src/genieTools.ts)
  var FACTS = {
    price: { free: 0, builder: 49, standalone: 299 },
    master: { formation: 90, franchise: 300 }, // Legit carries these on the master series
    homeBase: "", // optional prefix for cross-page links (landers set window.LEGIT_HOME = "../")
  };
  var HOME = (typeof window.LEGIT_HOME === "string" ? window.LEGIT_HOME : "");
  var ACCESS = HOME + "#access";

  // ── tiny helpers ───────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function usd(n) { return "$" + Number(n).toLocaleString("en-US"); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  // Only allow safe, mostly-internal link targets. Anything odd (javascript:,
  // data:, vbscript:, or a backend-supplied off-pattern URL) collapses to ACCESS.
  function safeHref(u) {
    u = String(u == null ? "" : u).trim();
    if (/^(javascript|data|vbscript):/i.test(u)) return ACCESS;
    return /^(https?:\/\/|\/|#|\.\.?\/)/i.test(u) ? u : ACCESS;
  }

  // ── the read/quote-only tools (deterministic; no PII, no side effects) ──────
  var TOOLS = {
    // Echo a candidate name back with EIN-safety + honest uniqueness candor.
    check_name: function (raw) {
      var s = String(raw || "").trim();
      var name;
      var quoted = s.match(/["“]([^"”]{2,})["”]/);
      var after = s.match(/\b(?:call(?:ed)? it|name(?:d| it)?|the name|company name|business name|called|named)\s+(.+)$/i);
      if (quoted) name = quoted[1];
      else if (after) name = after[1];
      else name = s.replace(/^(my )?(company|business|it|entity|llc)\s*(is|will be|called|named)?\s*/i, "");
      name = name.replace(/["“”']/g, "").replace(/[?.!]+$/, "").replace(/\s+/g, " ").trim();
      if (!name || !/[A-Za-z]/.test(name) || /^(of|the|a|an|my|your|his|her|their|buy|sell|employee|to|for|in|on|it|this|that|do|does|can|i)\b/i.test(name))
        return { ok: false, ask: "What would you like the company called? (e.g. “Orion Labs”)" };
      var flags = [];
      var hasBad = /[^A-Za-z0-9 ,.&'\-]/.test(name);
      if (hasBad) flags.push("Some characters (emoji, symbols) don't survive state filings or EIN systems — plain letters, numbers, & . , - ' are safest.");
      if (name.length > 120) flags.push("That's long — most states cap the name length.");
      var hasSuffix = /\b(llc|l\.l\.c\.|inc\.?|corp\.?|co\.?|ltd\.?|company)\b/i.test(name);
      var suggested = hasSuffix ? name : name + " LLC";
      return {
        ok: true, name: name, suggested: suggested, ein_safe: !hasBad, flags: flags,
        candor: "Inside Legit your protected series can carry this name distinctly — but a free protected series is off the public state record, so this is NOT a state-registry or trademark clearance. Need state-registry uniqueness or a registered mark? That's the Standalone tier plus a trademark search.",
      };
    },
    // One fixed, all-in answer per path. No hidden fees.
    get_quote: function () {
      return {
        free: { price: FACTS.price.free, label: "Free", per: "forever", line: "A real, verifiable Delaware protected series — " + usd(0) + " state fee, " + usd(0) + " to you.", includes: ["Entity formation (protected series)", "Verified human at the root", "Verifiable certificate of formation", "Public standing checks"] },
        builder: { price: FACTS.price.builder, label: "Builder", per: "/yr (~$4/mo)", line: "EIN + unlimited entities under one identity.", includes: ["EIN procurement", "Unlimited entities", "Registered agent included", "Priority verification"] },
        standalone: { price: FACTS.price.standalone, label: "Standalone", per: "/yr + state fee", line: "A dedicated, bankable, financeable entity.", includes: ["LLC, C-Corp, or registered series", "Certificate of good standing", "Bookkeeping / tax / S-corp add-ons", "Trademark filing"] },
        candor: "No per-formation surprise: Legit carries the master Series LLC (~" + usd(FACTS.master.formation) + " formation + " + usd(FACTS.master.franchise) + "/yr Delaware franchise) so your protected series is genuinely free. A Standalone adds the real state filing fee for that entity (varies by state/type).",
      };
    },
    // Free protected series vs paid Standalone — the honest side-by-side.
    compare: function () {
      return {
        rows: [
          ["Price", "Free ($0 state fee)", usd(FACTS.price.standalone) + "/yr + state"],
          ["Best for", "Agents, side-projects, \"I just need a real entity\"", "Raising, banking, contracts, good-standing proof"],
          ["On the public state record", "No (shielded by the master)", "Yes (its own filing)"],
          ["Standalone bank account / loans", "Often limited — banks may want a registered entity", "Yes — bankable & financeable"],
          ["Certificate of good standing", "Verifiable Legit certificate", "State certificate of good standing"],
          ["Verified human at root + Web Pass", "Yes", "Yes"],
          ["Upgrade path", "One click → registered series (same name, same history, same EIN)", "—"],
        ],
        candor: "Start free; upgrade only when a bank, investor, or contract actually asks for a registered entity. Most agents and early projects never need to.",
      };
    },
    // Branching eligibility — NEVER captures the SSN/ITIN itself.
    ein_eligibility: function (ctx) {
      return {
        domestic: "Have a U.S. SSN or ITIN? EIN is fast — often same-day online once the entity exists. (We never ask you to type the number into chat.)",
        international: "No SSN and not in the U.S.? You're still eligible. The IRS issues EINs to non-U.S. founders via Form SS-4 — no SSN required — it just takes longer (days to a few weeks) since it's not the instant online path.",
        note: "EIN procurement is on the Builder tier (" + usd(FACTS.price.builder) + "/yr). It's a human-authorized step — nothing is filed with the IRS until you approve it.",
      };
    },
    // Where you FORM ≠ where you owe / must register.
    nexus_explainer: function () {
      return {
        body: "Forming in Delaware doesn't change where you actually do business. If you live or operate in another state, you may need to register (\"foreign-qualify\") and pay tax there — nexus follows where you operate, not where you file. Delaware is popular for its predictable law and privacy, not as a tax dodge.",
        candor: "If you're a solo founder operating in one state with no investors, your home state is often simpler and cheaper than Delaware. We'll say so.",
      };
    },
    ca_franchise_tax: function () {
      return {
        headline: "California's $800 franchise tax can still apply",
        body: "If you operate from California, the Franchise Tax Board can charge its $800/yr minimum franchise tax on an entity it considers to be doing business in California — and it treats an entity managed by a California resident as doing business even if it never transacts. It's per entity, and the first-year grace period has expired.",
        not_fee: "That's a tax you'd owe California directly — not a Legit fee. A free protected series doesn't avoid it if you run it from CA.",
        candor: "We'd rather flag it than let it surprise you. Whether it hits your exact setup is fact-specific — check with a CA tax pro. Not tax advice.",
      };
    },
  };

  // ── content corpus → intent router (offline brain) ──────────────────────────
  // Each handler returns { html, cta?, handoff?, disclaimer? }.
  function rIntro() {
    return {
      html: "I'm the pre-auth helper. I can <b>quote</b>, <b>check a name</b>, <b>compare</b> plans, and explain how forming works — then hand you to the real flow where <b>you</b> sign off. I can't form anything myself; that's the point.<br><br>Pick a question below, or just ask.",
    };
  }
  function rQuote() {
    var q = TOOLS.get_quote();
    var tiers = [q.free, q.builder, q.standalone].map(function (t) {
      return '<div class="lg-tier"><div class="lg-tier-h"><b>' + esc(t.label) + "</b><span>" + (t.price === 0 ? "$0" : usd(t.price)) + " <i>" + esc(t.per) + "</i></span></div><p>" + esc(t.line) + "</p></div>";
    }).join("");
    return {
      html: "<b>All in, no surprises:</b>" + tiers + '<p class="lg-candor">' + esc(q.candor) + "</p>" + '<p class="lg-candor">📍 <b>California:</b> the $800/yr state franchise tax may apply even to a non-transacting entity — a state tax, not a Legit fee.</p>',
      cta: { label: "Start free →", href: ACCESS },
    };
  }
  function rCompare() {
    var c = TOOLS.compare();
    var rows = c.rows.map(function (r) {
      return "<tr><th>" + esc(r[0]) + "</th><td>" + esc(r[1]) + "</td><td>" + esc(r[2]) + "</td></tr>";
    }).join("");
    return {
      html: "<b>Free protected series vs. Standalone:</b><div class=\"lg-tablewrap\"><table class=\"lg-table\"><thead><tr><th></th><th>Free</th><th>Standalone</th></tr></thead><tbody>" + rows + "</tbody></table></div><p class=\"lg-candor\">" + esc(c.candor) + "</p>",
      cta: { label: "Start with Free →", href: ACCESS },
      disclaimer: true,
    };
  }
  function rEin() {
    var e = TOOLS.ein_eligibility();
    return {
      html: "<b>Can you get an EIN?</b><br>• " + esc(e.domestic) + "<br>• " + esc(e.international) + '<br><p class="lg-candor">' + esc(e.note) + "</p>",
      cta: { label: "Get early access →", href: ACCESS },
      disclaimer: true,
    };
  }
  function rNeedLLC() {
    return {
      html: "Honest answer: <b>maybe not yet.</b> If you're not earning, signing contracts, or taking on liability, you may not need one — and if you do, a <b>free protected series</b> is usually enough to start. Form a Standalone when a bank, client, or investor actually asks for a registered entity.",
      cta: { label: "Form a free entity →", href: ACCESS },
      disclaimer: true,
    };
  }
  function rAgent() {
    return {
      html: "Yes — that's the core use. Your agent gets <b>a verified human at its root</b>, a <b>real LLC to operate as</b>, and an <b>accountable Web Pass</b> (RFC 9421 / Web Bot Auth) so it's recognized, not blocked. It can read and prepare on its own via our API or MCP — but anything irreversible (forming, paying, revoking) pauses for <b>you</b> to authorize. It can't self-approve.",
      cta: { label: "Legit for AI Agents →", href: HOME + "for-agents/" },
    };
  }
  function rWebpass() {
    return {
      html: "Getting 403'd or CAPTCHA'd? The <b>Web Pass</b> signs your agent's requests (Ed25519, RFC 9421 HTTP Message Signatures) and publishes the key in a directory platforms can check — so you're an accountable, recognized actor instead of an anonymous bot.<br><br>Honest caveat: it's <b>standing, not a guarantee</b> — each platform decides whether to honor it.",
      cta: { label: "How it works →", href: HOME + "for-agents/" },
    };
  }
  function rJurisdiction() {
    var n = TOOLS.nexus_explainer();
    return {
      html: "<b>Why Delaware series?</b> A protected series inside our master Series LLC costs <b>$0</b> in state fees and is off the public record — distinctly named, formed in minutes.<br><br>" + esc(n.body) + '<p class="lg-candor">' + esc(n.candor) + "</p>" + '<p class="lg-candor">📍 <b>California</b> is the big exception: its tax board treats an entity managed by a CA resident as doing business and bills $800/yr even with zero activity — per entity.</p>',
      cta: { label: "Start free →", href: ACCESS },
      disclaimer: true,
    };
  }
  function rCA() {
    var c = TOOLS.ca_franchise_tax();
    return {
      html: "<b>" + esc(c.headline) + "</b><br>" + esc(c.body) + "<br><br>" + esc(c.not_fee) + '<p class="lg-candor">' + esc(c.candor) + "</p>",
      cta: { label: "Start free anyway →", href: ACCESS },
      disclaimer: true,
    };
  }

  function rHuman() {
    return {
      html: "Nothing irreversible happens without a verified human. Tools that <b>read or prepare</b> run on their own; anything that <b>forms an entity, moves money, or revokes</b> returns a short-lived link for a human to authorize — then it executes. The chat is never the authorization.<br><br>That's the line that makes a Legit company <b>accountable</b>, and what gets agents unblocked on the open web.",
      cta: { label: "See the trust model →", href: HOME + "#how" },
    };
  }
  function rPrivacy() {
    return {
      html: "<b>Shielded, not hidden.</b> Your name isn't on the public record — but every entity traces to a KYC-verified human, disclosed <b>only on valid legal process</b> (routed through legal review, never returned through the API). Good actors get privacy; fraud loses recognition.",
      cta: { label: "Start free →", href: ACCESS },
    };
  }
  function rBanking() {
    return {
      html: "We don't custody money — and that's deliberate. <b>Form anywhere, bank anywhere.</b> A free protected series may have limited standalone banking; for a fully bankable account, upgrade to a <b>Standalone</b> (or one-click handoff to a banking partner). We never lock your money inside us.",
      cta: { label: "Compare plans →", href: HOME + "#products" },
    };
  }
  function rTrademark() {
    return {
      html: "Trademark search + application prep is on the <b>Standalone</b> tier — from name to filed mark. Note: a company name isn't a trademark, and a free protected series isn't a registry clearance. If the brand matters, do the search.",
      cta: { label: "See Standalone →", href: HOME + "#products" },
      disclaimer: true,
    };
  }
  function rName(input) {
    var r = TOOLS.check_name(input);
    if (!r.ok) return { html: esc(r.ask) };
    var flags = r.flags.length ? '<p class="lg-candor">⚠ ' + r.flags.map(esc).join("<br>⚠ ") + "</p>" : "";
    var suff = r.suggested !== r.name ? "<br>I'd file it as <b>" + esc(r.suggested) + "</b>." : "";
    return {
      // No CTA here: a name check never reserves/forms. The hand-off card below
      // supplies the single, correctly-framed "Continue — you sign off →" button.
      html: "<b>" + esc(r.name) + "</b> — " + (r.ein_safe ? "looks EIN-safe ✓" : "needs a tweak") + "." + suff + flags + '<p class="lg-candor">' + esc(r.candor) + "</p>",
      handoff: true,
      handoffName: r.suggested,
      disclaimer: true,
    };
  }
  function rHandoff(name) {
    return { handoffCard: true, handoffName: name };
  }
  function rFallback() {
    return {
      html: "I can help with: <b>cost</b>, <b>Free vs Standalone</b>, <b>EIN / no SSN</b>, <b>do I need an LLC</b>, <b>agents &amp; Web Pass</b>, <b>privacy</b>, or <b>checking a name</b>. Ask away — or tap a chip.",
    };
  }

  // intent matching: order matters (specific → general)
  var INTENTS = [
    { re: /\b(california|californian|\$?\s?800|franchise tax|\bftb\b)\b/i, fn: rCA },
    { re: /\b(instant|protected|free)\b.*\b(vs|or|versus)\b|\b(vs|versus)\b.*\bstandalone\b|\bcompar|which (one|fits|plan|should)|registered (series|vs)/i, fn: rCompare },
    { re: /\b(ssn|itin|international|non[- ]?u\.?s|foreign|outside the (us|u\.s)|ein)\b/i, fn: rEin },
    { re: /\b(do i (even )?need|need an llc|necessary|too early|worth it)\b/i, fn: rNeedLLC },
    { re: /\b(agent|a\.?i\.?|autonomous|bot|mcp|robot)\b/i, fn: rAgent },
    { re: /\b(web ?pass|web bot auth|rfc ?9421|403|captcha|blocked|recognized)\b/i, fn: rWebpass },
    { re: /\b(delaware|series|jurisdiction|which state|why de\b|nexus)\b/i, fn: rJurisdiction },
    { re: /\b(human|who signs|authoriz|safe|gate|approve)\b/i, fn: rHuman },
    { re: /\b(privacy|private|anonymous|public record|hidden|disclos)\b/i, fn: rPrivacy },
    { re: /\b(bank|banking|account|loan|financ)\b/i, fn: rBanking },
    { re: /\b(trademark|brand|mark|uspto)\b/i, fn: rTrademark },
    { re: /\b(cost|price|pricing|how much|fee|cheap|expensive|\$)\b/i, fn: rQuote },
    { re: /\b(start|form|create|sign ?up|get (started|going)|begin|go ahead|let'?s do|i'?m ready)\b/i, fn: function () { return rHandoff(null); } },
    { re: /\b(hi|hey|hello|help|what can you|who are you)\b/i, fn: rIntro },
    // a name-check only on an explicit naming verb next to a candidate, or a quoted phrase
    { re: /\b(?:call(?:ed)? it|name it|company (?:is )?(?:named|called)|the name is|company name is)\s+\S|["“][^"”]{2,}["”]/i, fn: function (q) { return rName(q); } },
  ];

  var SEEDS = [
    { label: "Free or Standalone — which fits me?", fn: rCompare },
    { label: "No SSN / I'm international — can I?", fn: rEin },
    { label: "Do I even need an LLC yet?", fn: rNeedLLC },
    { label: "What does it cost, all in?", fn: rQuote },
    { label: "Can my AI agent form & run this?", fn: rAgent },
    { label: "I'm in California — what's the catch?", fn: rCA },
  ];

  function route(q) {
    for (var i = 0; i < INTENTS.length; i++) {
      if (INTENTS[i].re.test(q)) return INTENTS[i].fn(q);
    }
    return rFallback();
  }

  // ── styles (self-contained; reads theme vars if present, else falls back) ───
  var CSS = [
    ".lg-fab{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:inline-flex;align-items:center;gap:8px;font-family:var(--body,system-ui,sans-serif);font-weight:600;font-size:14px;color:#04101f;background:var(--verify,#4D8DFF);border:none;border-radius:999px;padding:12px 18px;min-height:44px;box-sizing:border-box;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.35);transition:transform .15s,box-shadow .15s}",
    ".lg-fab:hover{transform:translateY(-2px);box-shadow:0 14px 38px rgba(0,0,0,.45)}",
    ".lg-fab .lg-spark{font-size:15px}",
    ".lg-panel{position:fixed;right:20px;bottom:20px;z-index:2147483001;width:min(380px,calc(100vw - 32px));height:min(620px,calc(100vh - 40px));display:none;flex-direction:column;background:var(--bg2,#0F1420);color:var(--ink,#EAEEF5);border:1px solid var(--line2,rgba(234,238,245,.18));border-radius:18px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.55);font-family:var(--body,system-ui,sans-serif);font-size:14.5px;line-height:1.55}",
    ".lg-panel.lg-open{display:flex;animation:lg-in .18s ease}",
    "@keyframes lg-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}",
    ".lg-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line,rgba(234,238,245,.10));background:var(--bg3,#141B2A)}",
    ".lg-seal{width:24px;height:24px;border-radius:8px;border:none;background:linear-gradient(150deg,var(--verify,#4D8DFF),#2B6CE6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:800;flex:none}",
    ".lg-head h4{font-family:var(--display,inherit);font-weight:700;font-size:15px;margin:0;letter-spacing:-.01em}",
    ".lg-head .lg-sub{font-family:var(--mono,monospace);font-size:10.5px;color:var(--dim,#8B94A8);letter-spacing:.04em;margin-top:1px}",
    ".lg-x{margin-left:auto;background:none;border:none;color:var(--dim,#8B94A8);font-size:20px;cursor:pointer;line-height:1;padding:4px 6px;border-radius:8px}",
    ".lg-x:hover{color:var(--ink,#fff);background:var(--line,rgba(234,238,245,.10))}",
    ".lg-stream{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;scrollbar-width:thin}",
    ".lg-msg{max-width:90%;padding:11px 13px;border-radius:13px;word-wrap:break-word}",
    ".lg-bot{align-self:flex-start;background:var(--bg3,#141B2A);border:1px solid var(--line,rgba(234,238,245,.10));border-bottom-left-radius:4px}",
    ".lg-me{align-self:flex-end;background:var(--verify,#4D8DFF);color:#04101f;border-bottom-right-radius:4px;font-weight:500}",
    ".lg-msg b{color:var(--ink,#fff)}.lg-me b{color:#04101f}",
    ".lg-candor{margin-top:8px;font-size:12.5px;color:var(--dim,#8B94A8);border-top:1px solid var(--line,rgba(234,238,245,.10));padding-top:7px}",
    ".lg-tier{display:flex;flex-direction:column;margin-top:8px;padding:8px 10px;background:var(--bg,#0A0E17);border:1px solid var(--line,rgba(234,238,245,.10));border-radius:10px}",
    ".lg-tier-h{display:flex;justify-content:space-between;align-items:baseline}.lg-tier-h span{font-family:var(--display,inherit);font-weight:700}.lg-tier-h i{font-family:var(--mono,monospace);font-size:10px;color:var(--dim,#8B94A8);font-style:normal;font-weight:400}",
    ".lg-tier p{margin:3px 0 0;font-size:12.5px;color:var(--dim,#8B94A8)}",
    ".lg-tablewrap{overflow-x:auto;margin-top:8px}",
    ".lg-table{border-collapse:collapse;width:100%;font-size:12px}",
    ".lg-table th,.lg-table td{border:1px solid var(--line,rgba(234,238,245,.10));padding:6px 8px;text-align:left;vertical-align:top}",
    ".lg-table thead th{font-family:var(--mono,monospace);font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--verify,#4D8DFF)}",
    ".lg-table tbody th{font-weight:600;color:var(--ink,#fff);width:34%}",
    ".lg-table td{color:var(--dim,#8B94A8)}",
    ".lg-cta{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;margin-top:2px;font-weight:600;font-size:13px;color:#04101f;background:var(--verify,#4D8DFF);border-radius:9px;padding:9px 14px;text-decoration:none}",
    ".lg-cta:hover{background:#69a0ff}",
    ".lg-handoff{align-self:stretch;background:linear-gradient(180deg,rgba(77,141,255,.10),var(--bg3,#141B2A));border:1px solid var(--verify,#4D8DFF);border-radius:13px;padding:13px}",
    ".lg-handoff h5{margin:0 0 4px;font-family:var(--display,inherit);font-size:14px;font-weight:700}",
    ".lg-handoff .lg-flow{font-family:var(--mono,monospace);font-size:11px;color:var(--dim,#8B94A8);margin:8px 0 10px;line-height:1.7}",
    ".lg-handoff .lg-flow b{color:var(--verified,#2BD46A)}",
    ".lg-disc{font-family:var(--mono,monospace);font-size:11px;color:var(--dim,#8B94A8);margin-top:6px}",
    ".lg-seeds{display:flex;flex-wrap:wrap;gap:7px;padding:0 16px 12px}",
    ".lg-chip{font-size:12px;color:var(--ink,#EAEEF5);background:var(--bg,#0A0E17);border:1px solid var(--line2,rgba(234,238,245,.18));border-radius:999px;padding:7px 11px;cursor:pointer;transition:border-color .15s,color .15s}",
    ".lg-chip:hover{border-color:var(--verify,#4D8DFF);color:var(--verify,#4D8DFF)}",
    ".lg-input{display:flex;gap:8px;padding:12px;border-top:1px solid var(--line,rgba(234,238,245,.10));background:var(--bg3,#141B2A)}",
    ".lg-input input{flex:1;background:var(--bg,#0A0E17);border:1.5px solid var(--line2,rgba(234,238,245,.18));border-radius:10px;padding:10px 12px;color:var(--ink,#EAEEF5);font-family:inherit;font-size:16px}",
    ".lg-input input:focus{outline:none;border-color:var(--verify,#4D8DFF)}",
    ".lg-send{background:var(--verify,#4D8DFF);color:#04101f;border:none;border-radius:10px;padding:0 14px;font-weight:700;cursor:pointer;font-size:16px}",
    ".lg-send:disabled{opacity:.5;cursor:default}",
    ".lg-typing{align-self:flex-start;display:inline-flex;gap:4px;padding:12px 14px}",
    ".lg-typing i{width:6px;height:6px;border-radius:50%;background:var(--dim,#8B94A8);animation:lg-bounce 1.2s infinite}",
    ".lg-typing i:nth-child(2){animation-delay:.15s}.lg-typing i:nth-child(3){animation-delay:.3s}",
    "@keyframes lg-bounce{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}",
    "@media(max-width:520px){.lg-panel{right:0;bottom:0;width:100vw;height:88vh;border-radius:18px 18px 0 0}.lg-fab{right:14px;bottom:14px}}",
    // ── mobile nav: one shared hamburger across all pages (no per-page markup) ──
    ".lg-burger{display:none;flex-direction:column;justify-content:center;gap:5px;width:42px;height:42px;padding:9px;margin-left:10px;background:none;border:1px solid var(--line2,rgba(234,238,245,.18));border-radius:10px;cursor:pointer;flex:none}",
    ".lg-burger:hover{border-color:var(--verify,#4D8DFF)}",
    ".lg-burger span{display:block;height:2px;width:100%;background:var(--ink,#EAEEF5);border-radius:2px;transition:transform .2s ease,opacity .2s ease}",
    "nav.lg-nav-open .lg-burger span:nth-child(1){transform:translateY(7px) rotate(45deg)}",
    "nav.lg-nav-open .lg-burger span:nth-child(2){opacity:0}",
    "nav.lg-nav-open .lg-burger span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}",
    "@media(max-width:780px){",
    "  .lg-burger{display:flex}",
    "  nav .nav-links{position:absolute;top:100%;left:0;right:0;display:none!important;flex-direction:column;align-items:stretch;gap:0;background:var(--bg2,#0F1420);border-top:1px solid var(--line,rgba(234,238,245,.10));border-bottom:1px solid var(--line2,rgba(234,238,245,.18));padding:6px 22px 18px;box-shadow:0 26px 50px rgba(0,0,0,.45)}",
    "  nav.lg-nav-open .nav-links{display:flex!important}",
    "  nav .nav-links a{display:block!important;padding:13px 2px;font-size:15px;color:var(--ink,#EAEEF5);border-bottom:1px solid var(--line,rgba(234,238,245,.08))}",
    "  nav .nav-links a:hover{color:var(--verify,#4D8DFF)}",
    "  nav .nav-links .btn,nav .nav-links a.btn{width:100%;justify-content:center;text-align:center;margin-top:12px;padding:13px;border-bottom:none!important}",
    "}",
    "@media(prefers-reduced-motion:reduce){.lg-panel.lg-open{animation:none}.lg-typing i{animation:none;opacity:.6}.lg-fab,.lg-chip,.lg-x,.lg-burger span{transition:none}.lg-fab:hover{transform:none}}",
  ].join("\n");

  // ── DOM build ────────────────────────────────────────────────────────────
  var fab, panel, stream, seedsRow, input, sendBtn, opened = false, busy = false, lastFocus = null;

  // ── mobile nav: inject a hamburger that toggles the existing .nav-links ──────
  // Centralized here so all pages share one accessible menu with no per-page
  // markup edits. No-ops on pages without a .nav-links (e.g. the sandbox).
  function initMobileNav() {
    var navLinks = document.querySelector("nav .nav-links");
    if (!navLinks) return;
    var navEl = navLinks.closest("nav");
    var bar = navLinks.parentElement;
    if (!navEl || !bar || bar.querySelector(".lg-burger")) return;
    if (!navLinks.id) navLinks.id = "lg-navlinks";

    var burger = el("button", "lg-burger");
    burger.type = "button";
    burger.setAttribute("aria-label", "Menu");
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-controls", navLinks.id);
    burger.innerHTML = "<span></span><span></span><span></span>";
    bar.appendChild(burger);

    function setOpen(o) {
      navEl.classList.toggle("lg-nav-open", o);
      burger.setAttribute("aria-expanded", String(o));
      burger.setAttribute("aria-label", o ? "Close menu" : "Menu");
    }
    burger.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(!navEl.classList.contains("lg-nav-open"));
    });
    // tapping a link, clicking outside, or Escape closes the menu
    navLinks.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("click", function (e) {
      if (navEl.classList.contains("lg-nav-open") && !navEl.contains(e.target)) setOpen(false);
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
    window.addEventListener("resize", function () { if (window.innerWidth > 780) setOpen(false); });
  }

  function mount() {
    var style = el("style"); style.textContent = CSS; document.head.appendChild(style);
    initMobileNav();

    fab = el("button", "lg-fab");
    fab.type = "button";
    fab.id = "lg-fab";
    fab.setAttribute("aria-label", "Open Ask Legit");
    fab.setAttribute("aria-haspopup", "dialog");
    fab.setAttribute("aria-expanded", "false");
    fab.setAttribute("aria-controls", "lg-panel");
    fab.innerHTML = '<span class="lg-spark" aria-hidden="true">✦</span> Ask Legit';
    fab.addEventListener("click", toggle);
    document.body.appendChild(fab);

    panel = el("div", "lg-panel");
    panel.id = "lg-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Ask Legit");
    panel.innerHTML =
      '<div class="lg-head"><span class="lg-seal" aria-hidden="true">✓</span><div><h4>Ask Legit</h4><div class="lg-sub">pre-auth helper · a human signs anything real</div></div><button class="lg-x" type="button" aria-label="Close Ask Legit">×</button></div>' +
      '<div class="lg-stream"></div>' +
      '<div class="lg-seeds"></div>' +
      '<div class="lg-input"><input type="text" placeholder="Ask about cost, EIN, agents…" aria-label="Ask Legit a question" autocomplete="off"><button class="lg-send" type="button" aria-label="Send">→</button></div>';
    document.body.appendChild(panel);

    stream = panel.querySelector(".lg-stream");
    seedsRow = panel.querySelector(".lg-seeds");
    input = panel.querySelector(".lg-input input");
    sendBtn = panel.querySelector(".lg-send");
    panel.querySelector(".lg-x").addEventListener("click", toggle);
    sendBtn.addEventListener("click", function () { submit(input.value); });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(input.value); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && opened) toggle(); });
    panel.addEventListener("keydown", trapTab);

    SEEDS.forEach(function (s) {
      var chip = el("button", "lg-chip", esc(s.label));
      chip.type = "button";
      chip.addEventListener("click", function () { if (busy) return; pushMe(s.label); think(function () { render(s.fn(s.label)); }); });
      seedsRow.appendChild(chip);
    });

    // greeting
    render(rIntro());
    track("genie_loaded");
  }

  // keep Tab within the open dialog
  function trapTab(e) {
    if (e.key !== "Tab" || !opened) return;
    var f = panel.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function toggle() {
    opened = !opened;
    panel.classList.toggle("lg-open", opened);
    fab.setAttribute("aria-expanded", String(opened));
    fab.setAttribute("aria-label", opened ? "Close Ask Legit" : "Open Ask Legit");
    fab.setAttribute("aria-hidden", String(opened));
    fab.tabIndex = opened ? -1 : 0;
    if (opened) {
      lastFocus = document.activeElement;
      setTimeout(function () { input.focus(); }, 60);
      track("genie_open");
    } else {
      (lastFocus && lastFocus.focus ? lastFocus : fab).focus();
    }
  }

  function pushMe(text) {
    var m = el("div", "lg-msg lg-me", esc(text));
    stream.appendChild(m); scrollDown();
  }
  function pushBot(html) {
    var m = el("div", "lg-msg lg-bot", html);
    m.setAttribute("role", "status");
    m.setAttribute("aria-live", "polite"); // announce assistant output only; user echo stays silent
    stream.appendChild(m); scrollDown(); return m;
  }
  function scrollDown() { stream.scrollTop = stream.scrollHeight; }

  function think(done) {
    busy = true; sendBtn.disabled = true;
    var t = el("div", "lg-typing"); t.innerHTML = "<i></i><i></i><i></i>";
    stream.appendChild(t); scrollDown();
    setTimeout(function () { t.remove(); done(); busy = false; sendBtn.disabled = false; }, 520);
  }

  // render a handler result into the stream
  function render(res) {
    if (!res) return;
    if (res.handoffCard) { renderHandoff(res.handoffName); return; }
    if (res.html) {
      var m = pushBot(res.html);
      if (res.disclaimer) { var d = el("div", "lg-disc", "General information, not legal or tax advice."); m.appendChild(d); }
    }
    if (res.cta) {
      var a = el("a", "lg-cta", esc(res.cta.label));
      a.href = safeHref(res.cta.href);
      a.addEventListener("click", function () { track("genie_cta", a.href); });
      stream.appendChild(a); scrollDown();
    }
    if (res.handoff) renderHandoff(res.handoffName);
  }

  function renderHandoff(name) {
    var box = el("div", "lg-handoff");
    var summary = name ? "Name <b>" + esc(name) + "</b> · Delaware protected series · Free" : "Delaware protected series · Free to start";
    box.innerHTML =
      "<h5>Ready when you are</h5>" +
      "<div style=\"font-size:13px;color:var(--dim,#8B94A8)\">" + summary + "</div>" +
      '<div class="lg-flow">An AI helped you decide → <b>a verified human signs</b> → the system files.</div>';
    box.innerHTML += '<div class="lg-disc">📍 California? The $800/yr CA franchise tax may apply even with no activity — a state tax, not a Legit fee. You can still continue.</div>';
    var a = el("a", "lg-cta", "Continue — you sign off →");
    a.href = ACCESS;
    a.style.marginTop = "0";
    a.addEventListener("click", function () { track("genie_handoff", name || ""); });
    box.appendChild(a);
    stream.appendChild(box); scrollDown();
  }

  // free-text submit: backend if configured, else offline router
  function submit(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    pushMe(text);
    input.value = "";
    track("genie_ask", text.slice(0, 80));

    var endpoint = window.LEGIT_GENIE_ENDPOINT;
    if (endpoint) {
      think(function () { backend(endpoint, text); });
    } else {
      think(function () { render(route(text)); });
    }
  }

  // optional upgraded path — POST to the /genie backend (fast model + tools)
  function backend(endpoint, text) {
    if (!window.__lgHist) window.__lgHist = [];
    window.__lgHist.push({ role: "user", content: text });
    fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: window.__lgHist.slice(-12) }),
    }).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (data) {
        var reply = data && (data.reply || data.text || data.message);
        if (reply) {
          window.__lgHist.push({ role: "assistant", content: reply });
          var m = pushBot(mdLite(reply));
          if (data.disclaimer) m.appendChild(el("div", "lg-disc", "General information, not legal or tax advice."));
        } else { render(route(text)); }
        if (data && data.handoff) renderHandoff(data.handoff.name || null);
        else if (data && data.cta) { var a = el("a", "lg-cta", esc(data.cta.label)); a.href = safeHref(data.cta.href); stream.appendChild(a); scrollDown(); }
      })
      .catch(function () { render(route(text)); }); // graceful fallback to offline brain
  }

  // minimal, safe markdown for backend replies (escape first, then allow **bold**)
  function mdLite(s) {
    return esc(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
  }

  function track(ev, detail) {
    try {
      if (window.dataLayer) window.dataLayer.push({ event: ev, detail: detail });
      if (window.plausible) window.plausible(ev, { props: { detail: detail } });
    } catch (_) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();

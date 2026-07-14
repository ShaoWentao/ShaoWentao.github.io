(function () {
  if (window.__siteVisitorCounterLoaded) return;
  window.__siteVisitorCounterLoaded = true;

  var labels = {
    en: { page: "Page", site: "Site", visitors: "Visitors", title: "Visit statistics" },
    zh: { page: "本页", site: "全站", visitors: "访客", title: "访问量统计" }
  };

  function currentLanguage() {
    var lang = (document.documentElement.getAttribute("lang") || navigator.language || "").toLowerCase();
    return lang.indexOf("zh") === 0 ? "zh" : "en";
  }

  function applyLabels() {
    var lang = currentLanguage();
    var text = labels[lang] || labels.en;
    var box = document.querySelector(".site-visit-counter");
    if (box) box.setAttribute("aria-label", text.title);
    var page = document.querySelector("[data-counter-label='page']");
    var site = document.querySelector("[data-counter-label='site']");
    var visitors = document.querySelector("[data-counter-label='visitors']");
    if (page) page.textContent = text.page;
    if (site) site.textContent = text.site;
    if (visitors) visitors.textContent = text.visitors;
  }

  function injectStyle() {
    if (document.getElementById("site-visit-counter-style")) return;
    var style = document.createElement("style");
    style.id = "site-visit-counter-style";
    style.textContent = [
      ".site-visit-counter{position:fixed;right:14px;bottom:12px;z-index:9999;display:flex;align-items:center;gap:7px;max-width:calc(100vw - 28px);padding:7px 10px;border:1px solid rgba(36,32,27,.14);border-radius:999px;background:rgba(255,255,255,.82);box-shadow:0 8px 24px rgba(0,0,0,.12);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#29251f;font:11px/1.35 Arial,'Microsoft YaHei',sans-serif;white-space:nowrap}",
      ".site-visit-counter span{color:#6e675d}",
      ".site-visit-counter b{font-weight:700;color:#211f1b}",
      ".site-visit-counter i{width:1px;height:12px;background:rgba(36,32,27,.18);display:block}",
      "@media(max-width:560px){.site-visit-counter{left:50%;right:auto;transform:translateX(-50%);bottom:8px;font-size:10px;padding:6px 9px}}",
      "@media print{.site-visit-counter{display:none!important}}"
    ].join("");
    document.head.appendChild(style);
  }

  function injectCounter() {
    if (document.querySelector(".site-visit-counter")) return;
    var box = document.createElement("aside");
    box.className = "site-visit-counter";
    box.setAttribute("aria-live", "polite");
    box.innerHTML = [
      "<span data-counter-label='page'>Page</span><b id='busuanzi_value_page_pv'>--</b>",
      "<i aria-hidden='true'></i>",
      "<span data-counter-label='site'>Site</span><b id='busuanzi_value_site_pv'>--</b>",
      "<i aria-hidden='true'></i>",
      "<span data-counter-label='visitors'>Visitors</span><b id='busuanzi_value_site_uv'>--</b>"
    ].join("");
    document.body.appendChild(box);
    applyLabels();
  }

  function loadBusuanzi() {
    if (document.querySelector("script[data-site-visitor-counter]")) return;
    var script = document.createElement("script");
    script.async = true;
    script.dataset.siteVisitorCounter = "true";
    script.src = "https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js";
    document.body.appendChild(script);
  }

  function init() {
    injectStyle();
    injectCounter();
    loadBusuanzi();
    new MutationObserver(applyLabels).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"]
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

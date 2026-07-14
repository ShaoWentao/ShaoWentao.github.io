(function () {
  if (window.__wechatFollowLoaded) return;
  window.__wechatFollowLoaded = true;

  function scriptBase() {
    var script = document.currentScript || document.querySelector("script[src$='wechat-follow.js']");
    if (!script) return "";
    return new URL(".", script.src).href;
  }

  function injectStyle() {
    if (document.getElementById("wechat-follow-style")) return;
    var style = document.createElement("style");
    style.id = "wechat-follow-style";
    style.textContent = [
      ".wechat-follow-card{position:fixed;right:14px;bottom:45px;z-index:9998;display:grid;grid-template-columns:74px minmax(0,122px);align-items:center;gap:10px;max-width:calc(100vw - 28px);padding:9px 11px;border:1px solid rgba(36,32,27,.14);border-radius:14px;background:rgba(255,255,255,.88);box-shadow:0 10px 28px rgba(0,0,0,.14);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#24201b;font:12px/1.45 Arial,'Microsoft YaHei',sans-serif}",
      ".wechat-follow-card img{width:74px;height:74px;display:block;border-radius:8px;background:#fff;object-fit:cover}",
      ".wechat-follow-card strong{display:block;font-size:12px;font-weight:700;line-height:1.45;color:#24201b}",
      "@media(max-width:680px){.wechat-follow-card{grid-template-columns:58px minmax(0,104px);left:50%;right:auto;bottom:39px;transform:translateX(-50%);padding:7px 8px;gap:8px;font-size:10px}.wechat-follow-card img{width:58px;height:58px}.wechat-follow-card strong{font-size:10px}}",
      "@media print{.wechat-follow-card{display:none!important}}"
    ].join("");
    document.head.appendChild(style);
  }

  function injectCard() {
    if (document.querySelector(".wechat-follow-card")) return;
    var card = document.createElement("aside");
    card.className = "wechat-follow-card";
    card.setAttribute("aria-label", "微信扫一扫关注瓶子先森Light");
    card.innerHTML = '<img src="' + scriptBase() + 'wechat-light-qrcode.jpg" alt="瓶子先森Light 微信二维码"><strong>微信扫一扫关注“瓶子先森Light”</strong>';
    document.body.appendChild(card);
  }

  function init() {
    injectStyle();
    injectCard();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

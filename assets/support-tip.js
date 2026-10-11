(function () {
  if (window.__supportTipLoaded) return;
  window.__supportTipLoaded = true;

  function scriptBase() {
    var script = document.currentScript || document.querySelector("script[src$='support-tip.js']");
    return script ? new URL(".", script.src).href : "";
  }

  function injectStyle() {
    if (document.getElementById("support-tip-style")) return;
    var style = document.createElement("style");
    style.id = "support-tip-style";
    style.textContent = [
      ".support-tip-button{position:fixed;right:14px;bottom:151px;z-index:9999;display:flex;align-items:center;gap:7px;padding:9px 13px;border:1px solid rgba(36,32,27,.14);border-radius:999px;background:rgba(255,255,255,.9);box-shadow:0 8px 24px rgba(0,0,0,.12);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#29251f;font:700 12px/1 Arial,'Microsoft YaHei',sans-serif;cursor:pointer}",
      ".support-tip-button:hover{background:#fff;transform:translateY(-1px)}",
      ".support-tip-button:focus-visible,.support-tip-close:focus-visible{outline:3px solid rgba(0,122,255,.3);outline-offset:2px}",
      ".support-tip-heart{color:#e05a47;font-size:15px}",
      ".support-tip-dialog{position:fixed;inset:0;z-index:10020;display:none;place-items:center;padding:20px;background:rgba(20,20,22,.42);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}",
      ".support-tip-dialog.is-open{display:grid}",
      ".support-tip-panel{position:relative;width:min(760px,calc(100vw - 32px));max-height:calc(100vh - 40px);overflow:auto;padding:26px;border-radius:18px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.24);color:#1d1d1f;font-family:Arial,'Microsoft YaHei',sans-serif}",
      ".support-tip-panel h2{margin:0 44px 6px 0;font-size:22px;line-height:1.25}",
      ".support-tip-panel>p{margin:0 0 20px;color:#6e6e73;font-size:13px}",
      ".support-tip-close{position:absolute;right:18px;top:18px;width:34px;height:34px;border:0;border-radius:50%;background:#f1f1f3;color:#333;font-size:22px;line-height:34px;cursor:pointer}",
      ".support-tip-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}",
      ".support-tip-option{margin:0;padding:12px;border:1px solid #e3e3e7;border-radius:12px;background:#fafafa;text-align:center}",
      ".support-tip-option img{display:block;width:100%;height:auto;max-height:54vh;object-fit:contain;border-radius:8px;background:#fff}",
      ".support-tip-option figcaption{padding-top:10px;font-size:13px;font-weight:700}",
      "body.support-tip-lock{overflow:hidden}",
      "@media(max-width:680px){.support-tip-button{left:50%;right:auto;bottom:113px;transform:translateX(-50%);padding:8px 12px}.support-tip-button:hover{transform:translateX(-50%) translateY(-1px)}.support-tip-panel{padding:20px 14px}.support-tip-options{grid-template-columns:1fr}.support-tip-option img{max-height:58vh}}",
      "@media print{.support-tip-button,.support-tip-dialog{display:none!important}}"
    ].join("");
    document.head.appendChild(style);
  }

  function injectUi() {
    if (document.querySelector(".support-tip-button")) return;
    var button = document.createElement("button");
    button.type = "button";
    button.className = "support-tip-button";
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-controls", "supportTipDialog");
    button.innerHTML = '<span class="support-tip-heart" aria-hidden="true">&#9829;</span><span>赞赏支持</span>';

    var dialog = document.createElement("div");
    dialog.id = "supportTipDialog";
    dialog.className = "support-tip-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "supportTipTitle");
    dialog.setAttribute("aria-hidden", "true");
    dialog.innerHTML = [
      '<section class="support-tip-panel">',
      '<button class="support-tip-close" type="button" aria-label="关闭">&times;</button>',
      '<h2 id="supportTipTitle">赞赏支持</h2>',
      '<p>如果这个工具对你有帮助，欢迎扫码支持持续维护。</p>',
      '<div class="support-tip-options">',
      '<figure class="support-tip-option"><img src="' + scriptBase() + 'support-alipay.jpg" alt="支付宝赞赏二维码"><figcaption>支付宝</figcaption></figure>',
      '<figure class="support-tip-option"><img src="' + scriptBase() + 'support-wechat.jpg" alt="微信赞赏二维码"><figcaption>微信支付</figcaption></figure>',
      '</div></section>'
    ].join("");

    function closeDialog() {
      dialog.classList.remove("is-open");
      dialog.setAttribute("aria-hidden", "true");
      document.body.classList.remove("support-tip-lock");
      button.focus();
    }

    button.addEventListener("click", function () {
      dialog.classList.add("is-open");
      dialog.setAttribute("aria-hidden", "false");
      document.body.classList.add("support-tip-lock");
      dialog.querySelector(".support-tip-close").focus();
    });
    dialog.querySelector(".support-tip-close").addEventListener("click", closeDialog);
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) closeDialog();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && dialog.classList.contains("is-open")) closeDialog();
    });

    document.body.appendChild(button);
    document.body.appendChild(dialog);
  }

  function init() {
    injectStyle();
    injectUi();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

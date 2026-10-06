/* ============================================================
   THEME
============================================================ */
(function () {
  "use strict";

  // دالة مساعدة للتعامل مع LocalStorage لتجنب أي أخطاء
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }

  var htmlEl = document.documentElement;
  var themeBtns = document.querySelectorAll("[data-theme-set]");

  function updateThemeButtons() {
    var cur = htmlEl.getAttribute("data-theme") || "system";
    themeBtns.forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-theme-set") === cur);
    });
  }

  function setTheme(m) {
    if (m === "light" || m === "dark") {
      htmlEl.setAttribute("data-theme", m);
      lsSet("ff-theme", m);
    } else {
      htmlEl.removeAttribute("data-theme");
      lsDel("ff-theme");
    }
    updateThemeButtons();
  }

  var savedTheme = lsGet("ff-theme");
  if (savedTheme === "light" || savedTheme === "dark") {
    htmlEl.setAttribute("data-theme", savedTheme);
  }

  updateThemeButtons();

  themeBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      setTheme(b.getAttribute("data-theme-set"));
    });
  });
})(); // <-- القوسين دول هما اللي بيخلو الدالة تشتغل فوراً أول ما الصفحة تحمل
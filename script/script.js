const tabs = document.querySelectorAll("nav a");
const contents = document.querySelectorAll(".tab-content");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    contents.forEach((content) => {
      if (content.classList.contains("active")) {
        content.classList.remove("active");
      }
    });
    const newContent = document.querySelector(
      `.tab-content[data-content="${target}"]`,
    );
    newContent.classList.add("active");
  });
});

contents[0].classList.add("active");

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    var win = window.open("https://google.com/");
  }
});

// TOOLS AND WHATNOT
// OTHERWISE KNOWN AS EXTRAS
function validURL(str) {
  const exp =
    /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi;
  const reg = new RegExp(exp);
  return !!reg.test(str);
}

function kick() {
  var KICKASSVERSION = "2.0";
  var s = document.createElement("script");
  s.type = "text/javascript";
  document.body.appendChild(s);
  s.src =
    "https://cdn.jsdelivr.net/gh/michaelharper/Kick-Ass-App-WASD/kickass.js";
}

function eruda() {
  var s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/eruda";
  document.body.appendChild(s);
  s.onload = function () {
    eruda.init();
  };
}

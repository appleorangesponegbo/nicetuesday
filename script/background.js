const images = document.querySelectorAll("#themes img");

function updateBackground(src) {
  document.body.style.backgroundImage = `url('${src}')`;

  const tempImg = new Image();
  tempImg.src = src;
  tempImg.onload = function () {
    const w = this.width;
    const h = this.height;
    const s = w / 51.2;

    document.documentElement.style.setProperty("--bg-width", `${w}px`);
    document.documentElement.style.setProperty("--bg-height", `${h}px`);
    document.documentElement.style.setProperty("--bg-speed", `${s}s`);
  };
}

let activeTheme = localStorage.getItem("selectedTheme");
if (!activeTheme) {
  const randomIndex = Math.floor(Math.random() * images.length);
  activeTheme = images[randomIndex].src;
  localStorage.setItem("selectedTheme", activeTheme);
}
updateBackground(activeTheme);

images.forEach((img) => {
  if (img.src === activeTheme) {
    img.style.border = "3px yellow solid";
    img.style.cursor = "auto";
  } else {
    img.style.border = "3px purple solid";
    img.style.cursor = "pointer";
  }
});

images.forEach((img) => {
  img.addEventListener("click", function () {
    updateBackground(this.src);
    localStorage.setItem("selectedTheme", this.src);
    images.forEach((i) => {
      i.style.border = "3px purple solid";
      i.style.cursor = "pointer";
    });
    this.style.border = "3px yellow solid";
    this.style.cursor = "auto";
  });
});

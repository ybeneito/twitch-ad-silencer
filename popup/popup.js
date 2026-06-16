const toggle = document.getElementById("toggle");
const status = document.getElementById("status");

const render = (enabled) => {
  toggle.checked = enabled;
  status.textContent = enabled ? "On" : "Off";
  status.classList.toggle("off", !enabled);
};

browser.storage.local
  .get({ enabled: true })
  .then((result) => render(result.enabled));

toggle.addEventListener("change", () => {
  const enabled = toggle.checked;
  render(enabled);
  browser.storage.local.set({ enabled });
});

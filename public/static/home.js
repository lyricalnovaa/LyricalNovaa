// /static/home.js

document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.getElementById("menu-btn");
  const menu = document.getElementById("menu");
  const logoutBtn = document.getElementById("logout-btn");
  const alertModal = document.getElementById("alert-modal");
  const alertText = document.getElementById("alert-text");
  const alertOk = document.getElementById("alert-ok");

  function showAlert(msg, callback) {
    alertText.textContent = msg;
    alertModal.classList.remove("hidden");
    alertOk.focus();
    alertOk.onclick = () => {
      alertModal.classList.add("hidden");
      if (callback) callback();
    };
  }

  menuBtn.onclick = () => {
    menu.classList.toggle("hidden");
  };

  logoutBtn.onclick = async () => {
    try {
      const res = await fetch("/api/logout", { method: "POST" });
      if (res.ok) {
        showAlert("Logged out! Redirecting to login...", () => {
          window.location.href = "/login";
        });
      } else {
        showAlert("Logout failed.");
      }
    } catch {
      showAlert("Server error on logout.");
    }
  };
});

// /static/admin-dashboard.js

document.addEventListener("DOMContentLoaded", () => {
  const banInput = document.getElementById("ban-artistID");
  const banBtn = document.getElementById("ban-user-btn");
  const otpInput = document.getElementById("otp-artistID");
  const otpBtn = document.getElementById("generate-otp-btn");
  const otpResult = document.getElementById("otp-result");

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

  banBtn.onclick = async () => {
    const artistID = banInput.value.trim();
    if (!artistID) {
      showAlert("Enter an Artist ID to ban.");
      return;
    }

    try {
      const res = await fetch("/api/ban-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistID }),
      });
      const data = await res.json();
      if (res.ok) {
        showAlert(`User ${artistID} banned.`);
        banInput.value = "";
      } else {
        showAlert(data.error || "Ban failed.");
      }
    } catch {
      showAlert("Server error banning user.");
    }
  };

  otpBtn.onclick = async () => {
    const artistID = otpInput.value.trim();
    if (!artistID) {
      showAlert("Enter an Artist ID to generate OTP.");
      return;
    }

    otpResult.textContent = "Generating OTP...";

    try {
      const res = await fetch("/api/generate-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistID }),
      });
      const data = await res.json();
      if (res.ok) {
        otpResult.textContent = `OTP for ${artistID}: ${data.otp}`;
      } else {
        otpResult.textContent = "";
        showAlert(data.error || "Failed to generate OTP.");
      }
    } catch {
      otpResult.textContent = "";
      showAlert("Server error generating OTP.");
    }
  };
});

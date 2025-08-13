document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');

  function showCustomAlert(msg) {
    let alertBox = document.createElement('div');
    alertBox.style.position = 'fixed';
    alertBox.style.top = '50%';
    alertBox.style.left = '50%';
    alertBox.style.transform = 'translate(-50%, -50%)';
    alertBox.style.background = '#0044cc';
    alertBox.style.color = '#fff';
    alertBox.style.padding = '20px';
    alertBox.style.borderRadius = '8px';
    alertBox.style.zIndex = '9999';
    alertBox.style.textAlign = 'center';
    alertBox.style.minWidth = '300px';

    alertBox.innerHTML = `
      <p style="margin-bottom: 20px;">${msg}</p>
      <button id="alert-ok-btn" style="background:#06f; border:none; padding:10px 20px; color:#fff; cursor:pointer; border-radius:4px;">OK</button>
    `;
    document.body.appendChild(alertBox);

    document.getElementById('alert-ok-btn').onclick = () => {
      document.body.removeChild(alertBox);
    };
  }

  async function handleLogin() {
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true; // prevent double clicks

    const artistID = form.artistID.value.trim();
    const password = form.password.value.trim();

    if (!artistID) {
      showCustomAlert('Please enter your Artist ID');
      submitBtn.disabled = false;
      return;
    }

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistID, password }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.otp) {
          showCustomAlert(`Your OTP is: <strong>${data.otp}</strong><br>Use this OTP as your password to login and reset your password.`);
          submitBtn.disabled = false; // allow retry
        } else if (data.role) {
          window.location.href = data.role === 'admin' ? '/admin-dashboard' : '/home';
        }
      } else {
        if (data.error === 'reset_password') {
          localStorage.setItem('resetArtistID', artistID);
          window.location.href = '/reset-password';
        } else {
          showCustomAlert(data.error || 'Login failed');
          submitBtn.disabled = false; // allow retry
        }
      }
    } catch (err) {
      showCustomAlert('Network error. Try again.');
      submitBtn.disabled = false;
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleLogin();
  });

  // Optional: handle Enter key presses anywhere in the form
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLogin();
    }
  });
});
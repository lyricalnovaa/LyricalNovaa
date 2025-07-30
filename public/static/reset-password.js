document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reset-password-form');
  const artistID = localStorage.getItem('resetArtistID');

  if (!artistID) {
    return showCustomAlert('Invalid reset flow. Redirecting to login...', () => {
      window.location.href = '/login';
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const newPassword = form.newPassword.value.trim();
    const confirmPassword = form.confirmPassword.value.trim();

    if (newPassword.length < 4) {
      return showCustomAlert('Password must be at least 4 characters.');
    }

    if (newPassword !== confirmPassword) {
      return showCustomAlert('Passwords do not match.');
    }

    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistID, newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        showCustomAlert('✅ Password reset successfully! Redirecting to login...', () => {
          localStorage.removeItem('resetArtistID');
          window.location.href = '/login';
        });
      } else {
        showCustomAlert(`❌ ${data.error || 'Failed to reset password.'}`);
      }
    } catch (err) {
      showCustomAlert('❌ Server error. Try again later.');
    }
  });
});

// 🔔 Custom Alert Box
function showCustomAlert(message, callback = null) {
  const oldBox = document.querySelector('.custom-alert');
  if (oldBox) oldBox.remove();

  const box = document.createElement('div');
  box.className = 'custom-alert';
  box.innerHTML = `
    <div class="alert-inner">
      <p>${message}</p>
      <button id="alert-ok-btn">OK</button>
    </div>
  `;

  // Style that mf
  Object.assign(box.style, {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: '#0044cc',
    color: '#fff',
    padding: '25px',
    borderRadius: '10px',
    zIndex: '9999',
    textAlign: 'center',
    minWidth: '300px',
    fontFamily: 'Arial, sans-serif',
  });

  const styleBtn = box.querySelector('#alert-ok-btn');
  Object.assign(styleBtn.style, {
    marginTop: '15px',
    background: '#06f',
    border: 'none',
    padding: '10px 20px',
    color: '#fff',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold'
  });

  styleBtn.onclick = () => {
    box.remove();
    if (callback) callback();
  };

  document.body.appendChild(box);
}

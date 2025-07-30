document.addEventListener('DOMContentLoaded', () => {
  const profilePhotoInput = document.getElementById('profilePhoto');
  const fileNameDisplay = document.getElementById('fileName');

  profilePhotoInput.addEventListener('change', () => {
    const file = profilePhotoInput.files[0];
    if (file) {
      fileNameDisplay.textContent = file.name;
    } else {
      fileNameDisplay.textContent = 'No file chosen';
    }
  });

  const alertModal = document.getElementById('alert-modal');
  const alertMessage = document.getElementById('alert-message');
  const alertOkBtn = document.getElementById('alert-ok');
  const modalBackdrop = document.getElementById('modal-backdrop');

  function showAlert(message) {
    alertMessage.textContent = message;
    alertModal.style.display = 'block';
    modalBackdrop.style.display = 'block';
  }

  function hideAlert() {
    alertModal.style.display = 'none';
    modalBackdrop.style.display = 'none';
  }

  alertOkBtn.addEventListener('click', hideAlert);
  modalBackdrop.addEventListener('click', hideAlert);

  const form = document.getElementById('createAccountForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 100% SAFE: Grab inputs directly via form.elements
    const artistName = form.elements['artistName'].value.trim();
    const email = form.elements['email'].value.trim();
    const role = form.elements['role'].value;
    const bio = form.elements['bio'].value.trim();
    const musicType = form.elements['musicType'].value;
    const password = form.elements['password'].value;
    const confirmPassword = form.elements['confirmPassword'].value;
    const profilePhoto = profilePhotoInput.files[0] || null;

    // Debug log
    console.log({
      artistName, email, role, bio, musicType, password, confirmPassword
    });

    if (!artistName || !email || !role || !musicType) {
      showAlert('Please fill all required fields.');
      return;
    }

    if (password.length < 6) {
      showAlert('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      showAlert('Passwords do not match.');
      return;
    }

    const formData = new FormData();
    formData.append('artistName', artistName);
    formData.append('email', email);
    formData.append('role', role);
    formData.append('bio', bio);
    formData.append('musicType', musicType);
    formData.append('password', password);
    if (profilePhoto) formData.append('profilePhoto', profilePhoto);

    try {
      const response = await fetch('/api/create-account', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        showAlert(`Error: ${data.error || 'Failed to create account'}`);
        return;
      }

      showAlert(`Account created! Your Artist ID is ${data.artistID}. Please log in.`);
      form.reset();
      fileNameDisplay.textContent = 'No file chosen';
    } catch (err) {
      showAlert('Network error, try again later.');
    }
  });
});

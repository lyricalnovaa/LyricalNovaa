document.addEventListener('DOMContentLoaded', async () => {
  const profileName = document.getElementById('profile-name');
  const profilePic = document.getElementById('profile-pic');
  const postsContainer = document.getElementById('posts');
  const logoutBtn = document.getElementById('logout-btn');
  const alertModal = document.getElementById('alert-modal');
  const alertText = document.getElementById('alert-text');
  const alertOk = document.getElementById('alert-ok');
  const menuBtn = document.getElementById('menu-btn');
  const menu = document.getElementById('menu');
  const editProfileBtn = document.getElementById('edit-profile-btn');
  const editProfileModal = document.getElementById('edit-profile-modal');
  const cancelEditBtn = document.getElementById('cancel-edit-profile');
  const editProfileForm = document.getElementById('edit-profile-form');

  const profileRole = document.getElementById('profile-role');
  const profileMusicType = document.getElementById('profile-music-type');
  const profileBio = document.getElementById('profile-bio');

  // Mobile menu toggle
  menuBtn?.addEventListener('click', () => {
    menu?.classList.toggle('hidden');
  });

  // Logout button handler
  logoutBtn?.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/logout', { method: 'POST' });
      if (res.ok) {
        showAlert('Logged out.', () => window.location.href = '/login');
      } else {
        showAlert('Logout failed.');
      }
    } catch (err) {
      showAlert('Network error.');
    }
  });

  function showAlert(msg, cb) {
    alertText.textContent = msg;
    alertModal.classList.remove('hidden');
    alertOk.onclick = () => {
      alertModal.classList.add('hidden');
      if (cb) cb();
    };
  }

  // Fetch and display profile info
  try {
    const res = await fetch('/api/profile');
    if (!res.ok) return showAlert('Failed to load profile.');

    const data = await res.json();

    profileName.textContent = `@${data.artistName || 'Unknown'}`;
    profileRole.textContent = data.role || 'No role set';
    profileMusicType.textContent = data.musicType || 'No music type set';
    profileBio.textContent = data.bio || 'No bio available';

    if (data.profilePhotoPath) {
      profilePic.src = data.profilePhotoPath;
    } else {
      profilePic.src = '/static/default-pfp.png';
    }

    // Prefill modal inputs with existing data
    document.getElementById('edit-bio').value = data.bio || '';
    document.getElementById('edit-tags').value = data.musicType || '';
    document.getElementById('edit-profile-pic-url').value = data.profilePhotoPath || '';

    renderPosts(data.posts);
  } catch (err) {
    showAlert('Error loading profile.');
  }

  function renderPosts(posts) {
    postsContainer.innerHTML = '';

    if (!posts || posts.length === 0) {
      postsContainer.innerHTML = `<p>No posts yet.</p>`;
      return;
    }

    posts.forEach(post => {
      const postDiv = document.createElement('div');
      postDiv.className = 'post';

      postDiv.innerHTML = `
        <p>${post.content}</p>
        <button class="edit-post-btn" data-id="${post.id}">Edit Post</button>
      `;

      postsContainer.appendChild(postDiv);
    });

    // Add edit button event listeners
    document.querySelectorAll('.edit-post-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const postId = e.target.getAttribute('data-id');
        editPost(postId);
      });
    });
  }

  // Edit Profile modal open/close
  editProfileBtn?.addEventListener('click', () => {
    editProfileModal.classList.remove('hidden');
    editProfileModal.style.display = 'flex';
  });

  cancelEditBtn?.addEventListener('click', () => {
    editProfileModal.classList.add('hidden');
    editProfileModal.style.display = 'none';
  });

  // Handle form submit
  editProfileForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const updatedPic = document.getElementById('edit-profile-pic-url').value.trim();
    const updatedBio = document.getElementById('edit-bio').value.trim();
    const updatedTags = document.getElementById('edit-tags').value.trim()
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag)
      .slice(0, 5);

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profilePhotoPath: updatedPic,
          bio: updatedBio,
          musicType: updatedTags.join(', '),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save profile');
      }

      // Update SQLite DB too
      try {
        const sqliteRes = await fetch('/api/profile/sqlite-update', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profilePhotoPath: updatedPic,
            bio: updatedBio,
            musicType: updatedTags.join(', '),
          }),
        });
        if (!sqliteRes.ok) console.warn('Failed to update SQLite DB');
      } catch (err) {
        console.warn('SQLite update error:', err);
      }

      // Update UI
      profilePic.src = updatedPic || '/static/default-pfp.png';
      profileBio.textContent = updatedBio || 'No bio available';
      profileMusicType.textContent = updatedTags.join(', ') || 'No music type set';

      editProfileModal.classList.add('hidden');
      editProfileModal.style.display = 'none';
      showAlert('Profile updated successfully.');
    } catch (err) {
      showAlert(err.message || 'Error updating profile.');
    }
  });
});

function editPost(postID) {
  alert('Editing post: ' + postID);
}

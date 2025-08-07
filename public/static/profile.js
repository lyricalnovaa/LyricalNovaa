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

    profileName.textContent = `@${data.artistName}`;
    if (data.profilePicUrl) {
      profilePic.src = data.profilePicUrl;
    }

    renderPosts(data.posts);
  } catch (err) {
    showAlert('Error loading profile.');
  }

  function renderPosts(posts) {
    postsContainer.innerHTML = '';

    if (!posts || posts.length === 0) {
      postsContainer.innerHTML = `<p class="text-gray-500">No posts yet.</p>`;
      return;
    }

    posts.forEach(post => {
      const postDiv = document.createElement('div');
      postDiv.className = 'post border p-3 rounded bg-white shadow-sm mb-4';

      postDiv.innerHTML = `
        <p class="text-sm text-gray-800 mb-2">${post.content}</p>
        <button class="edit-post-btn text-blue-500 hover:underline" data-id="${post.id}">Edit Post</button>
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
});

function editPost(postID) {
  alert('Editing post: ' + postID);
}

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

  // toggle menu
  menuBtn.onclick = () => {
    menu.classList.toggle('hidden');
  };

  logoutBtn.onclick = async () => {
    const res = await fetch('/api/logout', { method: 'POST' });
    if (res.ok) {
      showAlert('Logged out.', () => {
        window.location.href = '/login';
      });
    } else {
      showAlert('Logout failed.');
    }
  };

  function showAlert(msg, cb) {
    alertText.textContent = msg;
    alertModal.classList.remove('hidden');
    alertOk.onclick = () => {
      alertModal.classList.add('hidden');
      if (cb) cb();
    };
  }

  // Get user data
  const res = await fetch('/api/profile');
  if (!res.ok) return showAlert('Failed to load profile.');

  const data = await res.json();

  profileName.textContent = `@${data.artistName}`;
  if (data.profilePicUrl) {
    profilePic.src = data.profilePicUrl;
  }

  // Load posts
  postsContainer.innerHTML = '';
  if (data.posts.length === 0) {
    postsContainer.innerHTML = `<p>No posts yet.</p>`;
  } else {
    data.posts.forEach(post => {
      const div = document.createElement('div');
      div.className = 'post';
      div.innerHTML = `
        <p>${post.content}</p>
        <button onclick="editPost('${post.id}')">Edit Post</button>
      `;
      postsContainer.appendChild(div);
    });
  }
});

function editPost(postID) {
  // you can build this later
  alert('Editing post: ' + postID);
}

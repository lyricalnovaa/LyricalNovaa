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

  // =========================
  //  Create Post Modal Logic
  // =========================

  const createPostBtn = document.getElementById("add-post-btn");
  const postModal = document.getElementById("create-post-modal");
  const cancelPostBtn = document.getElementById("cancel-post");
  const submitPostBtn = document.getElementById("submit-post");
  const postTextArea = document.getElementById("post-text");
  const loggedInUserEl = document.getElementById("logged-in-user");

  // Fetch logged-in user
  fetch("/api/current-user")
    .then(res => res.json())
    .then(data => {
      if (data && data.artistID) {
        loggedInUserEl.textContent = "@" + data.artistID;
      }
    })
    .catch(() => {
      loggedInUserEl.textContent = "@unknown";
    });

  // Open modal
  createPostBtn.onclick = () => {
    postModal.style.display = "flex";
    postTextArea.focus();
  };

  // Close modal
  cancelPostBtn.onclick = () => {
    postModal.style.display = "none";
    postTextArea.value = "";
  };

  // Submit post modal
  submitPostBtn.onclick = async () => {
    const content = postTextArea.value.trim();
    if (!content) {
      showAlert("Post content cannot be empty.");
      return;
    }

    try {
      const res = await fetch("/api/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });

      if (res.ok) {
        showAlert("Post created!", () => {
          postModal.style.display = "none";
          postTextArea.value = "";
        });
      } else {
        showAlert("Failed to post.");
      }
    } catch {
      showAlert("Server error on post.");
    }
  };

  // =========================
  // 🚀 ADDITION: Inline Post Box Logic (Facebook-style)
  // =========================

  const postInput = document.getElementById("post-input");
  const submitPostBtnInline = document.getElementById("submit-post-inline");
  const loggedInUserInline = document.getElementById("logged-in-user-inline");

  // Fetch logged-in user for inline post box username display
  fetch("/api/current-user")
    .then(res => res.json())
    .then(data => {
      if (data && data.artistID) {
        if (loggedInUserInline) loggedInUserInline.textContent = "@" + data.artistID;
      }
    })
    .catch(() => {
      if (loggedInUserInline) loggedInUserInline.textContent = "@unknown";
    });

  // Disable submit button initially
  if (submitPostBtnInline) submitPostBtnInline.disabled = true;

  // Enable/disable inline submit button based on textarea content
  if (postInput && submitPostBtnInline) {
    postInput.addEventListener("input", () => {
      submitPostBtnInline.disabled = postInput.value.trim() === "";
    });

    // Submit post from inline box
    submitPostBtnInline.addEventListener("click", async () => {
      const content = postInput.value.trim();
      if (!content) {
        alert("Post content cannot be empty."); // fallback alert
        return;
      }

      try {
        const res = await fetch("/api/post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });

        if (res.ok) {
          alert("Post created!");
          postInput.value = "";
          submitPostBtnInline.disabled = true;
          // TODO: refresh posts feed here if you build it
        } else {
          alert("Failed to post.");
        }
      } catch (err) {
        alert("Server error on post.");
      }
    });
  }

  // =========================
  // Feed loading and rendering
  // =========================

  const feedContainer = document.getElementById('feed');

  async function loadFeed() {
    if (!feedContainer) return; // no feed container? bail

    try {
      const res = await fetch('/api/posts');
      if (!res.ok) throw new Error('Failed to fetch posts');
      const posts = await res.json();

      feedContainer.innerHTML = ''; // clear current feed

      posts.forEach(post => {
        const postEl = document.createElement('div');
        postEl.className = 'post';

        postEl.innerHTML = `
          <div class="post-header" style="display:flex; align-items:center; gap:10px; margin-bottom: 6px;">
            <img src="${post.profilePhotoPath || '/static/default-profile.png'}" alt="Profile Picture" style="width:40px; height:40px; border-radius:50%; object-fit:cover;" />
            <a href="/profile/${post.artistID}" style="color:#06f; font-weight:bold; text-decoration:none;">@${post.artistName || post.artistID}</a>
          </div>
          <div class="post-content" style="color:#eee; margin-bottom: 12px;">${post.content || ''}</div>
        `;

        feedContainer.appendChild(postEl);
      });
    } catch (err) {
      feedContainer.textContent = 'Failed to load feed.';
    }
  }

  // Fix logged-in user display (use artistID instead of username)
  fetch("/api/current-user")
    .then(res => res.json())
    .then(data => {
      if (data && data.artistID) {
        const loggedInUserEl = document.getElementById("logged-in-user");
        if (loggedInUserEl) loggedInUserEl.textContent = "@" + data.artistID;
      }
    })
    .catch(() => {
      const loggedInUserEl = document.getElementById("logged-in-user");
      if (loggedInUserEl) loggedInUserEl.textContent = "@unknown";
    });

  // Load feed on page load
  loadFeed();
});

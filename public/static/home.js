document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.getElementById("menu-btn");
  const menu = document.getElementById("menu");
  const logoutBtn = document.getElementById("logout-btn");
  const alertModal = document.getElementById("alert-modal");
  const alertText = document.getElementById("alert-text");
  const alertOk = document.getElementById("alert-ok");
  const feedContainer = document.getElementById("feed");

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
  // Post creation modal
  // =========================
  const createPostBtn = document.getElementById("add-post-btn");
  const postModal = document.getElementById("create-post-modal");
  const cancelPostBtn = document.getElementById("cancel-post");
  const submitPostBtn = document.getElementById("submit-post");
  const postTextArea = document.getElementById("post-text");
  const fileUploadInput = document.getElementById("file-upload");
  const filePreview = document.getElementById("file-preview");
  let uploadedFile = null;

  createPostBtn.onclick = () => {
    postModal.style.display = "flex";
    postTextArea.focus();
  };

  cancelPostBtn.onclick = () => {
    postModal.style.display = "none";
    postTextArea.value = "";
    clearFilePreview();
  };

  fileUploadInput.addEventListener("change", () => {
    const file = fileUploadInput.files[0];
    uploadedFile = file || null;
    clearFilePreview();

    if (!file) return;

    const reader = new FileReader();
    if (file.type.startsWith("image/")) {
      reader.onload = e => {
        const img = document.createElement("img");
        img.src = e.target.result;
        filePreview.appendChild(img);
      };
    } else if (file.type.startsWith("video/")) {
      reader.onload = e => {
        const video = document.createElement("video");
        video.src = e.target.result;
        video.controls = true;
        filePreview.appendChild(video);
      };
    } else {
      const info = document.createElement("p");
      info.textContent = `File: ${file.name} (${Math.round(file.size / 1024)} KB)`;
      filePreview.appendChild(info);
    }
    reader.readAsDataURL(file);
  });

  function clearFilePreview() {
    filePreview.innerHTML = "";
    uploadedFile = null;
    fileUploadInput.value = "";
  }

  submitPostBtn.onclick = async () => {
    const content = postTextArea.value.trim();
    if (!content && !uploadedFile) {
      showAlert("Post content or a file is required.");
      return;
    }

    try {
      let body, headers;
      if (uploadedFile) {
        body = new FormData();
        body.append("content", content);
        body.append("file", uploadedFile);
        headers = {};
      } else {
        body = JSON.stringify({ content });
        headers = { "Content-Type": "application/json" };
      }

      const res = await fetch("/api/post", { method: "POST", headers, body });
      if (res.ok) {
        showAlert("Post created!", () => {
          postModal.style.display = "none";
          postTextArea.value = "";
          clearFilePreview();
          loadFeed();
        });
      } else {
        showAlert("Failed to post.");
      }
    } catch {
      showAlert("Server error on post.");
    }
  };

  // =========================
  // Feed
  // =========================
  async function loadFeed() {
    if (!feedContainer) return;

    let currentUser = {};
    try {
      const userRes = await fetch("/api/current-user");
      currentUser = await userRes.json();
    } catch {}

    try {
      const res = await fetch("/api/posts");
      if (!res.ok) throw new Error("Failed to fetch posts");
      const posts = await res.json();

      feedContainer.innerHTML = "";

      posts.forEach(post => {
        const postEl = document.createElement("div");
        postEl.className = "post";

        let mediaHTML = "";
        if (post.mediaPath) {
          if (post.mediaType === "image") {
            mediaHTML = `<img src="${post.mediaPath}" alt="Post media" style="max-width:100%; border-radius:8px; margin-top:8px;" />`;
          } else if (post.mediaType === "video") {
            mediaHTML = `<video controls style="max-width:100%; border-radius:8px; margin-top:8px;">
                           <source src="${post.mediaPath}" type="video/mp4" />
                         </video>`;
          }
        }

        // Only show ... menu for the owner
        let menuHTML = "";
        if (post.artistID === currentUser.artistID) {
          menuHTML = `
            <div class="post-menu" style="position:relative; cursor:pointer;">…
              <div class="menu-dropdown hidden" style="position:absolute; top:20px; left:0; background:#000; border:1px solid #06f; border-radius:6px; padding:5px; z-index:100;">
                <button class="edit-post-btn" data-id="${post.id}" style="display:block; width:100%; background:none; border:none; color:#06f; text-align:left; padding:5px;">Edit Post</button>
                <button class="delete-post-btn" data-id="${post.id}" style="display:block; width:100%; background:none; border:none; color:#06f; text-align:left; padding:5px;">Delete Post</button>
              </div>
            </div>
          `;
        }

        postEl.innerHTML = `
          <div class="post-header" style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
            <img src="${post.profilePhotoPath || '/static/default-pfp.png'}" alt="Profile Picture" style="width:40px; height:40px; border-radius:50%; object-fit:cover;" />
            <a href="/profile/${post.artistName}" style="color:#06f; font-weight:bold; text-decoration:none;">@${post.artistName || post.artistID}</a>
            ${menuHTML}
          </div>
          <div class="post-content" style="color:#eee; margin-bottom:12px;">${post.content || ''}</div>
          ${mediaHTML}
        `;

        feedContainer.appendChild(postEl);

        // Menu functionality
        if (post.artistID === currentUser.artistID) {
          const menu = postEl.querySelector(".post-menu");
          const dropdown = postEl.querySelector(".menu-dropdown");
          const editBtn = postEl.querySelector(".edit-post-btn");
          const deleteBtn = postEl.querySelector(".delete-post-btn");

          menu.addEventListener("click", e => {
            e.stopPropagation();
            dropdown.classList.toggle("hidden");
          });

          editBtn.addEventListener("click", () => openEditModal(post));
          deleteBtn.addEventListener("click", () => deletePost(post.id));
        }
      });

      document.addEventListener("click", () => {
        document.querySelectorAll(".menu-dropdown").forEach(d => d.classList.add("hidden"));
      });

    } catch {
      feedContainer.textContent = "Failed to load feed.";
    }
  }

  // =========================
  // Edit Post Modal
  // =========================
  const editModal = document.getElementById("edit-post-modal");
  const editText = document.getElementById("edit-post-text");
  const editFileInput = document.getElementById("edit-file-upload");
  const editFilePreview = document.getElementById("edit-file-preview");
  const cancelEditBtn = document.getElementById("cancel-edit-post");
  const saveEditBtn = document.getElementById("save-edit-post");
  let currentEditPost = null;
  let newUploadedFile = null;

  function clearEditPreview() {
    editFilePreview.innerHTML = "";
    newUploadedFile = null;
    editFileInput.value = "";
  }

  function openEditModal(post) {
    currentEditPost = post;
    editText.value = post.content || "";
    clearEditPreview();
    if (post.mediaPath) {
      if (post.mediaType === "image") {
        const img = document.createElement("img");
        img.src = post.mediaPath;
        editFilePreview.appendChild(img);
      } else if (post.mediaType === "video") {
        const video = document.createElement("video");
        video.src = post.mediaPath;
        video.controls = true;
        editFilePreview.appendChild(video);
      }
    }
    editModal.style.display = "flex";
  }

  cancelEditBtn.onclick = () => {
    editModal.style.display = "none";
    currentEditPost = null;
    clearEditPreview();
  };

  editFileInput.addEventListener("change", () => {
    const file = editFileInput.files[0];
    newUploadedFile = file || null;
    clearEditPreview();

    if (!file) return;

    const reader = new FileReader();
    if (file.type.startsWith("image/")) {
      reader.onload = e => {
        const img = document.createElement("img");
        img.src = e.target.result;
        editFilePreview.appendChild(img);
      };
    } else if (file.type.startsWith("video/")) {
      reader.onload = e => {
        const video = document.createElement("video");
        video.src = e.target.result;
        video.controls = true;
        editFilePreview.appendChild(video);
      };
    }
    reader.readAsDataURL(file);
  });

  saveEditBtn.onclick = async () => {
    if (!currentEditPost) return;
    const content = editText.value.trim();
    try {
      let body, headers;
      if (newUploadedFile) {
        body = new FormData();
        body.append("content", content);
        body.append("file", newUploadedFile);
        headers = {};
      } else {
        body = JSON.stringify({ content });
        headers = { "Content-Type": "application/json" };
      }

      const res = await fetch(`/api/posts/${currentEditPost.id}`, {
        method: "PUT",
        headers,
        body,
      });

      if (res.ok) {
        showAlert("Post updated!", () => {
          editModal.style.display = "none";
          currentEditPost = null;
          clearEditPreview();
          loadFeed();
        });
      } else {
        showAlert("Failed to update post.");
      }
    } catch {
      showAlert("Server error on updating post.");
    }
  };

  // =========================
  // Delete Post
  // =========================
  function deletePost(postID) {
    if (!confirm("Are you sure you want to delete this post?")) return;
    fetch(`/api/posts/${postID}`, { method: "DELETE", credentials: "include" })
      .then(res => {
        if (res.ok) {
          const postEl = document.querySelector(`.edit-post-btn[data-id='${postID}']`)?.closest(".post");
          if (postEl) postEl.remove();
        } else showAlert("Failed to delete post.");
      });
  }

  loadFeed();
});
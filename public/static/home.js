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
  // Create Post Modal Logic
  // =========================
  const createPostBtn = document.getElementById("add-post-btn");
  const postModal = document.getElementById("create-post-modal");
  const cancelPostBtn = document.getElementById("cancel-post");
  const submitPostBtn = document.getElementById("submit-post");
  const postTextArea = document.getElementById("post-text");
  const loggedInUserEl = document.getElementById("logged-in-user");
  const fileUploadInput = document.getElementById("file-upload");
  const filePreview = document.getElementById("file-preview");
  let uploadedFile = null;

  fetch("/api/current-user")
    .then(res => res.json())
    .then(data => {
      if (data?.artistID) {
        loggedInUserEl.textContent = "@" + data.artistID;
      }
    })
    .catch(() => {
      loggedInUserEl.textContent = "@unknown";
    });

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
      let body;
      let headers;

      if (uploadedFile) {
        body = new FormData();
        body.append("content", content);
        body.append("media", uploadedFile);
        headers = {};
      } else {
        body = JSON.stringify({ content });
        headers = { "Content-Type": "application/json" };
      }

      const res = await fetch("/api/post", {
        method: "POST",
        headers,
        body,
      });

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
  // Inline Post Box Logic
  // =========================
  const postInput = document.getElementById("post-input");
  const submitPostBtnInline = document.getElementById("submit-post-inline");
  const loggedInUserInline = document.getElementById("logged-in-user-inline");

  fetch("/api/current-user")
    .then(res => res.json())
    .then(data => {
      if (data?.artistID && loggedInUserInline) {
        loggedInUserInline.textContent = "@" + data.artistID;
      }
    })
    .catch(() => {
      if (loggedInUserInline) loggedInUserInline.textContent = "@unknown";
    });

  if (submitPostBtnInline) submitPostBtnInline.disabled = true;

  if (postInput && submitPostBtnInline) {
    postInput.addEventListener("input", () => {
      submitPostBtnInline.disabled = postInput.value.trim() === "";
    });

    submitPostBtnInline.addEventListener("click", async () => {
      const content = postInput.value.trim();
      if (!content) {
        alert("Post content cannot be empty.");
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
          loadFeed();
        } else {
          alert("Failed to post.");
        }
      } catch {
        alert("Server error on post.");
      }
    });
  }

  // =========================
  // Feed loading
  // =========================
  const feedContainer = document.getElementById("feed");

  async function loadFeed() {
    if (!feedContainer) return;

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

        postEl.innerHTML = `
          <div class="post-header" style="display:flex; align-items:center; gap:10px; margin-bottom: 6px;">
            <img src="${post.profilePhotoPath || '/static/default-pfp.png'}" alt="Profile Picture" style="width:40px; height:40px; border-radius:50%; object-fit:cover;" />
            <a href="/profile/${post.artistName}" style="color:#06f; font-weight:bold; text-decoration:none;">${post.artistName || post.artistID}</a>
          </div>
          <div class="post-content" style="color:#eee; margin-bottom: 12px;">${post.content || ''}</div>
          ${mediaHTML}
        `;

        feedContainer.appendChild(postEl);
      });
    } catch {
      feedContainer.textContent = "Failed to load feed.";
    }
  }

  fetch("/api/current-user")
    .then(res => res.json())
    .then(data => {
      if (data?.artistID) {
        const loggedInUserEl = document.getElementById("logged-in-user");
        if (loggedInUserEl) loggedInUserEl.textContent = "@" + data.artistID;
      }
    })
    .catch(() => {
      const loggedInUserEl = document.getElementById("logged-in-user");
      if (loggedInUserEl) loggedInUserEl.textContent = "@unknown";
    });

  loadFeed();

  // =========================
  // Extra: Media upload preview logic (no Firebase keys)
  // =========================
  const postUploadInput = document.getElementById("file-upload"); // already exists
  const postFilePreview = document.getElementById("file-preview"); // already exists
  let postUploadedFile = null;

  postUploadInput.addEventListener("change", () => {
    const file = postUploadInput.files[0];
    postUploadedFile = file || null;
    postFilePreview.innerHTML = "";

    if (!file) return;

    const reader = new FileReader();
    if (file.type.startsWith("image/")) {
      reader.onload = e => {
        const img = document.createElement("img");
        img.src = e.target.result;
        img.style.maxWidth = "100%";
        postFilePreview.appendChild(img);
      };
    } else if (file.type.startsWith("video/")) {
      reader.onload = e => {
        const video = document.createElement("video");
        video.src = e.target.result;
        video.controls = true;
        video.style.maxWidth = "100%";
        postFilePreview.appendChild(video);
      };
    }
    reader.readAsDataURL(file);
  });
});
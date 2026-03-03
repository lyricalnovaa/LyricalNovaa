document.addEventListener('DOMContentLoaded', () => {
  // Safe getters
  const header = document.querySelector('header');
  const exploreBtns = Array.from(document.querySelectorAll('a')).filter(a => /explore/i.test(a.textContent || ''));
  const featuresSection = document.querySelector('.features');
  const heroInner = document.querySelector('.hero-inner');
  const glassImgs = Array.from(document.querySelectorAll('.glass-card img'));
  const yearEl = document.getElementById('year');

  // Set current year
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Nav elements for logged-in state
  const navLogin = document.getElementById('nav-login');
  const navGetStarted = document.getElementById('nav-get-started');
  const navDashboard = document.getElementById('nav-dashboard');
  const navLogout = document.getElementById('nav-logout');

  // Check current user to toggle nav and fetch members
  (async function initUser() {
    try {
      const res = await fetch('/api/current-user');
      if (!res.ok) throw new Error('no user');
      const user = await res.json();
      if (user && user.loggedIn) {
        // hide signup/login
        if (navLogin) navLogin.style.display = 'none';
        if (navGetStarted) navGetStarted.style.display = 'none';
        // show dashboard/logout
        if (navDashboard) navDashboard.style.display = '';
        if (navLogout) navLogout.style.display = '';
      }
    } catch (err) {
      // not logged in; leave default nav
    }
  })();

  if (navLogout) {
    navLogout.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/logout', { method: 'POST' });
        if (res.ok) window.location.reload();
        else window.alert('Logout failed');
      } catch (err) { window.alert('Server error on logout'); }
    });
  }

  // Smooth scroll "Explore" to features section if present
  exploreBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (!featuresSection) return; // fallback to default navigation
      e.preventDefault();
      featuresSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Simple entrance animation
  requestAnimationFrame(() => {
    if (heroInner) {
      heroInner.style.opacity = 0;
      heroInner.style.transform = 'translateY(10px)';
      heroInner.style.transition = 'opacity 700ms ease, transform 700ms ease';
      requestAnimationFrame(() => {
        heroInner.style.opacity = 1;
        heroInner.style.transform = 'translateY(0)';
      });
    }

    if (featuresSection) {
      featuresSection.style.opacity = 0;
      featuresSection.style.transform = 'translateY(12px)';
      featuresSection.style.transition = 'opacity 700ms ease 200ms, transform 700ms ease 200ms';
      requestAnimationFrame(() => {
        featuresSection.style.opacity = 1;
        featuresSection.style.transform = 'translateY(0)';
      });
    }
  });

  // Small floating animation for images to give a futuristic subtle motion
  glassImgs.forEach((img, idx) => {
    img.style.transition = 'transform 1000ms cubic-bezier(.2,.9,.2,1)';
    let dir = idx % 2 === 0 ? 1 : -1;
    setInterval(() => {
      img.style.transform = `translateY(${dir * 6}px)`;
      dir = -dir;
    }, 2500 + (idx * 300));
  });

  // Placeholder SVG generator (data URL)
  function placeholderDataURL(label = 'placeholder', w = 600, h = 360) {
    const bg = '#0a1a2b';
    const fg = '#06f';
    const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'><rect width='100%' height='100%' fill='${bg}'/><g fill='${fg}' opacity='0.12'><rect x='0' y='0' width='100%' height='100%'/></g><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Segoe UI, Arial' font-size='20' fill='${fg}' opacity='0.9'>${label}</text></svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  // Ensure hero images have a placeholder in case the real image is missing
  glassImgs.forEach(img => {
    if (!img.src) img.src = placeholderDataURL('Art preview', 600, 360);
    img.onerror = () => { img.src = placeholderDataURL('Placeholder', img.width || 600, img.height || 360); };
  });

  // Render label members (fetches /api/label-members or uses fallback)
  (async function loadMembers() {
    const container = document.getElementById('members-grid');
    if (!container) return;
    let members = [];
    try {
      const res = await fetch('/api/label-members');
      if (res.ok) members = await res.json();
    } catch (err) { /* ignore */ }
    if (!members || !members.length) {
      // fallback sample members
      members = [
        { name: 'Ava Nova', artistName: 'Ava', role: 'Vocalist', pfp: '/static/default-pfp.png' },
        { name: 'Kai Storm', artistName: 'Kai', role: 'Producer', pfp: '/static/default-pfp.png' },
        { name: 'Lumen', artistName: 'Lumen', role: 'Beatmaker', pfp: '/static/default-pfp.png' }
      ];
    }
    container.innerHTML = '';
    members.forEach(m => {
      const el = document.createElement('div');
      el.style.padding = '12px';
      el.style.borderRadius = '10px';
      el.style.background = 'linear-gradient(180deg, rgba(6,111,255,0.02), transparent)';
      el.style.border = '1px solid rgba(6,111,255,0.06)';
      el.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center">
          <img src="${m.pfp || '/static/default-pfp.png'}" alt="${m.artistName}" style="width:64px;height:64px;border-radius:10px;object-fit:cover;box-shadow:0 6px 18px rgba(6,111,255,0.06);" onerror="this.src='/static/default-pfp.png'" />
          <div>
            <div style="font-weight:800;color:var(--neon)">${m.name || m.artistName}</div>
            <div style="color:#cfe9ff;opacity:0.9">@${m.artistName || ''} • ${m.role || 'Artist'}</div>
          </div>
        </div>
      `;
      container.appendChild(el);
    });
  })();

  // Render simple store items
  (function loadStore() {
    const storeGrid = document.getElementById('store-grid');
    if (!storeGrid) return;
    const items = [
      { id: 'beat-001', title: 'Midnight Beat', price: '$29', img: placeholderDataURL('Beat', 360, 200) },
      { id: 'merch-001', title: 'Lyrical Novaa Tee', price: '$24', img: placeholderDataURL('Tee', 360, 200) },
      { id: 'sample-pack', title: 'Sample Pack Vol.1', price: '$12', img: placeholderDataURL('Samples', 360, 200) }
    ];
    storeGrid.innerHTML = '';
    items.forEach(it => {
      const card = document.createElement('div');
      card.style.padding = '12px';
      card.style.borderRadius = '10px';
      card.style.background = 'linear-gradient(180deg, rgba(6,111,255,0.02), transparent)';
      card.style.border = '1px solid rgba(6,111,255,0.06)';
      card.innerHTML = `
        <img src="${it.img}" alt="${it.title}" style="width:100%;height:140px;object-fit:cover;border-radius:8px;margin-bottom:10px;" />
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:800;color:var(--neon)">${it.title}</div>
          <div style="color:#cfe9ff">${it.price}</div>
        </div>
        <div style="margin-top:10px;display:flex;gap:8px">
          <button class="buy-btn" data-id="${it.id}" style="flex:1;padding:10px;border-radius:8px;background:linear-gradient(90deg,var(--neon),var(--neon-2));border:none;color:#001;cursor:pointer;font-weight:800">Buy</button>
          <button class="preview-btn" data-id="${it.id}" style="padding:10px;border-radius:8px;border:1px solid rgba(6,111,255,0.08);background:transparent;color:var(--neon);cursor:pointer">Preview</button>
        </div>
      `;
      storeGrid.appendChild(card);
    });

    // basic handlers
    storeGrid.addEventListener('click', (e) => {
      const b = e.target.closest('.buy-btn');
      if (b) { window.alert('Cart and payment not configured — this is a placeholder.'); }
      const p = e.target.closest('.preview-btn');
      if (p) { window.alert('Preview not available in this demo.'); }
    });
  })();

  // Make sure the page doesn't try to run feed/post code when homepage is a landing page
  // No-op if elements are missing.
  const feedContainer = document.getElementById('feed');
  if (feedContainer) {
    // Keep original feed loader behavior but guarded
    async function loadFeed() {
      try {
        const res = await fetch('/api/posts');
        if (!res.ok) throw new Error('Failed to fetch posts');
        const posts = await res.json();
        feedContainer.innerHTML = '';
        posts.forEach(post => {
          const postEl = document.createElement('div');
          postEl.className = 'post';
          let mediaHTML = '';
          if (post.media) {
            if (post.mediaType === 'image') mediaHTML = `<img src="${post.media}" alt="Post media" style="max-width:100%; border-radius:8px; margin-top:8px;" />`;
            else if (post.mediaType === 'video') mediaHTML = `<video controls style="max-width:100%; border-radius:8px; margin-top:8px;"><source src="${post.media}" type="video/mp4" /></video>`;
          }
          postEl.innerHTML = `
            <div class="post-header" style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
              <img src="${post.profilePhotoPath || '/static/default-pfp.png'}" alt="Profile Picture" style="width:40px; height:40px; border-radius:50%; object-fit:cover;" />
              <a href="/profile/${post.artistName}" style="color:#06f; font-weight:bold; text-decoration:none;">${post.artistName || post.artistID}</a>
            </div>
            <div class="post-content" style="color:#eee; margin-bottom:12px;">${post.content || ''}</div>
            ${mediaHTML}
          `;
          feedContainer.appendChild(postEl);
        });
      } catch (err) {
        console.error('Load feed error:', err);
        feedContainer.textContent = 'Failed to load feed.';
      }
    }
    loadFeed();
  }
});

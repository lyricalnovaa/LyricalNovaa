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

  // NEW profile elements
  const navProfile = document.getElementById('nav-profile');
  const navPfp = document.getElementById('nav-pfp');

  const menuToggle = document.getElementById('menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileLogin = document.getElementById('mobile-login');
  const mobileGetStarted = document.getElementById('mobile-get-started');
  const mobileDashboard = document.getElementById('mobile-dashboard');
  const mobileLogout = document.getElementById('mobile-logout');

  // NEW mobile profile
  const mobileProfile = document.getElementById('mobile-profile');
  const mobilePfp = document.getElementById('mobile-pfp');

  const ctaCreate = document.getElementById('cta-create');

  // Check current user to toggle nav and fetch members
  (async function initUser() {
    try {
      const res = await fetch('/api/current-user');
      if (!res.ok) throw new Error('no user');
      const user = await res.json();

      const isLogged = !!(user && (user.loggedIn || user.artistID || user.userId || user.id || user.email));

      if (isLogged) {

        // hide signup/login
        if (navLogin) navLogin.style.display = 'none';
        if (navGetStarted) navGetStarted.style.display = 'none';
        if (mobileLogin) mobileLogin.style.display = 'none';
        if (mobileGetStarted) mobileGetStarted.style.display = 'none';

        // show dashboard/logout
        if (navDashboard) navDashboard.style.display = '';
        if (navLogout) navLogout.style.display = '';
        if (mobileDashboard) mobileDashboard.style.display = '';
        if (mobileLogout) mobileLogout.style.display = '';

        if (ctaCreate) ctaCreate.style.display = 'none';

        // NEW: show profile picture
        const pfp =
          user.profilePhotoPath ||
          user.pfp ||
          user.profilePhoto ||
          '/static/default-pfp.png';

        if (navProfile) {
          navProfile.style.display = 'flex';
          if (navPfp) navPfp.src = pfp;
        }

        if (mobileProfile) {
          mobileProfile.style.display = 'block';
          if (mobilePfp) mobilePfp.src = pfp;
        }
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

  if (mobileLogout) {
    mobileLogout.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/logout', { method: 'POST' });
        if (res.ok) window.location.reload();
        else window.alert('Logout failed');
      } catch (err) { window.alert('Server error on logout'); }
    });
  }

  // Mobile menu handling
  function updateMenuToggleVisibility() {
    if (!menuToggle) return;
    if (window.innerWidth < 900) menuToggle.style.display = '';
    else menuToggle.style.display = 'none';
  }

  updateMenuToggleVisibility();
  window.addEventListener('resize', updateMenuToggleVisibility);

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
      const open = mobileMenu.style.display !== 'none' && mobileMenu.style.display !== '' ? true : mobileMenu.style.display === '';
      if (mobileMenu.style.display === 'none' || !mobileMenu.style.display) {
        mobileMenu.style.display = 'block';
      } else {
        mobileMenu.style.display = 'none';
      }
    });

    mobileMenu.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (a) mobileMenu.style.display = 'none';
    });
  }

  // Smooth scroll "Explore" to features section if present
  exploreBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (!featuresSection) return;
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

  // Small floating animation for images
  glassImgs.forEach((img, idx) => {
    img.style.transition = 'transform 1000ms cubic-bezier(.2,.9,.2,1)';
    let dir = idx % 2 === 0 ? 1 : -1;
    setInterval(() => {
      img.style.transform = `translateY(${dir * 6}px)`;
      dir = -dir;
    }, 2500 + (idx * 300));
  });

  // Placeholder SVG generator
  function placeholderDataURL(label = 'placeholder', w = 600, h = 360) {
    const bg = '#0a1a2b';
    const fg = '#06f';
    const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'><rect width='100%' height='100%' fill='${bg}'/><g fill='${fg}' opacity='0.12'><rect x='0' y='0' width='100%' height='100%'/></g><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Segoe UI, Arial' font-size='20' fill='${fg}' opacity='0.9'>${label}</text></svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  glassImgs.forEach(img => {
    if (!img.src) img.src = placeholderDataURL('Art preview', 600, 360);
    img.onerror = () => { img.src = placeholderDataURL('Placeholder', img.width || 600, img.height || 360); };
  });

  (async function loadMembers() {
    const container = document.getElementById('members-grid');
    if (!container) return;

    let members = [];
    try {
      const res = await fetch('/api/label-members');
      if (res.ok) members = await res.json();
    } catch {}

    if (!members || !members.length) {
      members = [
        { name: 'XANTANX', artistName: 'XANTANX', role: 'Artist', pfp: '/static/XANTANX.png' },
        { name: 'Mercy', artistName: 'Mercy Official', role: 'Artist', pfp: '/static/Mercy.png' }
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
          <img src="${m.pfp || '/static/default-pfp.png'}" style="width:64px;height:64px;border-radius:10px;object-fit:cover;">
          <div>
            <div style="font-weight:800;color:var(--neon)">${m.name || m.artistName}</div>
            <div style="color:#cfe9ff">@${m.artistName || ''} • ${m.role || 'Artist'}</div>
          </div>
        </div>
      `;

      container.appendChild(el);
    });
  })();

});

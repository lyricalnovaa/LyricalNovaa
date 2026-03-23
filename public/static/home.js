document.addEventListener('DOMContentLoaded', () => {
  // =========================
  // Element Selectors
  // =========================
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const navLogin = document.getElementById('nav-login');
  const navGetStarted = document.getElementById('nav-get-started');
  const navDashboard = document.getElementById('nav-dashboard');
  const navLogout = document.getElementById('nav-logout');
  const navProfile = document.getElementById('nav-profile');
  const navProfileMenu = document.getElementById('nav-profile-menu');
  const navPfp = document.getElementById('nav-pfp');

  const mobileMenu = document.getElementById('mobile-menu');
  const menuToggle = document.getElementById('menu-toggle');
  const mobileLogin = document.getElementById('mobile-login');
  const mobileGetStarted = document.getElementById('mobile-get-started');
  const mobileDashboard = document.getElementById('mobile-dashboard');
  const mobileLogout = document.getElementById('mobile-logout');
  const mobileProfile = document.getElementById('mobile-profile');
  const mobilePfp = document.getElementById('mobile-pfp');

  const ctaCreate = document.getElementById('cta-create');
  const featuresSection = document.querySelector('.features');
  const exploreBtns = Array.from(document.querySelectorAll('a')).filter(a => /explore/i.test(a.textContent || ''));

  // =========================
  // Auth Logic
  // =========================
  (async function initUser() {
    try {
      const res = await fetch('/api/current-user', { credentials: 'include' });
      if (!res.ok) throw new Error('no user');
      const user = await res.json();

      // Check if user object indicates they are logged in
      const isLogged = !!(user && (user.loggedIn || user.artistID || user.userId || user.id || user.email));

      if (isLogged) {
        // 1. Hide Login/Signup links
        if (navLogin) navLogin.style.display = 'none';
        if (navGetStarted) navGetStarted.style.display = 'none';
        if (mobileLogin) mobileLogin.style.display = 'none';
        if (mobileGetStarted) mobileGetStarted.style.display = 'none';
        if (ctaCreate) ctaCreate.style.display = 'none'; // Hide hero CTA

        // 2. Show Dashboard/Logout/Profile
        if (navProfile) navProfile.style.display = 'flex';
        if (navDashboard) navDashboard.style.display = 'block';
        if (navLogout) navLogout.style.display = 'block';

        if (mobileProfile) mobileProfile.style.display = 'block';
        if (mobileDashboard) mobileDashboard.style.display = 'block';
        if (mobileLogout) mobileLogout.style.display = 'block';

        // 3. Set Profile Picture
        const pfp = user.profilePhotoPath || user.pfp || user.profilePhoto || '/static/default-pfp.png';
        if (navPfp) navPfp.src = pfp;
        if (mobilePfp) mobilePfp.src = pfp;
      }
    } catch (err) {
      console.log("User not logged in or API error.");
    }
  })();

  // =========================
  // Interaction Handlers
  // =========================

  // Desktop Profile Dropdown Toggle
  if (navProfile) {
    navProfile.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = navProfileMenu.style.display === 'block';
      navProfileMenu.style.display = isVisible ? 'none' : 'block';
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    if (navProfileMenu) navProfileMenu.style.display = 'none';
  });

  // Logout functionality
  async function handleLogout() {
    try {
      const res = await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      if (res.ok) window.location.reload();
      else alert('Logout failed');
    } catch {
      alert('Server error on logout');
    }
  }

  if (navLogout) navLogout.addEventListener('click', handleLogout);
  if (mobileLogout) mobileLogout.addEventListener('click', handleLogout);

  // Mobile Menu Toggle
  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
      mobileMenu.style.display = mobileMenu.style.display === 'flex' ? 'none' : 'flex';
    });
  }

  // Smooth Scroll
  exploreBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (!featuresSection) return;
      e.preventDefault();
      featuresSection.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Floating animations for images
  const glassImgs = document.querySelectorAll('.glass-card img');
  glassImgs.forEach((img, idx) => {
    img.style.transition = 'transform 1000ms ease-in-out';
    let dir = idx % 2 === 0 ? 1 : -1;
    setInterval(() => {
      img.style.transform = `translateY(${dir * 8}px)`;
      dir = -dir;
    }, 2000 + (idx * 500));
  });
});

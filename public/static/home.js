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

  const navProfile = document.getElementById('nav-profile');
  const navPfp = document.getElementById('nav-pfp');

  const menuToggle = document.getElementById('menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileLogin = document.getElementById('mobile-login');
  const mobileGetStarted = document.getElementById('mobile-get-started');
  const mobileDashboard = document.getElementById('mobile-dashboard');
  const mobileLogout = document.getElementById('mobile-logout');

  const mobileProfile = document.getElementById('mobile-profile');
  const mobilePfp = document.getElementById('mobile-pfp');

  const ctaCreate = document.getElementById('cta-create');

  // ✅ FIXED: include credentials
  (async function initUser() {
    try {
      const res = await fetch('/api/current-user', {
        credentials: 'include'
      });

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
        if (navDashboard) navDashboard.style.display = 'inline-block';
        if (navLogout) navLogout.style.display = 'inline-block';
        if (mobileDashboard) mobileDashboard.style.display = 'block';
        if (mobileLogout) mobileLogout.style.display = 'block';

        if (ctaCreate) ctaCreate.style.display = 'none';

        // profile picture
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
      console.log('Not logged in');
    }
  })();

  // ✅ FIXED logout (include credentials)
  if (navLogout) {
    navLogout.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/logout', {
          method: 'POST',
          credentials: 'include'
        });
        if (res.ok) window.location.reload();
        else window.alert('Logout failed');
      } catch (err) { window.alert('Server error on logout'); }
    });
  }

  if (mobileLogout) {
    mobileLogout.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/logout', {
          method: 'POST',
          credentials: 'include'
        });
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

  // Smooth scroll
  exploreBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (!featuresSection) return;
      e.preventDefault();
      featuresSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Animations
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

  // Floating images
  glassImgs.forEach((img, idx) => {
    img.style.transition = 'transform 1000ms cubic-bezier(.2,.9,.2,1)';
    let dir = idx % 2 === 0 ? 1 : -1;
    setInterval(() => {
      img.style.transform = `translateY(${dir * 6}px)`;
      dir = -dir;
    }, 2500 + (idx * 300));
  });

});
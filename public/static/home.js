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

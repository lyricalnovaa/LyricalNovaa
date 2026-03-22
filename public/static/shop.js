/**
 * Lyrical Novaa Shop Engine
 * Handles Audio Previews and UI Interactions
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. AUDIO PREVIEW LOGIC ---
    const playButtons = document.querySelectorAll('.play-btn');
    const allAudios = document.querySelectorAll('audio');

    playButtons.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            // Find the audio element related to this button
            // In your HTML, the audio is a sibling or near the button
            const audio = btn.closest('.item-card').querySelector('audio');

            if (!audio) return;

            // If this song is already playing, pause and reset it
            if (!audio.paused) {
                pauseAndReset(audio, btn);
            } else {
                // Stop all other playing audios first
                stopAllAudio();
                
                // Play the selected audio
                audio.play().then(() => {
                    btn.innerText = "⏸";
                    btn.classList.add('playing');
                }).catch(err => console.log("Playback blocked by browser:", err));
            }
        });
    });

    // Helper: Stop everything
    function stopAllAudio() {
        allAudios.forEach(aud => {
            aud.pause();
            aud.currentTime = 0;
        });
        playButtons.forEach(b => {
            b.innerText = "▶";
            b.classList.remove('playing');
        });
    }

    // Helper: Pause specific
    function pauseAndReset(audio, btn) {
        audio.pause();
        audio.currentTime = 0;
        btn.innerText = "▶";
        btn.classList.remove('playing');
    }

    // Reset UI when any audio naturally ends
    allAudios.forEach(aud => {
        aud.addEventListener('ended', () => {
            stopAllAudio();
        });
    });


    // --- 2. SMOOTH SCROLLING / MOBILE UI ---
    // Highlighting the active column on mobile when scrolling
    const columns = document.querySelectorAll('.shop-column');
    
    const observerOptions = {
        root: null,
        threshold: 0.6
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.borderColor = 'var(--neon)';
                entry.target.style.boxShadow = '0 0 15px rgba(157, 78, 221, 0.2)';
            } else {
                entry.target.style.borderColor = 'rgba(157, 78, 221, 0.15)';
                entry.target.style.boxShadow = 'none';
            }
        });
    }, observerOptions);

    columns.forEach(col => observer.observe(col));


    // --- 3. CHECKOUT REDIRECT LOGIC ---
    const buyButtons = document.querySelectorAll('.stripe-btn');
    buyButtons.forEach(link => {
        link.addEventListener('click', (e) => {
            const productName = link.closest('.item-card').querySelector('h3').innerText;
            console.log(`User redirecting to Stripe for: ${productName}`);
            // The <a> tag handles the actual link, this is just for your analytics/logs
        });
    });
});

// Image preview logic
function showImgPreview(src) {
    const modal = document.getElementById('img-preview-modal');
    const img = document.getElementById('img-preview');
    img.src = src && src.trim() ? src : 'صور/Photo.avif';
    modal.style.display = 'flex';
}
function closeImgPreview() {
    document.getElementById('img-preview-modal').style.display = 'none';
    document.getElementById('img-preview').src = '';
}
function showInstructorImgPreview(src) {
    const modal = document.getElementById('instructor-img-preview-modal');
    const img = document.getElementById('instructor-img-preview');
    img.src = src && src.trim() ? src : 'صور/person.png';
    modal.style.display = 'flex';
}
function closeInstructorImgPreview() {
    document.getElementById('instructor-img-preview-modal').style.display = 'none';
    document.getElementById('instructor-img-preview').src = '';
}

// Plyr video player logic
let player; // Global variable to hold the Plyr instance

function openVideoPlayer(videoId) {
    const iframe = document.getElementById("video-player-iframe");
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;

    // Username for watermark (try to get from Firebase user or fallback)
    let username = "مستخدم";
    if (window.currentUserId && firebase && firebase.auth().currentUser) {
        username = firebase.auth().currentUser.displayName || "مستخدم";
    } else {
        const el = document.getElementById("username-display");
        if (el && el.textContent) username = el.textContent.replace("مرحباً،", "").trim();
    }
    const userData = JSON.parse(localStorage.getItem('userData')) || {};
    const phone = userData.phone || "غير متوفر";

    const watermark = document.getElementById("watermark");
    watermark.innerHTML = `
        <div style="text-align: center; line-height: 1;">
            <div>${username}</div>
            <div>${phone}</div>
        </div>`;
    watermark.style.opacity = "0.3";
    watermark.style.display = "block";

    document.getElementById("video-player-modal").style.display = "flex";

    if (!player) {
        player = new Plyr('.plyr__video-embed', {
            controls: [
                'play-large',
                'play',
                'progress',
                'current-time',
                'duration',
                'settings',
                'fullscreen'
            ],
            seekTime: 10,
            keyboard: {
                focused: true,
                global: true
            },
            listeners: {
                rewind: (event) => {
                    showSeekOverlay('⪡ -10s', 'rewind');
                },
                fastForward: (event) => {
                    showSeekOverlay('⪢ +10s', 'forward');
                }
            }
        });

        // Overlay for seek
        function showSeekOverlay(text, type) {
            const overlayClass = type === 'rewind' ? 'plyr__rewind-overlay' : 'plyr__forward-overlay';
            const container = player.elements.container;
            const existingOverlay = container.querySelector(`.${overlayClass}`);
            if (existingOverlay) existingOverlay.remove();
            const overlay = document.createElement('div');
            overlay.className = overlayClass;
            overlay.textContent = text;
            container.appendChild(overlay);
            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
                setTimeout(() => {
                    overlay.style.opacity = '0';
                    setTimeout(() => overlay.remove(), 200);
                }, 500);
            });
        }

        document.addEventListener('keydown', (e) => {
            if (document.activeElement.tagName === 'INPUT') return;
            if (e.key === 'ArrowLeft') {
                showSeekOverlay('⪡ -10s', 'rewind');
            } else if (e.key === 'ArrowRight') {
                showSeekOverlay('⪢ +10s', 'forward');
            }
        });

        setTimeout(() => {
            const plyrEmbed = document.querySelector('.plyr__video-embed');
            if (plyrEmbed) {
                plyrEmbed.onclick = function(e) {
                    if (
                        e.target.classList.contains('plyr__control') &&
                        (e.target.getAttribute('data-plyr') === 'play' || e.target.getAttribute('data-plyr') === 'pause')
                    ) {
                        // allow default
                    } else {
                        e.stopPropagation();
                        e.preventDefault();
                    }
                };
            }
            document.addEventListener('keydown', function(e) {
                if (document.getElementById("video-player-modal").style.display === "flex") {
                    if (
                        (e.code === "Space" || e.key === " " || e.keyCode === 32 || e.key === "Enter" || e.keyCode === 13)
                        && document.activeElement.tagName !== "BUTTON"
                        && document.activeElement.tagName !== "INPUT"
                    ) {
                        const active = document.activeElement;
                        if (
                            !(active && active.classList.contains('plyr__control') &&
                            (active.getAttribute('data-plyr') === 'play' || active.getAttribute('data-plyr') === 'pause'))
                        ) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    }
                }
            }, true);
        }, 500);

    } else {
        player.play();
    }

    player.on('playing', () => {
        document.getElementById("exit-video-button").style.display = "block";
    });

    // Tooltips for controls
    if (!localStorage.getItem('tooltipsShown')) {
        function waitForElement(selector, timeout = 4000) {
            return new Promise((resolve, reject) => {
                const interval = 50;
                let elapsed = 0;
                function check() {
                    const el = document.querySelector(selector);
                    if (el) return resolve(el);
                    elapsed += interval;
                    if (elapsed >= timeout) return reject();
                    setTimeout(check, interval);
                }
                check();
            });
        }
        Promise.all([
            waitForElement('[data-plyr="fast-forward"]'),
            waitForElement('[data-plyr="rewind"]')
        ]).then(() => {
            const tooltips = [
                {
                    text: 'اضغط مرتين للتقديم 10 ثواني للأمام',
                    selector: '[data-plyr="fast-forward"]',
                    icon: '⏩'
                },
                {
                    text: 'اضغط مرتين للرجوع 10 ثواني للخلف',
                    selector: '[data-plyr="rewind"]',
                    icon: '⏪'
                }
            ];
            let currentTooltipIndex = 0;
            function showNextTooltip() {
                if (currentTooltipIndex < tooltips.length) {
                    const tip = tooltips[currentTooltipIndex];
                    const button = document.querySelector(tip.selector);
                    if (button) {
                        const tooltip = document.createElement('div');
                        tooltip.className = 'video-tooltip';
                        tooltip.innerHTML = `
                            <div class="tooltip-content">
                                <span class="tooltip-icon">${tip.icon}</span>
                                <span>${tip.text}</span>
                            </div>
                            <button class="tooltip-button">فهمت</button>
                        `;
                        document.body.appendChild(tooltip);
                        const rect = button.getBoundingClientRect();
                        tooltip.style.top = `${rect.bottom + 10}px`;
                        tooltip.style.left = `${rect.left + rect.width / 2 - 130}px`;
                        setTimeout(() => tooltip.classList.add('show'), 100);
                        tooltip.querySelector('.tooltip-button').addEventListener('click', () => {
                            tooltip.classList.remove('show');
                            setTimeout(() => {
                                tooltip.remove();
                                currentTooltipIndex++;
                                showNextTooltip();
                            }, 300);
                        });
                    } else {
                        currentTooltipIndex++;
                        showNextTooltip();
                    }
                } else {
                    localStorage.setItem('tooltipsShown', 'true');
                }
            }
            showNextTooltip();
        });
    }

    const plyrEmbed = document.querySelector('.plyr__video-embed');
    if (plyrEmbed) {
        let dblOverlay = plyrEmbed.querySelector('.plyr__dblseek-overlay');
        if (!dblOverlay) {
            dblOverlay = document.createElement('div');
            dblOverlay.className = '.plyr__dblseek-overlay';
            dblOverlay.style.cssText = `
                position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                background:rgba(0,0,0,0.7);color:#fff;font-size:2.2em;
                border-radius:50%;width:90px;height:90px;display:flex;
                align-items:center;justify-content:center;z-index:10;opacity:0;
                pointer-events:none;transition:opacity 0.2s;
            `;
            plyrEmbed.style.position = 'relative';
            plyrEmbed.appendChild(dblOverlay);
        }

        plyrEmbed.ondblclick = function(e) {
            const rect = plyrEmbed.getBoundingClientRect();
            const x = e.clientX - rect.left;
            let text = '';
            if (x < rect.width / 2) {
                if (player) player.rewind(10);
                text = '⪡ 10s-';
            } else {
                if (player) player.forward(10);
                text = '10s+ ⪢';
            }
            dblOverlay.textContent = text;
            dblOverlay.style.opacity = '1';
            setTimeout(() => { dblOverlay.style.opacity = '0'; }, 600);

            e.preventDefault();
            e.stopPropagation();
        };
    }

    let speedOverlay = document.getElementById('plyr-speed-overlay');
    if (!speedOverlay) {
        speedOverlay = document.createElement('div');
        speedOverlay.id = 'plyr-speed-overlay';
        speedOverlay.style.cssText = `
            position:absolute;top:18px;left:50%;transform:translateX(-50%);
            background:rgba(26,115,232,0.28);color:#fff;font-size:1.25em;
            border-radius:12px;padding:4px 18px;z-index:20;opacity:0;
            pointer-events:none;transition:opacity 0.18s;
            font-weight:bold;box-shadow:0 1px 6px #1a73e833;
            user-select:none;
        `;
        const plyrEmbed = document.querySelector('.plyr__video-embed');
        if (plyrEmbed) {
            plyrEmbed.appendChild(speedOverlay);
        }
    }

    let speedTimeout = null;
    let isSpeeding = false;

    function enableSpeed() {
        if (player && !isSpeeding) {
            player.speed = 2;
            isSpeeding = true;
            speedOverlay.textContent = '2x';
            speedOverlay.style.opacity = '1';
        }
    }
    function disableSpeed() {
        if (player && isSpeeding) {
            player.speed = 1;
            isSpeeding = false;
            speedOverlay.style.opacity = '0';
        }
        if (speedTimeout) {
            clearTimeout(speedTimeout);
            speedTimeout = null;
        }
    }

    setTimeout(() => {
        const plyrEmbed = document.querySelector('.plyr__video-embed');
        if (plyrEmbed) {
            plyrEmbed.onmousedown = function(e) {
                if (e.button !== 0) return;
                speedTimeout = setTimeout(enableSpeed, 350);
            };
            plyrEmbed.onmouseup = function() { disableSpeed(); };
            plyrEmbed.onmouseleave = function() { disableSpeed(); };
            plyrEmbed.ontouchstart = function(e) {
                speedTimeout = setTimeout(enableSpeed, 350);
            };
            plyrEmbed.ontouchend = function() { disableSpeed(); };
            plyrEmbed.ontouchcancel = function() { disableSpeed(); };
        }
    }, 400);
}

function closeVideoPlayer(event) {
    if (player) {
        player.destroy();
        player = null;
    }
    const iframe = document.getElementById("video-player-iframe");
    iframe.src = "";
    document.getElementById("video-player-modal").style.display = "none";
    // document.getElementById("videos").style.display = "grid"; // Uncomment if you have a videos grid

    document.getElementById("exit-video-button").style.display = "none";
    const watermark = document.getElementById("watermark");
    if (watermark) {
        watermark.textContent = "";
        watermark.style.display = "none";
    }
    if (event) event.preventDefault();
}
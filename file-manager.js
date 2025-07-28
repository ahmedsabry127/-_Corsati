// دالة للتحقق إذا كان الرابط من يوتيوب
    function isYouTubeUrl(url) {
        return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//.test(url);
    }

    // دالة للتحقق إذا كان الرابط بث مباشر (m3u8/mpd/mp4/live)
    function isLiveStreamUrl(url) {
        return /\.(m3u8|mpd|mp4)$/i.test(url) || /live/i.test(url);
    }

    // دالة لعرض نافذة منبثقة بها فيديو يوتيوب
    function showYouTubeModal(url) {
        let videoId = null;
        // استخراج ID الفيديو من الرابط
        const ytMatch = url.match(/(?:youtube\.com\/.*v=|youtu\.be\/)([A-Za-z0-9_\-]+)/);
        if (ytMatch && ytMatch[1]) {
            videoId = ytMatch[1];
        } else {
            // fallback: حاول استخراج id من أي رابط يوتيوب
            try {
                const urlObj = new URL(url);
                if (urlObj.hostname.includes('youtube.com')) {
                    videoId = urlObj.searchParams.get('v');
                }
            } catch (e) {}
        }
        // --- تعديل هنا: لا تفتح نافذة خارجية أبداً، إذا لم يوجد ID لا تفعل شيء أو أعطِ تنبيه ---
        if (!videoId) {
            alert('تعذر استخراج معرف فيديو يوتيوب من الرابط. يرجى التأكد من صحة الرابط.');
            return;
        }
        // استخدم مشغل Plyr الجديد
        openVideoPlayer(videoId);
    }

    // دالة لعرض نافذة منبثقة بها بث مباشر (مشغل فيديو HTML5)
    function showLiveVideoModal(url) {
        // إنشاء أو إظهار نافذة الفيديو
        let modal = document.getElementById('live-video-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'live-video-modal';
            modal.style.cssText = `
                display:flex;position:fixed;top:0;left:0;width:100vw;height:100vh;
                background:#000b;z-index:5000;justify-content:center;align-items:center;
            `;
            modal.innerHTML = `
                <div style="position:relative;max-width:96vw;max-height:80vh;width:100%;display:flex;flex-direction:column;align-items:center;">
                    <span id="exit-live-video-button" style="position:absolute;top:18px;left:24px;font-size:2em;color:#fff;cursor:pointer;z-index:5010;background:#1976d2cc;border-radius:50%;padding:2px 12px;">خروج</span>
                    <video id="live-player" width="800" controls controlsList="nodownload" disablePictureInPicture style="max-width:90vw;max-height:70vh;border-radius:12px;background:#222;">
                        <source src="" type="video/mp4" />
                        المتصفح لا يدعم تشغيل الفيديو.
                    </video>
                </div>
            `;
            document.body.appendChild(modal);
            // زر الخروج
            modal.querySelector('#exit-live-video-button').onclick = function() {
                closeLiveVideoModal();
            };
            // منع قائمة السياق على كامل النافذة
            modal.addEventListener('contextmenu', function(e) { e.preventDefault(); });
            // منع الضغط المطول والتسريع
            const video = modal.querySelector('#live-player');
            let longPressTimer = null;
            video.addEventListener('touchstart', function(e) {
                longPressTimer = setTimeout(() => { video.playbackRate = 2; }, 500);
            });
            video.addEventListener('touchend', function(e) {
                clearTimeout(longPressTimer);
                video.playbackRate = 1;
            });
            video.addEventListener('touchmove', function(e) {
                clearTimeout(longPressTimer);
                video.playbackRate = 1;
            });
        }
        // ضبط الرابط
        const video = modal.querySelector('#live-player');
        video.src = url;
        video.load();
        modal.style.display = 'flex';
    }

    // دالة لإغلاق نافذة البث المباشر
    function closeLiveVideoModal() {
        const modal = document.getElementById('live-video-modal');
        if (modal) {
            const video = modal.querySelector('#live-player');
            if (video) {
                video.pause();
                video.src = '';
            }
            modal.style.display = 'none';
        }
    }

    // دالة للتحقق إذا كان الرابط ملف PDF من Google Drive
    function isGoogleDrivePdfUrl(url) {
        // يتحقق من وجود /file/d/{id}/view في الرابط وأنه ينتهي بـ .pdf أو لا يوجد امتداد (غالباً روابط PDF من درايف)
        return /^https:\/\/drive\.google\.com\/file\/d\/[^/]+\/view/.test(url);
    }

    // دالة لعرض نافذة منبثقة بها PDF Google Drive
    function showGoogleDrivePdfModal(url) {
        // استخراج ID الملف من الرابط
        const match = url.match(/\/file\/d\/([^/]+)\//);
        if (!match) {
            window.open(url, '_blank');
            return;
        }
        const fileId = match[1];
        // رابط التضمين
        const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;

        // إنشاء أو إظهار نافذة PDF
        let modal = document.getElementById('pdf-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'pdf-modal';
            modal.style.cssText = `
                display:flex;position:fixed;top:0;left:0;width:100vw;height:100vh;
                background:#000b;z-index:6000;justify-content:center;align-items:center;
            `;
            modal.innerHTML = `
                <div style="position:relative;width:100vw;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0;">
                    <span id="exit-pdf-button" style="position:absolute;top:18px;left:24px;font-size:2em;color:#fff;cursor:pointer;z-index:6010;background:#1976d2cc;border-radius:50%;padding:0 12px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:1.6em;line-height:1;">&times;</span>
                    <iframe id="pdf-iframe" src="" style="width:100vw;height:100vh;border-radius:0;border:none;background:#fff;box-shadow:none;" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-downloads"></iframe>
                </div>
            `;
            document.body.appendChild(modal);
            modal.querySelector('#exit-pdf-button').onclick = function() {
                closeGoogleDrivePdfModal();
            };
        }
        const iframe = modal.querySelector('#pdf-iframe');
        iframe.src = embedUrl;
        modal.style.display = 'flex';
    }

    function closeGoogleDrivePdfModal() {
        const modal = document.getElementById('pdf-modal');
        if (modal) {
            const iframe = modal.querySelector('#pdf-iframe');
            if (iframe) iframe.src = '';
            modal.style.display = 'none';
        }
    }

    // Helper: Get YouTube video ID from URL
    function extractYouTubeId(url) {
        const ytMatch = url.match(/(?:youtube\.com\/.*v=|youtu\.be\/)([A-Za-z0-9_\-]+)/);
        if (ytMatch && ytMatch[1]) return ytMatch[1];
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname.includes('youtube.com')) {
                return urlObj.searchParams.get('v');
            }
        } catch (e) {}
        return null;
    }

    // Helper: Fetch YouTube video durations (returns {id: durationSeconds})
    async function fetchYouTubeDurations(ids, apiKey) {
        if (!apiKey || !ids.length) return {};
        const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids.join(',')}&key=${apiKey}`;
        try {
            const resp = await fetch(url);
            const data = await resp.json();
            const result = {};
            if (data.items) {
                for (const item of data.items) {
                    // ISO 8601 duration to seconds
                    const iso = item.contentDetails.duration;
                    result[item.id] = isoDurationToSeconds(iso);
                }
            }
            return result;
        } catch (e) {
            return {};
        }
    }

    // Helper: Convert ISO 8601 duration to seconds
    function isoDurationToSeconds(iso) {
        // Example: PT1H2M10S
        const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return 0;
        const h = parseInt(match[1] || '0', 10);
        const m = parseInt(match[2] || '0', 10);
        const s = parseInt(match[3] || '0', 10);
        return h * 3600 + m * 60 + s;
    }

    // Helper: Format seconds to H:MM:SS or MM:SS
    function formatDuration(sec) {
        sec = Math.round(sec);
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    // Helper: Get MP4 duration using HTML5 video
    function getMp4Duration(url) {
        return new Promise(resolve => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.src = url;
            video.onloadedmetadata = function() {
                resolve(video.duration || 0);
            };
            video.onerror = function() {
                resolve(0);
            };
        });
    }

    // لا حاجة لتعديل هنا، خصائص العرض ستأتي من CSS فقط

    // نافذة منبثقة لاختيار مجلد الوجهة للنقل مع دائرة تحميل وشريط بحث
function showMoveModal(excludeId, callback) {
    let allFolders = [];
    let filteredFolders = [];
    let modal = null;
    let listDiv = null;
    let searchInput = null;
    let loaderDiv = null;

    // جلب كل مجلدات المستخدم الحالي
    async function fetchFolders(parentId, prefix) {
        const snap = await db.collection('folders')
            .where('parentId', '==', parentId)
            .where('userId', '==', currentUserId)
            .get();
        let arr = [];
        for (const doc of snap.docs) {
            if (doc.id === excludeId) continue;
            arr.push({id: doc.id, name: prefix + doc.data().name});
            const subs = await fetchFolders(doc.id, prefix + doc.data().name + '/');
            arr = arr.concat(subs);
        }
        return arr;
    }

    // تعبئة القائمة حسب البحث
    function renderList() {
        if (!listDiv) return;
        listDiv.innerHTML = '';
        let arr = filteredFolders;
        if (arr.length === 0) {
            listDiv.innerHTML = '<div style="text-align:center;color:#e53935;font-size:1.08em;">لا يوجد نتائج</div>';
            return;
        }
        arr.forEach((f) => {
            const btn = document.createElement('button');
            btn.textContent = f.name;
            btn.style.cssText = `
                display:block;width:100%;margin-bottom:8px;background:linear-gradient(90deg,#1976d2 60%,#2196f3 100%);
                color:#fff;border:none;border-radius:8px;padding:8px 12px;font-size:1.08em;font-weight:bold;cursor:pointer;
                font-family:'Cairo','Tajawal','Segoe UI',Arial,sans-serif;direction:rtl;
            `;
            btn.onclick = function() {
                closeMoveModal();
                callback(f.id);
            };
            listDiv.appendChild(btn);
        });
    }

    // إنشاء أو إظهار النافذة
    async function openModal() {
        // أنشئ النافذة إذا لم تكن موجودة
        modal = document.getElementById('move-modal-bg');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'move-modal-bg';
            modal.style.cssText = `
                display:flex;position:fixed;top:0;left:0;width:100vw;height:100vh;
                background:#0007;z-index:3000;justify-content:center;align-items:center;
            `;
            modal.innerHTML = `
                <div id="move-modal" style="background:#fff;padding:28px 22px 18px 22px;border-radius:16px;max-width:370px;box-shadow:0 4px 24px #1976d222;min-width:320px;">
                    <h3 style="text-align:center;color:#1976d2;font-size:1.15em;font-weight:bold;margin-top:0;">اختر المجلد الوجهة</h3>
                    <div id="move-modal-search-row" style="margin-bottom:10px;">
                        <input id="move-modal-search" type="text" placeholder="بحث..." style="width:100%;padding:7px 12px;font-size:1.08em;border-radius:8px;border:1.5px solid #e3eaf2;margin-bottom:4px;font-family:'Cairo','Tajawal','Segoe UI',Arial,sans-serif;direction:rtl;">
                    </div>
                    <div id="move-modal-loader" style="display:flex;justify-content:center;align-items:center;margin-bottom:18px;">
                        <span class="mini-loader" style="width:32px;height:32px;border:4px solid #e3eaf2;border-top:4px solid #1976d2;border-radius:50%;display:inline-block;animation:spin 1s linear infinite;"></span>
                    </div>
                    <div id="move-modal-list" style="margin-bottom:18px;max-height:260px;overflow-y:auto;"></div>
                    <div style="text-align:center;">
                        <button id="move-modal-cancel-btn" style="padding:6px 18px;">إلغاء</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.querySelector('#move-modal-cancel-btn').onclick = function() {
                closeMoveModal();
            };
        }
        modal.style.display = 'flex';
        listDiv = modal.querySelector('#move-modal-list');
        searchInput = modal.querySelector('#move-modal-search');
        loaderDiv = modal.querySelector('#move-modal-loader');
        // أظهر دائرة التحميل
        loaderDiv.style.display = 'flex';
        listDiv.style.display = 'none';

        // جلب المجلدات
        allFolders = await fetchFolders(null, '');
        filteredFolders = allFolders;
        // أخفِ دائرة التحميل وأظهر القائمة
        loaderDiv.style.display = 'none';
        listDiv.style.display = 'block';
        renderList();

        // البحث
        searchInput.value = '';
        searchInput.oninput = function() {
            const val = searchInput.value.trim();
            if (!val) {
                filteredFolders = allFolders;
            } else {
                filteredFolders = allFolders.filter(f => f.name.includes(val));
            }
            renderList();
        };
        searchInput.focus();
    }
    openModal();
}
function closeMoveModal() {
    const modal = document.getElementById('move-modal-bg');
    if (modal) modal.style.display = 'none';
}

// نافذة الترتيب اليدوي
function showSortModal() {
    getCurrentOrder().then(arr => {
        let modal = document.getElementById('sort-modal-bg');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'sort-modal-bg';
            modal.style.cssText = `
                display:flex;position:fixed;top:0;left:0;width:100vw;height:100vh;
                background:#0007;z-index:3500;justify-content:center;align-items:center;
            `;
            modal.innerHTML = `
                <div id="sort-modal" style="background:#fff;padding:28px 22px 18px 22px;border-radius:16px;max-width:370px;box-shadow:0 4px 24px #1976d222;min-width:320px;">
                    <h3 style="text-align:center;color:#1976d2;font-size:1.15em;font-weight:bold;margin-top:0;">ترتيب العناصر</h3>
                    <div id="sort-modal-list" style="margin-bottom:18px;max-height:320px;overflow-y:auto;"></div>
                    <div style="text-align:center;">
                        <button id="sort-modal-save-btn" style="padding:6px 18px;">حفظ</button>
                        <button id="sort-modal-cancel-btn" style="padding:6px 18px;">إلغاء</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.querySelector('#sort-modal-cancel-btn').onclick = function() {
                closeSortModal();
            };
        }
        modal.style.display = 'flex';

        // بناء القائمة القابلة للسحب
        const listDiv = modal.querySelector('#sort-modal-list');

        // دالة لإعادة بناء القائمة بعد كل سحب
        function renderList() {
            listDiv.innerHTML = '';
            arr.forEach((item, idx) => {
                const row = document.createElement('div');
                row.className = 'sort-row';
                row.draggable = true;
                row.style.cssText = `
                    display:flex;align-items:center;gap:8px;padding:8px 12px;margin-bottom:6px;
                    background:#f7fafd;border-radius:8px;cursor:grab;font-size:1.08em;
                    font-family:'Cairo','Tajawal','Segoe UI',Arial,sans-serif;direction:rtl;
                    border:1.5px solid #e3eaf2;
                `;
                row.dataset.idx = idx;
                row.innerHTML = `
                    <span style="font-size:1.2em;">&#9776;</span>
                    <span style="color:${item.type==='folder'?'#1976d2':item.type==='video'?'#e53935':'#ff6f00'};">
                        ${item.type==='folder'?'[مجلد]':item.type==='video'?'[فيديو]':'[ملف]'}
                    </span>
                    <span style="flex:1;">${item.name}</span>
                `;
                listDiv.appendChild(row);
            });

            // منطق السحب والإفلات المتعدد
            let dragIdx = null;
            listDiv.querySelectorAll('.sort-row').forEach(row => {
                row.addEventListener('dragstart', function(e) {
                    dragIdx = Number(row.dataset.idx);
                    row.style.opacity = '0.5';
                });
                row.addEventListener('dragend', function(e) {
                    row.style.opacity = '1';
                });
                row.addEventListener('dragover', function(e) {
                    e.preventDefault();
                    row.style.background = '#e3f0ff';
                });
                row.addEventListener('dragleave', function(e) {
                    row.style.background = '#f7fafd';
                });
                row.addEventListener('drop', function(e) {
                    e.preventDefault();
                    row.style.background = '#f7fafd';
                    const dropIdx = Number(row.dataset.idx);
                    if (dragIdx === null || dragIdx === dropIdx) return;
                    // نقل العنصر من dragIdx إلى dropIdx
                    const moved = arr.splice(dragIdx, 1)[0];
                    arr.splice(dropIdx, 0, moved);
                    renderList(); // إعادة بناء القائمة بعد كل سحب
                });
            });
        }

        renderList();

        // زر الحفظ
        modal.querySelector('#sort-modal-save-btn').onclick = async function() {
            const btn = this;
            withButtonLoader(btn, async () => {
                for (let i = 0; i < arr.length; i++) {
                    const item = arr[i];
                    if (item.type === 'folder') {
                        await db.collection('folders').doc(item.id).update({order: i});
                    } else {
                        await db.collection('items').doc(item.id).update({order: i});
                    }
                }
                closeSortModal();
                loadFolders();
            });
        };
    });
}

// زر الترتيب
document.getElementById('sort-btn').onclick = function(e) {
    const btn = this;
    withButtonLoader(btn, async () => {
        showSortModal();
    });
}

// تعديل ترتيب العرض ليأخذ order إذا وجد
// في loadFolders، عند ترتيب folderDocs و itemsArr:
folderDocs.sort((a, b) => {
    const aOrder = a.data().order ?? null;
    const bOrder = b.data().order ?? null;
    if (aOrder !== null && bOrder !== null) return aOrder - bOrder;
    // fallback: حسب createdAt
    const aTime = a.data().createdAt && a.data().createdAt.seconds ? a.data().createdAt.seconds : 0;
    const bTime = b.data().createdAt && b.data().createdAt.seconds ? b.data().createdAt.seconds : 0;
    return aTime - bTime;
});
itemsArr.sort((a, b) => {
    const aOrder = a.data.order ?? null;
    const bOrder = b.data.order ?? null;
    if (aOrder !== null && bOrder !== null) return aOrder - bOrder;
    // fallback: حسب createdAt
    const aTime = a.data.createdAt && a.data.createdAt.seconds ? a.data.createdAt.seconds : 0;
    const bTime = b.data.createdAt && b.data.createdAt.seconds ? b.data.createdAt.seconds : 0;
    return aTime - bTime;
});

// دالة تعيد ترتيب العناصر كما هو ظاهر حالياً
function getCurrentOrder() {
    // جلب المجلدات والعناصر بنفس ترتيب العرض الحالي
    let arr = [];
    // نفس ترتيب folderDocs و itemsArr في loadFolders
    let folderQuery = db.collection('folders')
        .where('parentId', '==', currentParentId)
        .where('userId', '==', currentUserId);
    let itemQuery = db.collection('items')
        .where('parentId', '==', currentParentId)
        .where('userId', '==', currentUserId);

    return Promise.all([folderQuery.get(), itemQuery.get()]).then(([folderSnap, itemSnap]) => {
        let folderDocs = folderSnap.docs;
        folderDocs.sort((a, b) => {
            const aOrder = a.data().order ?? null;
            const bOrder = b.data().order ?? null;
            if (aOrder !== null && bOrder !== null) return aOrder - bOrder;
            const aTime = a.data().createdAt && a.data().createdAt.seconds ? a.data().createdAt.seconds : 0;
            const bTime = b.data().createdAt && b.data().createdAt.seconds ? b.data().createdAt.seconds : 0;
            return aTime - bTime;
        });
        folderDocs.forEach(doc => {
            arr.push({
                id: doc.id,
                type: 'folder',
                name: doc.data().name,
                order: doc.data().order ?? 0
            });
        });
        let itemsArr = [];
        itemSnap.forEach(doc => {
            itemsArr.push({ doc, data: doc.data() });
        });
        itemsArr.sort((a, b) => {
            const aOrder = a.data.order ?? null;
            const bOrder = b.data.order ?? null;
            if (aOrder !== null && bOrder !== null) return aOrder - bOrder;
            const aTime = a.data.createdAt && a.data.createdAt.seconds ? a.data.createdAt.seconds : 0;
            const bTime = b.data.createdAt && b.data.createdAt.seconds ? b.data.createdAt.seconds : 0;
            return aTime - bTime;
        });
        itemsArr.forEach(({doc, data}) => {
            arr.push({
                id: doc.id,
                type: data.type,
                name: data.name,
                order: data.order ?? 0
            });
        });
        return arr;
    });
}

// نافذة الترتيب اليدوي (تستخدم ترتيب العرض الحالي)
function showSortModal() {
    getCurrentOrder().then(arr => {
        let modal = document.getElementById('sort-modal-bg');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'sort-modal-bg';
            modal.style.cssText = `
                display:flex;position:fixed;top:0;left:0;width:100vw;height:100vh;
                background:#0007;z-index:3500;justify-content:center;align-items:center;
            `;
            modal.innerHTML = `
                <div id="sort-modal" style="background:#fff;padding:28px 22px 18px 22px;border-radius:16px;max-width:370px;box-shadow:0 4px 24px #1976d222;min-width:320px;">
                    <h3 style="text-align:center;color:#1976d2;font-size:1.15em;font-weight:bold;margin-top:0;">ترتيب العناصر</h3>
                    <div id="sort-modal-list" style="margin-bottom:18px;max-height:320px;overflow-y:auto;"></div>
                    <div style="text-align:center;">
                        <button id="sort-modal-save-btn" style="padding:6px 18px;">حفظ</button>
                        <button id="sort-modal-cancel-btn" style="padding:6px 18px;">إلغاء</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.querySelector('#sort-modal-cancel-btn').onclick = function() {
                closeSortModal();
            };
        }
        modal.style.display = 'flex';

        // بناء القائمة القابلة للسحب
        const listDiv = modal.querySelector('#sort-modal-list');

        // دالة لإعادة بناء القائمة بعد كل سحب
        function renderList() {
            listDiv.innerHTML = '';
            arr.forEach((item, idx) => {
                const row = document.createElement('div');
                row.className = 'sort-row';
                row.draggable = true;
                row.style.cssText = `
                    display:flex;align-items:center;gap:8px;padding:8px 12px;margin-bottom:6px;
                    background:#f7fafd;border-radius:8px;cursor:grab;font-size:1.08em;
                    font-family:'Cairo','Tajawal','Segoe UI',Arial,sans-serif;direction:rtl;
                    border:1.5px solid #e3eaf2;
                `;
                row.dataset.idx = idx;
                row.innerHTML = `
                    <span style="font-size:1.2em;">&#9776;</span>
                    <span style="color:${item.type==='folder'?'#1976d2':item.type==='video'?'#e53935':'#ff6f00'};">
                        ${item.type==='folder'?'[مجلد]':item.type==='video'?'[فيديو]':'[ملف]'}
                    </span>
                    <span style="flex:1;">${item.name}</span>
                `;
                listDiv.appendChild(row);
            });

            // منطق السحب والإفلات المتعدد
            let dragIdx = null;
            listDiv.querySelectorAll('.sort-row').forEach(row => {
                row.addEventListener('dragstart', function(e) {
                    dragIdx = Number(row.dataset.idx);
                    row.style.opacity = '0.5';
                });
                row.addEventListener('dragend', function(e) {
                    row.style.opacity = '1';
                });
                row.addEventListener('dragover', function(e) {
                    e.preventDefault();
                    row.style.background = '#e3f0ff';
                });
                row.addEventListener('dragleave', function(e) {
                    row.style.background = '#f7fafd';
                });
                row.addEventListener('drop', function(e) {
                    e.preventDefault();
                    row.style.background = '#f7fafd';
                    const dropIdx = Number(row.dataset.idx);
                    if (dragIdx === null || dragIdx === dropIdx) return;
                    // نقل العنصر من dragIdx إلى dropIdx
                    const moved = arr.splice(dragIdx, 1)[0];
                    arr.splice(dropIdx, 0, moved);
                    renderList(); // إعادة بناء القائمة بعد كل سحب
                });
            });
        }

        renderList();

        // زر الحفظ
        modal.querySelector('#sort-modal-save-btn').onclick = async function() {
            const btn = this;
            withButtonLoader(btn, async () => {
                for (let i = 0; i < arr.length; i++) {
                    const item = arr[i];
                    if (item.type === 'folder') {
                        await db.collection('folders').doc(item.id).update({order: i});
                    } else {
                        await db.collection('items').doc(item.id).update({order: i});
                    }
                }
                closeSortModal();
                loadFolders();
            });
        };
    });
}

function closeSortModal() {
    const modal = document.getElementById('sort-modal-bg');
    if (modal) modal.style.display = 'none';
}

// Helper: Format Firestore timestamp to "day/month/year"
function formatDate(ts) {
    if (!ts || !ts.seconds) return '';
    const d = new Date(ts.seconds * 1000);
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

//# sourceMappingURL=file-manager.js.map
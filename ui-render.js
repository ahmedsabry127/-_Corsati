// Render breadcrumb navigation
    function renderBreadcrumb() {
        const breadcrumb = document.getElementById('breadcrumb');
        breadcrumb.innerHTML = '';
        let path = [{id: null, name: 'الرئيسية'}].concat(currentPath);

        // --- إضافة زر رجوع رسومي ---
        if (currentPath.length > 0) {
            const backBtn = document.createElement('span');
           backBtn.innerHTML = `
  <div style="width: 36px; height: 36px; background-color: rgba(68, 120, 183, 1); border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
    <svg width="24" height="24" viewBox="0 0 24 24">
      <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="#711883ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>
`;
            backBtn.style.marginLeft = '8px';
            backBtn.style.cursor = 'pointer';
            backBtn.title = 'رجوع';
            backBtn.onclick = () => {
                if (currentPath.length > 0) {
                    currentPath.pop();
                    currentParentId = currentPath.length > 0 ? currentPath[currentPath.length-1].id : null;
                    loadFolders();
                }
            };
            breadcrumb.appendChild(backBtn);
        }
        // --- نهاية الإضافة ---

        path.forEach((folder, idx) => {
            const span = document.createElement('span');
            span.textContent = folder.name;
            span.style.cursor = 'pointer';
            span.style.fontFamily = "'Cairo', 'Tajawal', 'Segoe UI', Arial, sans-serif";
            span.style.direction = 'rtl';
            span.onclick = () => {
                currentPath = currentPath.slice(0, idx);
                currentParentId = folder.id;
                loadFolders();
            };
            breadcrumb.appendChild(span);
            if (idx < path.length - 1) {
                breadcrumb.appendChild(document.createTextNode(' / '));
            }
        });
    }

    // Show/hide loader
    function showLoader() {
        document.getElementById('loader').style.display = 'block';
    }
    function hideLoader() {
        document.getElementById('loader').style.display = 'none';
    }

    // Load folders and items in current directory (فلترة حسب userId)
    async function loadFolders() {
        renderBreadcrumb();
        showLoader();
        const foldersDiv = document.getElementById('folders');
        foldersDiv.innerHTML = '';
        if (!currentUserId) {
            hideLoader();
            return;
        }
        // Load folders (فقط للمستخدم الحالي)
        let folderQuery = db.collection('folders')
            .where('parentId', '==', currentParentId)
            .where('userId', '==', currentUserId);
        const folderSnap = await folderQuery.get();
        // Load items (videos/files) (فقط للمستخدم الحالي)
        let itemQuery = db.collection('items')
            .where('parentId', '==', currentParentId)
            .where('userId', '==', currentUserId);
        const itemSnap = await itemQuery.get();
        hideLoader();
        foldersDiv.innerHTML = '';

        // --- حساب أعداد الفيديوهات والملفات ومدة الفيديوهات داخل كل مجلد (جذرى أو فرعى) ---
        // جلب الفيديوهات فقط
        async function getCountsAndDurations(folderId, youtubeApiKey) {
            // 1. احصاء العناصر المباشرة داخل هذا المجلد
            const videosSnap = await db.collection('items')
                .where('parentId', '==', folderId)
                .where('userId', '==', currentUserId)
                .where('type', '==', 'video')
                .get();
            const filesSnap = await db.collection('items')
                .where('parentId', '==', folderId)
                .where('userId', '==', currentUserId)
                .where('type', '==', 'file')
                .get();

            // حساب مدة الفيديوهات
            let totalDuration = 0;
            const ytIds = [];
            const mp4Urls = [];
            videosSnap.forEach(doc => {
                const d = doc.data();
                if (isYouTubeUrl(d.url)) {
                    const vid = extractYouTubeId(d.url);
                    if (vid) ytIds.push(vid);
                } else if (isLiveStreamUrl(d.url) && /\.mp4$/i.test(d.url)) {
                    mp4Urls.push(d.url);
                }
            });

            // YouTube durations
            let ytDurations = {};
            if (ytIds.length && youtubeApiKey) {
                ytDurations = await fetchYouTubeDurations(ytIds, youtubeApiKey);
            }

            // MP4 durations
            let mp4Durations = [];
            if (mp4Urls.length) {
                mp4Durations = await Promise.all(mp4Urls.map(getMp4Duration));
            }

            // Sum durations
            let ytIdx = 0, mp4Idx = 0;
            videosSnap.forEach(doc => {
                const d = doc.data();
                if (isYouTubeUrl(d.url)) {
                    const vid = extractYouTubeId(d.url);
                    if (vid && ytDurations[vid]) totalDuration += ytDurations[vid];
                    ytIdx++;
                } else if (isLiveStreamUrl(d.url) && /\.mp4$/i.test(d.url)) {
                    if (mp4Durations[mp4Idx]) totalDuration += mp4Durations[mp4Idx];
                    mp4Idx++;
                }
                // Ignore other types (live streams, etc)
            });

            // 2. اجلب كل المجلدات الفرعية وكرر نفس الدالة عليها (بشكل متوازى)
            const subfoldersSnap = await db.collection('folders')
                .where('parentId', '==', folderId)
                .where('userId', '==', currentUserId)
                .get();

            // بدلاً من for-await المتسلسل، استخدم Promise.all للتوازى
            const subCountsArr = await Promise.all(
                subfoldersSnap.docs.map(subDoc =>
                    getCountsAndDurations(subDoc.id, youtubeApiKey)
                )
            );
            let subCounts = { videos: 0, files: 0, totalDuration: 0 };
            for (const sub of subCountsArr) {
                subCounts.videos += sub.videos;
                subCounts.files += sub.files;
                subCounts.totalDuration += sub.totalDuration;
            }

            // 3. اجمع النتائج
            return {
                videos: videosSnap.size + subCounts.videos,
                files: filesSnap.size + subCounts.files,
                totalDuration: totalDuration + subCounts.totalDuration
            };
        }
        // --- نهاية الحساب ---

        // --- جلب الأعداد والمدة لكل مجلد قبل العرض ---
        // تعديل هنا: رتب المجلدات الفرعية حسب createdAt (من الأقدم إلى الأحدث)
        let folderDocs = folderSnap.docs;
        // استبدل الترتيب ليأخذ order أولاً ثم createdAt
        folderDocs.sort((a, b) => {
            const aOrder = a.data().order;
            const bOrder = b.data().order;
            if (aOrder !== undefined && bOrder !== undefined) {
                return aOrder - bOrder;
            }
            // fallback: حسب createdAt
            const aTime = a.data().createdAt && a.data().createdAt.seconds ? a.data().createdAt.seconds : 0;
            const bTime = b.data().createdAt && b.data().createdAt.seconds ? b.data().createdAt.seconds : 0;
            return aTime - bTime;
        });
        // --- رسم الكروت والمجلدات الفرعية مباشرة مع دائرة تحميل للعدادات ---
        const folderCountDivs = []; // لكل مجلد: {countsDiv, doc, idx}
        folderDocs.forEach((doc, idx) => {
            const data = doc.data();
            if (currentParentId === null) {
                // كارت الكورس
                const card = document.createElement('div');
                card.className = 'course-card';
                card.style.fontFamily = "'Cairo', 'Tajawal', 'Segoe UI', Arial, sans-serif";
                card.style.direction = 'rtl';
                // صورة الكورس
                const img = document.createElement('img');
                img.className = 'course-card-img';
                img.src = data.courseImg && data.courseImg.trim() ? data.courseImg : 'صور/Photo.avif';
                img.style.cursor = 'pointer';
                img.onclick = (e) => {
                    e.stopPropagation();
                    if (img.src && img.src !== 'صور/Photo.avif') showImgPreview(img.src);
                };
                card.appendChild(img);
                // بادج الوقت (اختياري)
                if (data.courseDuration) {
                    const badge = document.createElement('div');
                    badge.className = 'course-card-badge';
                    badge.textContent = data.courseDuration;
                    card.appendChild(badge);
                }
                // جسم الكارت
                const body = document.createElement('div');
                body.className = 'course-card-body';
                body.style.cursor = 'pointer';
                body.onclick = () => {
                    currentPath.push({id: doc.id, name: data.name});
                    currentParentId = doc.id;
                    loadFolders();
                };
                // اسم الكورس
                const title = document.createElement('div');
                title.className = 'course-card-title';
                title.textContent = data.name || '';
                title.style.fontFamily = "'Cairo', 'Tajawal', 'Segoe UI', Arial, sans-serif";
                title.style.direction = 'rtl';
                body.appendChild(title);

                // --- إضافة تاريخ الإنشاء ---
                const dateDiv = document.createElement('div');
                dateDiv.style.color = '#888';
                dateDiv.style.fontSize = '1em';
                dateDiv.style.marginBottom = '4px';
                dateDiv.style.fontFamily = "'Cairo', 'Tajawal', 'Segoe UI', Arial, sans-serif";
                dateDiv.style.direction = 'rtl';
                dateDiv.textContent = formatDate(data.createdAt) ? `تاريخ الإنشاء: ${formatDate(data.createdAt)}` : '';
                body.appendChild(dateDiv);
                // --- نهاية الإضافة ---

                // وصف الكورس
                const desc = document.createElement('div');
                desc.className = 'course-card-desc';
                desc.textContent = data.courseInfo || '';
                desc.style.fontFamily = "'Cairo', 'Tajawal', 'Segoe UI', Arial, sans-serif";
                desc.style.direction = 'rtl';
                body.appendChild(desc);
                // --- عدادات الفيديوهات والملفات: دائرة تحميل مؤقتة ---
                const countsDiv = document.createElement('div');
                countsDiv.style.display = 'flex';
                countsDiv.style.gap = '12px';
                countsDiv.style.alignItems = 'center';
                countsDiv.style.margin = '8px 0 0 0';
                countsDiv.style.fontSize = '1.08em';
                countsDiv.innerHTML = `<span style="display:flex;align-items:center;gap:4px;">
                    <span class="mini-loader" style="width:22px;height:22px;border:3px solid #e3eaf2;border-top:3px solid #1976d2;border-radius:50%;display:inline-block;animation:spin 1s linear infinite;"></span>
                </span>`;
                body.appendChild(countsDiv);
                card.appendChild(body);
                // الفوتر: المحاضر والسعر
                const footer = document.createElement('div');
                footer.className = 'course-card-footer';
                // المحاضر
                const instructor = document.createElement('div');
                instructor.className = 'course-card-instructor';
                const instructorImgSrc = data.instructorImg && data.instructorImg.trim() ? data.instructorImg : 'صور/person.png';
                if (instructorImgSrc) {
                    const instructorImg = document.createElement('img');
                    instructorImg.className = 'course-card-instructor-img';
                    instructorImg.src = instructorImgSrc;
                    instructorImg.style.cursor = 'pointer';
                    instructorImg.onclick = (e) => {
                        e.stopPropagation();
                        if (instructorImg.src && instructorImg.src !== 'صور/person.png') showInstructorImgPreview(instructorImg.src);
                    };
                    instructor.appendChild(instructorImg);
                }
                const instructorName = document.createElement('span');
                instructorName.textContent = data.instructor || '';
                instructorName.style.fontFamily = "'Cairo', 'Tajawal', 'Segoe UI', Arial, sans-serif";
                instructorName.style.direction = 'rtl';
                instructor.appendChild(instructorName);
                footer.appendChild(instructor);
                // السعر
                const price = document.createElement('div');
                price.className = 'course-card-price';
                price.textContent = (data.coursePrice ? data.coursePrice + ' جنية' : '');
                price.style.fontFamily = "'Cairo', 'Tajawal', 'Segoe UI', Arial, sans-serif";
                price.style.direction = 'ltr';
                footer.appendChild(price);
                card.appendChild(footer);
                // أزرار الإجراءات
                const actions = document.createElement('div');
                actions.className = 'course-card-actions';
                // زر خصائص
                const propsBtn = document.createElement('button');
                propsBtn.textContent = 'خصائص';
                propsBtn.onclick = async (e) => {
                    e.stopPropagation();
                    const folderDoc = await db.collection('folders').doc(doc.id).get();
                    const d = folderDoc.data() || {};
                    openModal('root-props', {
                        id: doc.id,
                        instructor: d.instructor || '',
                        instructorImg: d.instructorImg || '',
                        courseImg: d.courseImg || '',
                        courseInfo: d.courseInfo || '',
                        coursePrice: d.coursePrice || '',
                        name: d.name || ''
                    });
                };
                actions.appendChild(propsBtn);
                // زر إعادة التسمية
                const renameBtn = document.createElement('button');
                // تعديل هنا:
                renameBtn.textContent = 'تعديل عنوان الكورس';
                renameBtn.onclick = (e) => {
                    e.stopPropagation();
                    withButtonLoader(renameBtn, async () => {
                        openModal('edit-folder', {id: doc.id, name: data.name});
                    });
                };
                actions.appendChild(renameBtn);
                // زر حذف
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'حذف';
                deleteBtn.onclick = async (e) => {
                    e.stopPropagation();
                    withButtonLoader(deleteBtn, async () => {
                        if (confirm('هل أنت متأكد من حذف هذا المجلد وكل محتوياته؟')) {
                            await deleteFolderRecursive(doc.id);
                            loadFolders();
                        }
                    });
                };
                actions.appendChild(deleteBtn);
                card.appendChild(actions);
                foldersDiv.appendChild(card);
                folderCountDivs.push({countsDiv, doc, idx});
            } else {
                // مجلد فرعى
                const div = document.createElement('div');
                div.className = 'folder subfolder';
                div.style.fontFamily = "'Cairo', 'Tajawal', 'Segoe UI', Arial, sans-serif";
                div.style.direction = 'rtl';
                div.style.cursor = 'pointer';
                div.style.flexWrap = 'wrap';
                div.style.padding = '0 14px'; // تقليل البادينج الرأسي
                div.style.minHeight = 'unset'; // لا يوجد ارتفاع ثابت
                div.onclick = (e) => {
                    if (e.target.tagName === 'BUTTON') return;
                    currentPath.push({id: doc.id, name: data.name});
                    currentParentId = doc.id;
                    loadFolders();
                };

                // صف أفقي للأيقونة واسم المجلد والمعلومات
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.gap = '10px';
                row.style.flex = '1 1 0';
                row.style.minWidth = '0';

                // --- تعديل هنا: استخدم نفس الكلاس والخصائص للأيقونة ---
                const icon = document.createElement('img');
                icon.className = 'folder-icon'; // نفس الكلاس المستخدم للملف والفيديو
                icon.src = 'صور/folder.png';
                icon.alt = 'مجلد';
                // لا تضع style.width/style.height هنا، اترك التحكم للـ CSS فقط
                row.appendChild(icon);
                // --- نهاية التعديل ---

                const nameInfoWrapper = document.createElement('div');
                nameInfoWrapper.style.display = 'flex';
                nameInfoWrapper.style.flexDirection = 'column';
                nameInfoWrapper.style.flex = '1 1 0';
                nameInfoWrapper.style.minWidth = '0';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'folder-name';
                nameSpan.textContent = data.name;
                nameSpan.style.fontFamily = "'Cairo', 'Tajawal', 'Segoe UI', Arial, sans-serif";
                nameSpan.style.direction = 'rtl';
                nameSpan.style.minWidth = '0';
                nameSpan.style.wordBreak = 'break-word';
                nameSpan.style.flex = '1 1 0';
                nameSpan.style.maxWidth = '100%';
                nameSpan.style.overflowWrap = 'anywhere';
                nameSpan.style.fontSize = '1.13em';
                nameSpan.style.color = '#0d47a1';
                nameSpan.style.padding = '10px 0'; // padding رأسي فقط حول الاسم
                nameInfoWrapper.appendChild(nameSpan);

                // --- إضافة تاريخ الإنشاء ---
                const dateDiv = document.createElement('div');
                dateDiv.style.color = '#888';
                dateDiv.style.fontSize = '0.98em';
                dateDiv.style.marginBottom = '2px';
                dateDiv.style.fontFamily = "'Cairo', 'Tajawal', 'Segoe UI', Arial, sans-serif";
                dateDiv.style.direction = 'rtl';
                dateDiv.textContent = formatDate(data.createdAt) ? `تاريخ الإنشاء: ${formatDate(data.createdAt)}` : '';
                nameInfoWrapper.appendChild(dateDiv);
                // --- نهاية الإضافة ---

                if (data.folderInfo) {
                    const infoDiv = document.createElement('div');
                    infoDiv.style.color = '#444';
                    infoDiv.style.fontSize = '1.08em';
                    infoDiv.style.margin = '0';
                    infoDiv.style.fontFamily = "'Cairo', 'Tajawal', 'Segoe UI', Arial, sans-serif";
                    infoDiv.style.direction = 'rtl';
                    infoDiv.textContent = data.folderInfo;
                    nameInfoWrapper.appendChild(infoDiv);
                }

                // عدادات الفيديوهات والملفات: دائرة تحميل مؤقتة
                const countsDiv = document.createElement('div');
                countsDiv.style.display = 'flex';
                countsDiv.style.gap = '10px';
                countsDiv.style.alignItems = 'center';
                countsDiv.style.margin = '0 0 0 0';
                countsDiv.style.fontSize = '0.98em';
                countsDiv.innerHTML = `<span style="display:flex;align-items:center;gap:4px;">
                    <span class="mini-loader" style="width:18px;height:18px;border:3px solid #e3eaf2;border-top:3px solid #1976d2;border-radius:50%;display:inline-block;animation:spin 1s linear infinite;"></span>
                </span>`;
                nameInfoWrapper.appendChild(countsDiv);

                row.appendChild(nameInfoWrapper);
                div.appendChild(row);

                // Actions
                const actions = document.createElement('span');
                actions.className = 'actions';
                actions.style.display = 'flex';
                actions.style.flexWrap = 'wrap';
                actions.style.gap = '6px';
                actions.style.alignItems = 'center';
                actions.style.marginTop = '6px';
                const renameBtn = document.createElement('button');
                renameBtn.textContent = 'إعادة تسمية';
                renameBtn.onclick = (e) => {
                    e.stopPropagation();
                    withButtonLoader(renameBtn, async () => {
                        openModal('edit-folder', {id: doc.id, name: data.name});
                    });
                };
                actions.appendChild(renameBtn);
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'حذف';
                deleteBtn.onclick = async (e) => {
                    e.stopPropagation();
                    withButtonLoader(deleteBtn, async () => {
                        if (confirm('هل أنت متأكد من حذف هذا المجلد وكل محتوياته؟')) {
                            await deleteFolderRecursive(doc.id);
                            loadFolders();
                        }
                    });
                };
                actions.appendChild(deleteBtn);
                const moveBtn = document.createElement('button');
                moveBtn.textContent = 'نقل';
                moveBtn.onclick = async (e) => {
                    e.stopPropagation();
                    withButtonLoader(moveBtn, async () => {
                        showMoveModal(doc.id, async (destId) => {
                            if (destId && destId !== doc.id) {
                                await db.collection('folders').doc(doc.id).update({parentId: destId});
                                loadFolders();
                            }
                        });
                    });
                };
                actions.appendChild(moveBtn);
                div.appendChild(actions);
                foldersDiv.appendChild(div);
                folderCountDivs.push({countsDiv, doc, idx});
            }
        });

        // --- بعد رسم كل الكروت، احسب الإحصائيات وحدث كل كارت عند اكتمال الحساب ---
        folderCountDivs.forEach(async ({countsDiv, doc}) => {
            const data = doc.data();
            let youtubeApiKey = '';
            if (currentParentId === null) {
                youtubeApiKey = data.youtubeApiKey || '';
            }
            if (currentParentId !== null && !youtubeApiKey) {
                // ابحث عن الجذر في المسار الحالي
                if (Array.isArray(currentPath) && currentPath.length > 0) {
                    const rootId = currentPath[0].id;
                    if (rootId) {
                        try {
                            const rootDoc = await db.collection('folders').doc(rootId).get();
                            if (rootDoc.exists) {
                                youtubeApiKey = rootDoc.data().youtubeApiKey || '';
                            }
                        } catch (e) {}
                    }
                }
            }
            const counts = await getCountsAndDurations(doc.id, youtubeApiKey);
            let durationStr = counts.totalDuration > 0 ? ` (${formatDuration(counts.totalDuration)})` : '';
            countsDiv.innerHTML = `
                <span style="display:flex;align-items:center;gap:4px;color:#e53935;background:#ffebee;border-radius:7px;padding:2px 10px 2px 8px;">
                    <img src="صور/video.png" alt="فيديو" style="width:22px;height:22px;vertical-align:middle;">
                    <span>${counts.videos} فيديو${durationStr}</span>
                </span>
                <span style="display:flex;align-items:center;gap:4px;color:#ff6f00;background:#fffde7;border-radius:7px;padding:2px 10px 2px 8px;">
                    <img src="صور/file.png" alt="ملف" style="width:22px;height:22px;vertical-align:middle;">
                    <span>${counts.files} ملف</span>
                </span>
            `;
        });
        // Render items (videos/files)
        // --- تعديل هنا: دمج كل العناصر وترتيبهم حسب createdAt ---
        const itemsArr = [];
        itemSnap.forEach(doc => {
            itemsArr.push({ doc, data: doc.data() });
        });
        // رتب حسب createdAt (من الأقدم إلى الأحدث)
        itemsArr.sort((a, b) => {
            const aOrder = a.data.order ?? null;
            const bOrder = b.data.order ?? null;
            if (aOrder !== null && bOrder !== null) return aOrder - bOrder;
            // fallback: حسب createdAt
            const aTime = a.data.createdAt && a.data.createdAt.seconds ? a.data.createdAt.seconds : 0;
            const bTime = b.data.createdAt && b.data.createdAt.seconds ? b.data.createdAt.seconds : 0;
            return aTime - bTime;
        });
        // اعرض العناصر بالترتيب الجديد
        for (const { doc, data } of itemsArr) {
            // اختر الكلاس حسب النوع
            let itemClass = data.type === 'video' ? 'video-item' : 'file-item';
            const div = document.createElement('div');
            div.className = itemClass;
            div.style.fontFamily = "'Cairo', 'Tajawal', 'Segoe UI', Arial, sans-serif";
            div.style.direction = 'rtl';
            div.style.cursor = 'pointer';
            div.onclick = (e) => {
                if (e.target.tagName === 'BUTTON') return;
                if (data.type === 'video') {
                    if (isYouTubeUrl(data.url)) {
                        showYouTubeModal(data.url);
                    } else if (isLiveStreamUrl(data.url)) {
                        showLiveVideoModal(data.url);
                    } else {
                    }
                } else {
                    if (isGoogleDrivePdfUrl(data.url)) {
                        showGoogleDrivePdfModal(data.url);
                    }
                }
            };
            // اسم العنصر مع الأيقونة (كصورة خارج الاسم مثل المجلد)
            const nameInfoWrapper = document.createElement('div');
            nameInfoWrapper.style.display = 'flex';
            nameInfoWrapper.style.flexDirection = 'column';
            nameInfoWrapper.style.flex = '1 1 180px';

            // صورة الأيقونة (خارج الاسم)
            const icon = document.createElement('img');
            icon.className = data.type === 'video' ? 'video-icon' : 'file-icon';
            icon.src = data.type === 'video' ? 'صور/video.png' : 'صور/file.png';
            icon.alt = data.type === 'video' ? 'فيديو' : 'ملف';
            // تم نقل خصائص الحجم والعرض إلى CSS فقط

            // اسم العنصر
            const nameSpan = document.createElement('span');
            nameSpan.className = 'folder-name';
            nameSpan.style.fontFamily = "'Cairo', 'Tajawal', 'Segoe UI', Arial, sans-serif";
            nameSpan.style.direction = 'rtl';
            nameSpan.style.minWidth = '0';
            nameSpan.style.wordBreak = 'break-word';
            nameSpan.style.flex = '1 1 180px';
            nameSpan.style.maxWidth = '100%';
            nameSpan.style.overflowWrap = 'anywhere';
            nameSpan.style.display = 'inline-block';

            // --- إضافة: مدة الفيديو ---
let durationSpan = null;
if (data.type === 'video') {
    durationSpan = document.createElement('span');
    durationSpan.style.color = '#1976d2';
    durationSpan.style.fontSize = '0.95em';
    durationSpan.style.marginRight = '8px';
    durationSpan.style.display = 'inline-flex';
    durationSpan.style.alignItems = 'center';

    // رمز الساعة فقط بدون نص
    const clockIcon = document.createElement('span');
    clockIcon.textContent = '⏱';
    clockIcon.style.marginLeft = '2px';
    durationSpan.appendChild(clockIcon);

    // سيتم تعبئتها لاحقاً بالمدة
    const durationText = document.createElement('span');
    durationText.textContent = '';
    durationSpan.appendChild(durationText);
}

            // --- نهاية الإضافة ---

            // اسم العنصر كرابط أو سبان
            if (data.type === 'video' && isYouTubeUrl(data.url)) {
                const label = document.createElement('span');
                label.textContent = data.name;
                label.style.color = '#e53935';
                label.style.fontFamily = "'Cairo', 'Tajawal', 'Segoe UI', Arial, sans-serif";
                label.style.direction = 'ltr';
                label.style.cursor = 'pointer';
                label.onclick = (e) => {
                    e.stopPropagation();
                    showYouTubeModal(data.url);
                };
                nameSpan.appendChild(label);
            } else {
                const label = document.createElement('span');
                label.textContent = data.name;
                label.style.color = data.type === 'video' ? '#e53935' : '#ff6f00';
                label.style.fontFamily = "'Cairo', 'Tajawal', 'Segoe UI', Arial, sans-serif";
                label.style.direction = 'ltr';
                label.style.cursor = 'pointer';
                nameSpan.appendChild(label);
            }

            // --- إضافة: إلحاق مدة الفيديو بجانب الاسم ---
            if (durationSpan) {
                nameSpan.appendChild(document.createTextNode(' '));
                nameSpan.appendChild(durationSpan);

                // جلب مدة الفيديو
                if (isYouTubeUrl(data.url)) {
                    // جلب API key من الجذر
                    let youtubeApiKey = '';
                    if (Array.isArray(currentPath) && currentPath.length > 0) {
                        const rootId = currentPath[0].id;
                        if (rootId) {
                            try {
                                const rootDoc = await db.collection('folders').doc(rootId).get();
                                if (rootDoc.exists) {
                                    youtubeApiKey = rootDoc.data().youtubeApiKey || '';
                                }
                            } catch (e) {}
                        }
                    }
                    const vid = extractYouTubeId(data.url);
                    if (vid && youtubeApiKey) {
                        durationSpan.querySelector('span:last-child').textContent = '...';
                        fetchYouTubeDurations([vid], youtubeApiKey).then(durations => {
                            if (durations[vid]) {
                                durationSpan.querySelector('span:last-child').textContent = formatDuration(durations[vid]);
                            } else {
                                durationSpan.querySelector('span:last-child').textContent = '';
                            }
                        });
                    }
                } else if (isLiveStreamUrl(data.url) && /\.mp4$/i.test(data.url)) {
                    durationSpan.querySelector('span:last-child').textContent = '...';
                    getMp4Duration(data.url).then(dur => {
                        if (dur > 0) {
                            durationSpan.querySelector('span:last-child').textContent = formatDuration(dur);
                        } else {
                            durationSpan.querySelector('span:last-child').textContent = '';
                        }
                    });
                }
            }
            // --- نهاية الإضافة ---

            // صف أفقي للأيقونة والاسم
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.appendChild(icon);
            row.appendChild(nameSpan);

            nameInfoWrapper.appendChild(row);

            // --- معلومات إضافية ---
            if (data.itemInfo) {
                const infoDiv = document.createElement('div');
                infoDiv.style.color = '#444';
                infoDiv.style.fontSize = '1.08em';
                infoDiv.style.margin = '6px 0 0 0';
                infoDiv.style.fontFamily = "'Cairo', 'Tajawal', 'Segoe UI', Arial, sans-serif";
                infoDiv.style.direction = 'rtl';
                infoDiv.textContent = data.itemInfo;
                nameInfoWrapper.appendChild(infoDiv);
            }
            // --- نهاية الإضافة ---

            // --- إضافة تاريخ الإنشاء ---
            const dateDiv = document.createElement('div');
            dateDiv.style.color = '#888';
            dateDiv.style.fontSize = '0.98em';
            dateDiv.style.marginBottom = '2px';
            dateDiv.style.fontFamily = "'Cairo', 'Tajawal', 'Segoe UI', Arial, sans-serif";
            dateDiv.style.direction = 'rtl';
            dateDiv.textContent = formatDate(data.createdAt) ? `تاريخ الإنشاء: ${formatDate(data.createdAt)}` : '';
            nameInfoWrapper.appendChild(dateDiv);
            // --- نهاية الإضافة ---

            div.appendChild(nameInfoWrapper);

            // Actions
            const actions = document.createElement('span');
            actions.className = 'actions';
            actions.style.display = 'flex';
            actions.style.flexWrap = 'wrap';
            actions.style.gap = '6px';
            actions.style.alignItems = 'center';
            actions.style.marginTop = '6px';
            // Rename (edit name and url)
            const renameBtn = document.createElement('button');
            renameBtn.textContent = 'تعديل';
            renameBtn.onclick = (e) => {
                e.stopPropagation();
                withButtonLoader(renameBtn, async () => {
                    openModal('edit-item', {id: doc.id, name: data.name, url: data.url, type: data.type});
                });
            };
            actions.appendChild(renameBtn);
            // Delete
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'حذف';
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                withButtonLoader(deleteBtn, async () => {
                    if (confirm('هل أنت متأكد من حذف هذا العنصر؟')) {
                        await db.collection('items').doc(doc.id).delete();
                        loadFolders();
                    }
                });
            };
            actions.appendChild(deleteBtn);
            // Move
            const moveBtn = document.createElement('button');
            moveBtn.textContent = 'نقل';
            moveBtn.onclick = async (e) => {
                e.stopPropagation();
                withButtonLoader(moveBtn, async () => {
                    showMoveModal(null, async (destId) => {
                        if (destId && destId !== currentParentId) {
                            await db.collection('items').doc(doc.id).update({parentId: destId});
                            loadFolders();
                        }
                    });
                });
            };
            actions.appendChild(moveBtn);
            div.appendChild(actions);
            foldersDiv.appendChild(div);
        }
    }

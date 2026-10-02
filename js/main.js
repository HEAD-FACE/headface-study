// HEADFACE STUDY - Core Javascript with Barba.js & Smooth Transitions

// ความสูงของพื้นที่สีเขียวมิ้น (Header Background Shell: #mainBlueBg) ในแต่ละหน้า
// ปรับให้อยู่ในตำแหน่งที่พอดี ครอบคลุมกล่องข้อมูลตามที่ผู้ใช้กำหนด
const HEADER_HEIGHTS = {
  'home': 310,      // ปรับเพิ่มอีก 5px เป็น 310px ให้ครอบคลุมการ์ดทั้งหมดอย่างพอดีตามที่ผู้ใช้กำหนด
  'subject': 92,     // ปรับเป็น 92px ตามที่ผู้ใช้กำหนด
  'progress': 235    // ปรับเป็น 235px ตามที่ผู้ใช้กำหนด
};

// 🖼️ Function จัดการ Fallback และตรวจจับภาพพื้นหลังการ์ดรายวิชาใน assets/ อัตโนมัติ (เน้น .webp)
window.handleCardImgError = function(img, id, altName) {
  if (!img) return;
  const step = parseInt(img.dataset.errStep || '0', 10);
  img.dataset.errStep = step + 1;
  
  if (step === 0) {
    // 1. ลองหาชื่อตัวเลขเดี่ยว .webp เช่น assets/1.webp
    img.src = `assets/${id}.webp`;
  } else if (step === 1 && altName) {
    // 2. ลองหาชื่อภาษาอังกฤษ .webp เช่น assets/science-basic.webp
    img.src = `assets/${altName}.webp`;
  } else if (step === 2) {
    // 3. ลองหา .png เช่น assets/subject-${id}.png
    img.src = `assets/subject-${id}.png`;
  } else if (step === 3) {
    // 4. ลองหา .jpg เช่น assets/subject-${id}.jpg
    img.src = `assets/subject-${id}.jpg`;
  } else if (step === 4) {
    // 5. ลองหาเลขเดี่ยว .png หรือ .jpg
    img.src = `assets/${id}.png`;
  } else {
    // หากยังไม่มีภาพใน assets/ ให้ซ่อนแท็ก <img> เพื่อแสดงพื้นหลัง Gradient เนี้ยบๆ แทน
    img.style.display = 'none';
  }
};

// แปลง href เป็น namespace
function getNamespaceFromHref(href) {
  if (!href) return 'home';
  if (href.includes('subject.html')) return 'subject';
  if (href.includes('progress.html')) return 'progress';
  if (href.includes('index.html') || href === '/' || href.endsWith('/')) return 'home';
  return 'home';
}

// Tabler Icons สำหรับ Bottom Navigation Bar (Active / Inactive)
const NAV_ICONS = {
  home: {
    active: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" class="icon icon-tabler icons-tabler-filled icon-tabler-home"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M12.707 2.293l9 9c.63 .63 .184 1.707 -.707 1.707h-1v6a3 3 0 0 1 -3 3h-1v-7a3 3 0 0 0 -2.824 -2.995l-.176 -.005h-2a3 3 0 0 0 -3 3v7h-1a3 3 0 0 1 -3 -3v-6h-1c-.89 0 -1.337 -1.077 -.707 -1.707l9 -9a1 1 0 0 1 1.414 0m.293 11.707a1 1 0 0 1 1 1v7h-4v-7a1 1 0 0 1 .883 -.993l.117 -.007z" /></svg>`,
    inactive: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-home"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M5 12l-2 0l9 -9l9 9l-2 0" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" /><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" /></svg>`
  },
  subject: {
    active: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" class="icon icon-tabler icons-tabler-filled icon-tabler-book"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M21.5 5.134a1 1 0 0 1 .493 .748l.007 .118v13a1 1 0 0 1 -1.5 .866a8 8 0 0 0 -7.5 -.266v-15.174a10 10 0 0 1 8.5 .708m-10.5 -.707l.001 15.174a8 8 0 0 0 -7.234 .117l-.327 .18l-.103 .044l-.049 .016l-.11 .026l-.061 .01l-.117 .006h-.042l-.11 -.012l-.077 -.014l-.108 -.032l-.126 -.056l-.095 -.056l-.089 -.067l-.06 -.056l-.073 -.082l-.064 -.089l-.022 -.036l-.032 -.06l-.044 -.103l-.016 -.049l-.026 -.11l-.01 -.061l-.004 -.049l-.002 -13.068a1 1 0 0 1 .5 -.866a10 10 0 0 1 8.5 -.707" /></svg>`,
    inactive: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-book"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0" /><path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0" /><path d="M3 6l0 13" /><path d="M12 6l0 13" /><path d="M21 6l0 13" /></svg>`
  },
  progress: {
    active: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" class="icon icon-tabler icons-tabler-filled icon-tabler-chart-bar-popular"><rect x="3.25" y="12" width="5.5" height="8" rx="1.2" fill="currentColor" stroke="#ffffff" stroke-width="1.8" /><rect x="9.25" y="8" width="5.5" height="12" rx="1.2" fill="currentColor" stroke="#ffffff" stroke-width="1.8" /><rect x="15.25" y="4" width="5.5" height="16" rx="1.2" fill="currentColor" stroke="#ffffff" stroke-width="1.8" /><path d="M3 20h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>`,
    inactive: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-chart-bar-popular"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -6" /><path d="M9 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -10" /><path d="M15 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -14" /><path d="M4 20h14" /></svg>`
  }
};

// Function อัปเดตสถานะของ Bottom Navigation Bar ตามหน้าปัจจุบัน
function updateActiveNav(namespace) {
  const navLinks = document.querySelectorAll('#bottom-navbar a[data-nav]');
  navLinks.forEach(link => {
    const target = link.getAttribute('data-nav');
    const iconContainer = link.querySelector('.nav-icon-box');
    const label = link.querySelector('.nav-label');

    if (target === namespace) {
      link.classList.remove('text-slate-400');
      link.classList.add('text-emerald-600');
      if (iconContainer) {
        iconContainer.classList.add('bg-emerald-50', 'text-emerald-600', 'scale-105');
        iconContainer.classList.remove('text-slate-400');
        if (NAV_ICONS[target]) {
          iconContainer.innerHTML = NAV_ICONS[target].active;
        }
      }
      if (label) {
        label.classList.add('font-bold', 'text-emerald-700');
        label.classList.remove('font-medium', 'text-slate-400');
      }
    } else {
      link.classList.add('text-slate-400');
      link.classList.remove('text-emerald-600');
      if (iconContainer) {
        iconContainer.classList.remove('bg-emerald-50', 'text-emerald-600', 'scale-105');
        iconContainer.classList.add('text-slate-400');
        if (NAV_ICONS[target]) {
          iconContainer.innerHTML = NAV_ICONS[target].inactive;
        }
      }
      if (label) {
        label.classList.remove('font-bold', 'text-emerald-700');
        label.classList.add('font-medium', 'text-slate-400');
      }
    }
  });
}

// Function สำหรับ Initialise ฟีเจอร์ในแต่ละหน้า
function initPageFeatures(container) {
  if (!container) container = document;

  // หน้า Home: Continued Carousel Drag Scroll
  const scrollTrack = container.querySelector('#continued-scroll-track');
  if (scrollTrack) {
    let isDown = false;
    let startX;
    let scrollLeft;

    scrollTrack.addEventListener('mousedown', (e) => {
      isDown = true;
      startX = e.pageX - scrollTrack.offsetLeft;
      scrollLeft = scrollTrack.scrollLeft;
    });
    scrollTrack.addEventListener('mouseleave', () => isDown = false);
    scrollTrack.addEventListener('mouseup', () => isDown = false);
    scrollTrack.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - scrollTrack.offsetLeft;
      const walk = (x - startX) * 1.5;
      scrollTrack.scrollLeft = scrollLeft - walk;
    });
  }

  // หน้า Subject: Filter Categories & Live Search
  const filterBtns = container.querySelectorAll('.subject-filter-btn');
  const subjectCards = container.querySelectorAll('.subject-card-item');
  const searchInput = container.querySelector('#subject-search-input') || container.querySelector('input[type="text"]');
  const searchClearBtn = container.querySelector('#subject-search-clear');
  const emptyState = container.querySelector('#subject-empty-state');
  const resetFiltersBtn = container.querySelector('#subject-reset-filters-btn');

  function applyFilters() {
    const activeBtn = container.querySelector('.subject-filter-btn.game-btn-mint');
    const category = activeBtn ? activeBtn.getAttribute('data-filter') : 'all';
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    if (searchClearBtn) {
      if (query.length > 0) {
        searchClearBtn.classList.remove('hidden');
      } else {
        searchClearBtn.classList.add('hidden');
      }
    }

    let matchCount = 0;
    subjectCards.forEach(card => {
      const cardCategory = card.getAttribute('data-category');
      const text = card.textContent.toLowerCase();
      const matchesCategory = (category === 'all' || cardCategory === category);
      const matchesSearch = (!query || text.includes(query));

      if (matchesCategory && matchesSearch) {
        matchCount++;
        gsap.to(card, {
          opacity: 1,
          scale: 1,
          duration: 0.2,
          display: 'block',
          overwrite: 'auto',
          clearProps: 'transform'
        });
      } else {
        gsap.to(card, {
          opacity: 0,
          scale: 0.95,
          duration: 0.15,
          display: 'none',
          overwrite: 'auto'
        });
      }
    });

    if (emptyState) {
      if (matchCount === 0) {
        emptyState.classList.remove('hidden');
        gsap.to(emptyState, {
          opacity: 1,
          y: 0,
          duration: 0.2,
          display: 'block',
          overwrite: 'auto'
        });
      } else {
        gsap.to(emptyState, {
          opacity: 0,
          y: 5,
          duration: 0.15,
          display: 'none',
          overwrite: 'auto',
          onComplete: () => {
            emptyState.classList.add('hidden');
          }
        });
      }
    }
  }

  if (filterBtns.length > 0) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => {
          b.classList.remove('game-btn-mint', 'font-bold');
          b.classList.add('game-btn-white', 'font-semibold');
        });
        btn.classList.add('game-btn-mint', 'font-bold');
        btn.classList.remove('game-btn-white', 'font-semibold');
        applyFilters();
      });
    });
  }

  if (searchInput && subjectCards.length > 0) {
    searchInput.addEventListener('input', applyFilters);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        applyFilters();
      }
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      applyFilters();
    });
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (filterBtns.length > 0) {
        filterBtns.forEach(b => {
          b.classList.remove('game-btn-mint', 'font-bold');
          b.classList.add('game-btn-white', 'font-semibold');
        });
        const allBtn = container.querySelector('.subject-filter-btn[data-filter="all"]');
        if (allBtn) {
          allBtn.classList.add('game-btn-mint', 'font-bold');
          allBtn.classList.remove('game-btn-white', 'font-semibold');
        }
      }
      applyFilters();
    });
  }

  // Initial filter sync if controls are present
  if (subjectCards.length > 0 && (filterBtns.length > 0 || searchInput)) {
    applyFilters();
  }

  // หน้า Subject: Card Action & Button Feedback (เข้าเรียน)
  subjectCards.forEach(card => {
    // If card is an anchor link (like in index.html), allow normal link routing
    if (card.tagName.toLowerCase() !== 'a') {
      card.addEventListener('click', () => {
        const title = card.querySelector('h3, h4')?.textContent || 'วิชาเรียน';
        showLearningToast(title.trim());
      });
    }
  });

  const enterBtns = container.querySelectorAll('.subject-card-item button');
  enterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.subject-card-item');
      const title = card ? (card.querySelector('h3, h4')?.textContent || 'วิชาเรียน') : 'วิชาเรียน';
      showLearningToast(title.trim());
    });
  });
}

// Floating Feedback Toast for Card Action
function showLearningToast(subjectTitle) {
  let toast = document.getElementById('study-action-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'study-action-toast';
    toast.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-900/90 text-white text-xs font-bold shadow-xl backdrop-blur-md border border-slate-700/50 flex items-center gap-2 pointer-events-none transition-all duration-300 opacity-0 translate-y-2';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span class="text-base">🚀</span><span>กำลังเตรียมห้องเรียน <strong>${subjectTitle}</strong>...</span>`;
  toast.classList.remove('opacity-0', 'translate-y-2');
  toast.classList.add('opacity-100', 'translate-y-0');

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'translate-y-2');
  }, 2200);
}

// อัปเดตชื่อหน้าและ Badge ใน Persistent Shared Header
function updateSharedHeader(ns) {
  const titleEl = document.getElementById('header-page-title');
  const badgeEl = document.getElementById('header-page-badge');
  const sharedHeader = document.getElementById('shared-top-header');

  const pageInfo = {
    'home': { title: 'หน้าแรกการเรียน', badge: '', pb: 'pb-3' },
    'subject': { title: 'คลังรายวิชาทั้งหมด', badge: '10 วิชา 🎒', pb: 'pb-2' },
    'progress': { title: 'ความคืบหน้า & อันดับ', badge: '🏆 ซีซัน 1', pb: 'pb-3' }
  }[ns] || { title: 'หน้าแรกการเรียน', badge: '', pb: 'pb-3' };

  if (sharedHeader) {
    sharedHeader.classList.remove('pb-2', 'pb-3');
    sharedHeader.classList.add(pageInfo.pb);
  }

  if (titleEl && titleEl.textContent !== pageInfo.title) {
    gsap.to(titleEl, {
      opacity: 0,
      y: -3,
      duration: 0.12,
      onComplete: () => {
        titleEl.textContent = pageInfo.title;
        gsap.to(titleEl, { opacity: 1, y: 0, duration: 0.18 });
      }
    });
  }

  if (badgeEl) {
    if (pageInfo.badge) {
      badgeEl.textContent = pageInfo.badge;
      badgeEl.classList.remove('hidden');
      gsap.fromTo(badgeEl, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.18 });
    } else {
      badgeEl.classList.add('hidden');
    }
  }
}

// ⚡ ดักคลิกที่แถบ Nav ด้านล่างเพื่ออัปเดตไอคอนแท็บทันที ตอบสนองเร็วระดับ 0ms
document.addEventListener('click', (e) => {
  const link = e.target.closest('#bottom-navbar a[data-nav]');
  if (!link) return;
  const targetNs = link.getAttribute('data-nav');
  if (targetNs) {
    updateActiveNav(targetNs);
  }
});

// เริ่มต้นระบบเมื่อโหลดหน้า
document.addEventListener('DOMContentLoaded', () => {
  const initialNs = document.querySelector('[data-barba="container"]')?.getAttribute('data-barba-namespace') || 'home';

  // กำหนดความสูงเริ่มต้นให้ตรงกับหน้าแรกที่เปิด
  const blueBg = document.getElementById('mainBlueBg') || document.querySelector('.header-bg-shell');
  if (blueBg) {
    gsap.set(blueBg, { height: HEADER_HEIGHTS[initialNs] || 250 });
  }

  updateActiveNav(initialNs);
  updateSharedHeader(initialNs);
  initPageFeatures(document);

  // Preload หน้าทั้งหมดลงแคช เพื่อให้ Barba สลับหน้าได้ทันที 0ms ไร้ดีเลย์
  ['index.html', 'subject.html', 'progress.html'].forEach(page => {
    fetch(page, { cache: 'force-cache' }).catch(() => {});
  });

  if (window.barba) {
    barba.init({
      transitions: [{
        name: 'fade-slide-transition',
        leave(data) {
          gsap.killTweensOf([
            data.current.container,
            '#mainBlueBg',
            '.header-bg-shell'
          ]);

          // เฟดหน้าเก่าออกอย่างนุ่มนวล
          return gsap.to(data.current.container, {
            opacity: 0,
            y: -10,
            duration: 0.2,
            ease: "power2.inOut",
            onComplete: () => {
              if (data.current.container) {
                data.current.container.style.display = 'none';
              }
            }
          });
        },
        beforeEnter(data) {
          const activeContainer = data.next.container;
          gsap.set(activeContainer, { opacity: 0, y: 10 });

          // จัดลำดับ DOM ให้ activeContainer อยู่ก่อน #bottom-navbar และอยู่หลัง #shared-top-header เสมอ
          const bottomNav = document.getElementById('bottom-navbar');
          if (bottomNav && activeContainer.nextElementSibling !== bottomNav) {
            bottomNav.parentNode.insertBefore(activeContainer, bottomNav);
          }

          const ns = data.next.namespace || getNamespaceFromHref(data.next.url.path);

          // อัปเดตชื่อหน้าและ Badge ใน Shared Header นิ่งๆ ไร้การเลื่อนตำแหน่ง
          updateSharedHeader(ns);

          // ==========================================
          // 🚀 จัดการพื้นที่โค้งสีฟ้า (Hook: beforeEnter)
          // Duration: 0.5s, Easing: "power3.inOut" (ตามที่กำหนดใน Reference)
          // ==========================================
          const blueBg = document.getElementById('mainBlueBg') || document.querySelector('.header-bg-shell');
          if (blueBg) {
            let targetHeight = HEADER_HEIGHTS[ns] || 250;
            let bgSpeed = 0.5;
            gsap.to(blueBg, {
              height: targetHeight,
              duration: bgSpeed,
              ease: "power3.inOut"
            });
          }

          updateActiveNav(ns);
          window.scrollTo(0, 0);
        },
        enter(data) {
          initPageFeatures(data.next.container);

          // เฟดหน้าใหม่เข้ามาอย่างนุ่มนวล
          return gsap.to(data.next.container, {
            opacity: 1,
            y: 0,
            duration: 0.25,
            ease: "power2.out"
          });
        }
      }]
    });
  }
});

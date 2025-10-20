/*
====================================
TUTORBOND - JavaScript
Chỉ chứa smooth scroll cho navigation
====================================
*/

// Chờ DOM load hoàn tất
document.addEventListener('DOMContentLoaded', function() {
    
    // Khởi tạo smooth scroll cho các anchor links
    initSmoothScroll();
    
    // Khởi tạo active nav highlighting
    initActiveNavHighlight();
    
    // Khởi tạo header scroll effect
    initHeaderScrollEffect();
    
    // Khởi tạo scroll animations
    initScrollAnimations();
    
    // Khởi tạo mobile menu
    initMobileMenu();
    
    // Khởi tạo logo fallback
    initLogoFallback();

    // Khởi tạo rotator gia sư
    initTutorRotator();
    initTutorSubjectFilter();
});

/**
 * Khởi tạo smooth scroll cho các liên kết anchor
 * Áp dụng cho tất cả links có href bắt đầu bằng #
 */
function initSmoothScroll() {
    // Lấy tất cả các liên kết anchor
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Lấy target element từ href
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                // Tính toán vị trí scroll với offset cho fixed header (mobile-aware)
                const offset = getMobileHeaderOffset();
                const targetPosition = targetElement.offsetTop - offset;
                
                // Smooth scroll đến target
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
                
                // Thêm focus cho accessibility
                targetElement.setAttribute('tabindex', '-1');
                targetElement.focus();
            }
        });
    });
}

/**
 * Highlight navigation item tương ứng với section hiện tại
 * Cập nhật active state dựa trên scroll position
 */
function initActiveNavHighlight() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id]');
    
    // Chỉ chạy nếu có sections và nav links
    if (sections.length === 0 || navLinks.length === 0) return;
    
    window.addEventListener('scroll', function() {
        const scrollPosition = window.scrollY + 100; // Offset cho better UX
        
        let currentSection = '';
        
        // Tìm section hiện tại dựa trên scroll position
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                currentSection = section.getAttribute('id');
            }
        });
        
        // Cập nhật active state cho nav links
        navLinks.forEach(link => {
            link.classList.remove('active');
            
            if (link.getAttribute('href') === `#${currentSection}`) {
                link.classList.add('active');
            }
        });
    });
}

/**
 * Utility function - Debounce cho performance optimization
 * Sử dụng cho các event listeners có tần suất cao như scroll
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Thêm class 'scrolled' cho header khi scroll xuống
 * Tạo hiệu ứng thay đổi header khi cuộn trang
 */
function initHeaderScrollEffect() {
    const header = document.querySelector('.header');
    if (!header) return;
    
    const scrollHandler = debounce(function() {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }, 10);
    
    window.addEventListener('scroll', scrollHandler);
}

/**
 * Fade in animation cho các elements khi scroll vào view
 * Tạo hiệu ứng xuất hiện mượt mà cho các thành phần
 */
function initScrollAnimations() {
    // Chỉ chạy nếu browser hỗ trợ IntersectionObserver
    if (!window.IntersectionObserver) return;
    
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                // Unobserve sau khi đã animate để cải thiện performance
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Thêm style ban đầu và observe các elements cần animation
    const animateElements = document.querySelectorAll('.card, .step-card, .section-title');
    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

/**
 * Khởi tạo mobile menu hamburger
 * Xử lý toggle menu và đóng menu khi click outside
 */
function initMobileMenu() {
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (!mobileMenuToggle || !navMenu) return;
    
    // Toggle menu khi click hamburger
    mobileMenuToggle.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const isActive = navMenu.classList.contains('active');
        
        if (isActive) {
            closeMenu();
        } else {
            openMenu();
        }
    });
    
    // Đóng menu khi click vào nav link
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', closeMenu);
    });
    
    // Đóng menu khi click outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.nav') && navMenu.classList.contains('active')) {
            closeMenu();
        }
    });
    
    // Đóng menu khi resize về desktop
    window.addEventListener('resize', debounce(function() {
        if (window.innerWidth > 768 && navMenu.classList.contains('active')) {
            closeMenu();
        }
    }, 250));
    
    // Đóng menu với ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && navMenu.classList.contains('active')) {
            closeMenu();
            mobileMenuToggle.focus(); // Return focus to button
        }
    });
    
    function openMenu() {
        navMenu.classList.add('active');
        mobileMenuToggle.classList.add('active');
        mobileMenuToggle.setAttribute('aria-expanded', 'true');
        
        // Prevent body scroll when menu is open
        document.body.style.overflow = 'hidden';
        
        // Focus first menu item for accessibility
        const firstLink = navMenu.querySelector('.nav-link');
        if (firstLink) {
            setTimeout(() => firstLink.focus(), 300);
        }
    }
    
    function closeMenu() {
        navMenu.classList.remove('active');
        mobileMenuToggle.classList.remove('active');
        mobileMenuToggle.setAttribute('aria-expanded', 'false');
        
        // Restore body scroll
        document.body.style.overflow = '';
    }
}

/**
 * Xử lý fallback cho logo khi ảnh không load được
 * Ẩn ảnh và hiển thị text backup
 */
function initLogoFallback() {
    const brandLogo = document.querySelector('.brand-logo');
    const brandText = document.querySelector('.brand-text');
    
    if (!brandLogo || !brandText) return;
    
    brandLogo.addEventListener('error', function() {
        console.log('Logo image failed to load, using text fallback');
        brandLogo.style.display = 'none';
        brandText.style.display = 'block';
    });
    
    brandLogo.addEventListener('load', function() {
        console.log('Logo image loaded successfully');
        brandLogo.style.display = 'block';
        // Có thể ẩn text nếu muốn chỉ hiển thị logo
        // brandText.style.display = 'none';
    });
}

/**
 * Cải thiện smooth scroll cho mobile
 * Tính toán offset chính xác hơn cho mobile
 */
function getMobileHeaderOffset() {
    const header = document.querySelector('.header');
    if (!header) return 0;
    
    // Mobile có header nhỏ hơn
    return window.innerWidth <= 768 ? header.offsetHeight + 10 : header.offsetHeight + 20;
}

// Log thông tin dự án (chỉ trong development)
console.log('🎓 TUTORBOND v1.0.0 - Trang giới thiệu dự án');
console.log('📋 Trang này chỉ trưng bày thông tin, không có chức năng thực tế');
console.log('📱 Mobile-optimized version');

/**
 * Rotator hiển thị tối đa 3 thẻ, auto chuyển mỗi 10s, seamless loop
 */
function initTutorRotator(){
    const rotator = document.querySelector('[data-rotator]');
    const track = rotator?.querySelector('[data-rotator-track]');
    if(!rotator || !track) return;

    let cards = Array.from(track.children);
    if(cards.length === 0) return;

    // State
    let currentIndex = 0; // index của thẻ thực đang active
    let visible = getVisibleCount(); // số thẻ hiển thị cùng lúc (3/2/1) nhưng bước chuyển = 1
    let intervalId;
    const DURATION = 3000; // 3 giây theo yêu cầu mới

    // Clone đầu cuối để seamless
    function setupClones(){
        const fragStart = document.createDocumentFragment();
        const fragEnd = document.createDocumentFragment();
        // clone cuối lên đầu
        for(let i=cards.length - visible; i<cards.length; i++){
            const clone = cards[i].cloneNode(true); clone.setAttribute('data-clone','true'); fragStart.appendChild(clone);
        }
        // clone đầu xuống cuối
        for(let i=0;i<visible;i++){
            const clone = cards[i].cloneNode(true); clone.setAttribute('data-clone','true'); fragEnd.appendChild(clone);
        }
        track.insertBefore(fragStart, track.firstChild);
        track.appendChild(fragEnd);
    }

    setupClones();

    // Update collection (include clones for width calc)
    const allItems = Array.from(track.children);

    function getCardWidth(){
        const firstReal = cards[0];
        return firstReal.getBoundingClientRect().width + parseFloat(getComputedStyle(track).gap || 0);
    }

    function getVisibleCount(){
        if(window.innerWidth <= 560) return 1;
        if(window.innerWidth <= 900) return 2;
        return 3;
    }

        function applyActiveClasses(){
            allItems.forEach(el=> el.classList.remove('is-active','is-near'));
            const leadOffset = visible; // số clone ở đầu
            const active = allItems[leadOffset + currentIndex];
            if(active) active.classList.add('is-active');
            const prev = allItems[leadOffset + currentIndex - 1];
            if(prev) prev.classList.add('is-near');
            const next = allItems[leadOffset + currentIndex + 1];
            if(next) next.classList.add('is-near');
        }

        function moveTo(index, animate=true){
            currentIndex = index;
            const cardW = getCardWidth();
            if(!animate){ track.style.transition='none'; } else { track.style.transition='transform 700ms ease'; }
            // translate includes leading clone block
            const translateX = -(cardW * (currentIndex + visible));
            track.style.transform = `translateX(${translateX}px)`;
            applyActiveClasses();
        }

    function next(){
        const max = cards.length;
        currentIndex += 1; // bước chuyển từng 1 thẻ
        moveTo(currentIndex,true);
        if(currentIndex >= max){
            currentIndex = 0;
            setTimeout(()=> moveTo(currentIndex,false), 720);
        }
    }

    function startAuto(){
        // Chỉ chạy auto nếu số thẻ thực > 3
        const realCount = cards.length;
        if(realCount <= 3) return; // không autoplay khi ít
        intervalId = setInterval(next, DURATION);
    }
    function stopAuto(){ clearInterval(intervalId); }

    // Pause khi hover để UX
    rotator.addEventListener('mouseenter', stopAuto);
    rotator.addEventListener('mouseleave', ()=>{ stopAuto(); startAuto(); });

    // Responsive
    window.addEventListener('resize', debounce(()=>{
        const newVisible = getVisibleCount();
        if(newVisible !== visible){
            stopAuto();
            // Reset clones: remove all clones
            Array.from(track.querySelectorAll('[data-clone="true"]')).forEach(c=>c.remove());
            visible = newVisible;
            currentIndex = 0;
            setupClones();
            // refresh lists
            cards = Array.from(track.children).filter(el=>!el.hasAttribute('data-clone'));
            const newAll = Array.from(track.children);
            allItems.length = 0; newAll.forEach(n=>allItems.push(n));
                // Start positioned after leading clones so real items visible
                moveTo(0,false);
            startAuto();
        } else {
            moveTo(currentIndex,false);
        }
    },300));

    // Init position (offset by leading clones count = visible)
    moveTo(0,false);
    startAuto();
}

/**
 * Bộ lọc môn học đơn giản: ẩn các thẻ không khớp và reset rotator
 */
function initTutorSubjectFilter(){
    const select = document.querySelector('[data-filter-subject]');
    const track = document.querySelector('[data-rotator-track]');
    const resultEl = document.querySelector('[data-filter-result]');
    const salarySelect = document.querySelector('[data-filter-salary]');
    if(!select || !track) return;

    function handleFilter(){
        const value = select.value;
        const salaryValue = salarySelect ? salarySelect.value : 'all';
        const allCards = Array.from(track.querySelectorAll('.tb-card')).filter(c=>!c.hasAttribute('data-clone'));
        let visibleCount = 0;
        allCards.forEach(card => {
            const subject = card.getAttribute('data-subject');
            const salary = parseInt(card.getAttribute('data-salary')||'0',10);
            let salaryMatch = true;
            if(salaryValue === '<=200'){ salaryMatch = salary <= 200; }
            else if(salaryValue === '200-300'){ salaryMatch = salary >= 200 && salary <= 300; }
            else if(salaryValue === '>300'){ salaryMatch = salary > 300; }
            const show = (value === 'all' || subject === value) && salaryMatch;
            card.style.display = show ? '' : 'none';
            if(show) visibleCount++;
        });
        if(resultEl){
            resultEl.textContent = `${visibleCount} gia sư`;
        }
        rebuildRotator();
    }

    select.addEventListener('change', handleFilter);
    if(salarySelect){ salarySelect.addEventListener('change', handleFilter); }

    function rebuildRotator(){
        // Xóa clone để tránh lặp CV
        Array.from(track.querySelectorAll('[data-clone="true"]')).forEach(c=>c.remove());
        const realCards = Array.from(track.querySelectorAll('.tb-card')).filter(c=>c.style.display !== 'none');
        // Nếu chỉ còn 1 hoặc 0 hoặc tổng <=3 thì không tạo clone / không animation
        if(realCards.length <= 1 || realCards.length <= 3){
            track.style.transition='none';
            track.style.transform = 'translateX(0)';
            Array.from(track.children).forEach(el=> el.classList.remove('is-active','is-near'));
            if(realCards[0]) realCards[0].classList.add('is-active');
            return;
        }
        const visible = (window.innerWidth <= 560)?1:(window.innerWidth <= 900?2:3);
        const needClone = realCards.length > visible; // chỉ clone nếu hơn số hiển thị
        if(needClone){
            const fragStart = document.createDocumentFragment();
            const fragEnd = document.createDocumentFragment();
            const cloneCount = Math.min(visible, realCards.length);
            for(let i=realCards.length - cloneCount; i<realCards.length; i++){
                const clone = realCards[i].cloneNode(true); clone.setAttribute('data-clone','true'); fragStart.appendChild(clone);
            }
            for(let i=0;i<cloneCount; i++){
                const clone = realCards[i].cloneNode(true); clone.setAttribute('data-clone','true'); fragEnd.appendChild(clone);
            }
            track.insertBefore(fragStart, track.firstChild);
            track.appendChild(fragEnd);
            const gap = parseFloat(getComputedStyle(track).gap||0);
            const cardW = realCards[0].getBoundingClientRect().width + gap;
            track.style.transition='none';
            track.style.transform = `translateX(-${cardW * cloneCount}px)`;
            Array.from(track.children).forEach(el=> el.classList.remove('is-active','is-near'));
            const all = Array.from(track.children);
            const active = all[cloneCount];
            if(active) active.classList.add('is-active');
            const next = all[cloneCount+1]; if(next) next.classList.add('is-near');
        } else {
            track.style.transition='none';
            track.style.transform = 'translateX(0)';
            Array.from(track.children).forEach(el=> el.classList.remove('is-active','is-near'));
            realCards[0].classList.add('is-active');
            if(realCards[1]) realCards[1].classList.add('is-near');
        }
    }
}

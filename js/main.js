/*
====================================
TUTORBOND - JavaScript
Chỉ chứa smooth scroll cho navigation
====================================
*/

// Chờ DOM load hoàn tất
document.addEventListener('DOMContentLoaded', function() {
    // If we're on the standalone agent CV page, skip site-wide animations
    const isAgentCvPage = window.location.pathname && window.location.pathname.toLowerCase().endsWith('agentcv.html');
    
    // Khởi tạo smooth scroll cho các anchor links
    initSmoothScroll();
    
    // Khởi tạo active nav highlighting
    initActiveNavHighlight();
    
    // Khởi tạo header scroll effect
    initHeaderScrollEffect();
    
    // Khởi tạo scroll animations (skip on agentcv page)
    if(!isAgentCvPage) initScrollAnimations();
    
    // Khởi tạo mobile menu
    initMobileMenu();
    
    // Khởi tạo logo fallback
    initLogoFallback();

    // Khởi tạo rotator gia sư (skip animation-heavy features on agentcv page)
    if(!isAgentCvPage){
        initTutorRotator();
        initTutorSubjectFilter();
    }

    // Initialize chat after DOM is ready so chat markup exists
    try{ initTutorChat(); }catch(e){ /* fail silently */ }
    
    // If on agentcv page we still want chat available
    if(isAgentCvPage){
        // ensure subject filter was not initialized above
        initTutorSubjectFilter();
    } else {
        // On agentcv page, ensure any rotator elements (if present) are static
        try{
            const rotator = document.querySelector('[data-rotator]');
            if(rotator){
                const track = rotator.querySelector('[data-rotator-track]');
                if(track){ track.style.transition = 'none'; track.style.transform = 'none'; }
                Array.from(rotator.querySelectorAll('.tb-card')).forEach(c=>{ c.style.transition = 'none'; c.style.transform = 'none'; });
            }
        }catch(e){ /* ignore errors */ }
    }
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

// (Đã lược bỏ console.log dev để code sạch hơn production)

/**
 * Rotator hiển thị tối đa 3 thẻ, auto chuyển mỗi 10s, seamless loop
 */
function initTutorRotator(){
    const rotator = document.querySelector('[data-rotator]');
    const track = rotator?.querySelector('[data-rotator-track]');
    if(!rotator || !track) return;

    const prevBtn = rotator.querySelector('[data-rotator-prev]');
    const nextBtn = rotator.querySelector('[data-rotator-next]');

    let cards = Array.from(track.children);
    if(cards.length === 0) return;

    // --- State ---
    let currentIndex = 0;              // index của thẻ thực active
    let visible = getVisibleCount();   // 3 / 2 / 1 tuỳ viewport
    let intervalId = null;             // autoplay interval ref
    let paused = false;                // trạng thái tạm dừng (hover/focus)
    const AUTO_INTERVAL = 4000;        // 4s theo yêu cầu
    const TRANSITION_MS = 700;         // ms animation slide

    // Danh sách đầy đủ (bao gồm clone) - sẽ rebuild khi responsive
    let allItems = [];

    function getVisibleCount(){
        if(window.innerWidth <= 560) return 1;
        if(window.innerWidth <= 900) return 2;
        return 3;
    }

    function setupClones(){
        // Xoá clone cũ
        Array.from(track.querySelectorAll('[data-clone="true"]')).forEach(c=>c.remove());
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
        allItems = Array.from(track.children);
    }

    function getCardWidth(){
        const firstReal = cards[0];
        if(!firstReal) return 0;
        return firstReal.getBoundingClientRect().width + parseFloat(getComputedStyle(track).gap || 0);
    }

    function applyActiveClasses(){
        allItems.forEach(el=> el.classList.remove('is-active','is-near'));
        const leadOffset = visible;
        const active = allItems[leadOffset + currentIndex];
        if(active) active.classList.add('is-active');
        const prev = allItems[leadOffset + currentIndex - 1]; if(prev) prev.classList.add('is-near');
        const next = allItems[leadOffset + currentIndex + 1]; if(next) next.classList.add('is-near');
        updateButtonsDisabled();
    }

    function moveTo(index, animate=true){
        currentIndex = index;
        const cardW = getCardWidth();
        if(!animate){ track.style.transition='none'; } else { track.style.transition=`transform ${TRANSITION_MS}ms ease`; }
        const translateX = -(cardW * (currentIndex + visible));
        track.style.transform = `translateX(${translateX}px)`;
        applyActiveClasses();
    }

    function next(step=1){
        const max = cards.length; // số thẻ thực
        currentIndex += step;
        moveTo(currentIndex,true);
        if(currentIndex >= max){
            currentIndex = 0;
            // Jump về vị trí thực sau animation hoàn tất
            setTimeout(()=> moveTo(currentIndex,false), TRANSITION_MS + 20);
        }
    }

    function prev(step=1){
        const max = cards.length;
        currentIndex -= step;
        moveTo(currentIndex,true);
        if(currentIndex < 0){
            currentIndex = max - 1;
            setTimeout(()=> moveTo(currentIndex,false), TRANSITION_MS + 20);
        }
    }

    function startAuto(){
        stopAuto();
        if(cards.length <= visible) return; // Không auto nếu không đủ thẻ
        if(paused) return;
        intervalId = setInterval(()=> next(1), AUTO_INTERVAL);
    }
    function stopAuto(){ if(intervalId){ clearInterval(intervalId); intervalId=null; } }

    function pause(){ paused = true; rotator.classList.add('tutor-rotator--paused'); stopAuto(); }
    function resume(){ paused = false; rotator.classList.remove('tutor-rotator--paused'); startAuto(); }

    function updateButtonsDisabled(){
        // Với cơ chế clone vô hạn không cần disable; để lại hook nếu sau này muốn giới hạn.
        if(prevBtn) prevBtn.disabled = false;
        if(nextBtn) nextBtn.disabled = false;
    }

    // --- Interaction events ---
    if(prevBtn){ prevBtn.addEventListener('click', ()=> { pause(); prev(1); resume(); }); }
    if(nextBtn){ nextBtn.addEventListener('click', ()=> { pause(); next(1); resume(); }); }

    // Keyboard support (focus trong rotator hoặc nút)
    rotator.addEventListener('keydown', (e)=>{
        if(e.key === 'ArrowRight'){ e.preventDefault(); pause(); next(1); resume(); }
        if(e.key === 'ArrowLeft'){ e.preventDefault(); pause(); prev(1); resume(); }
    });

    // Hover / Focus pause
    rotator.addEventListener('mouseenter', pause);
    rotator.addEventListener('mouseleave', resume);
    rotator.addEventListener('focusin', pause);
    rotator.addEventListener('focusout', (e)=>{
        // Nếu focus rời hoàn toàn khỏi rotator
        if(!rotator.contains(document.activeElement)) resume();
    });

    // Responsive rebuild
    window.addEventListener('resize', debounce(()=>{
        const newVisible = getVisibleCount();
        if(newVisible !== visible){
            visible = newVisible;
            currentIndex = 0;
            setupClones();
            cards = Array.from(track.children).filter(el=>!el.hasAttribute('data-clone'));
            moveTo(0,false);
            startAuto();
        } else {
            moveTo(currentIndex,false);
        }
    },250));

    // --- Init ---
    setupClones();
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
    const examSelect = document.querySelector('[data-filter-exam]');
    if(!select || !track) return;

    function handleFilter(){
        const value = select.value;
        const examValue = examSelect ? examSelect.value : 'all';
        const salaryValue = salarySelect ? salarySelect.value : 'all';
        const allCards = Array.from(track.querySelectorAll('.tb-card')).filter(c=>!c.hasAttribute('data-clone'));
        let visibleCount = 0;
        allCards.forEach(card => {
            const subject = card.getAttribute('data-subject');
            const salary = parseInt(card.getAttribute('data-salary')||'0',10);
            const examsAttr = card.getAttribute('data-exams') || '';
            const exams = examsAttr.split(',').map(s=>s.trim()).filter(Boolean);
            let salaryMatch = true;
            if(salaryValue === '<=200'){ salaryMatch = salary <= 200; }
            else if(salaryValue === '200-300'){ salaryMatch = salary >= 200 && salary <= 300; }
            else if(salaryValue === '>300'){ salaryMatch = salary > 300; }
            let examMatch = true;
            if(examValue !== 'all'){
                examMatch = exams.includes(examValue);
            }
            const show = (value === 'all' || subject === value) && salaryMatch && examMatch;
            card.style.display = show ? '' : 'none';
            if(show) visibleCount++;
        });
        if(resultEl){
            resultEl.textContent = `${visibleCount} gia sư`;
        }
        rebuildRotator();
    }

    select.addEventListener('change', handleFilter);
    if(examSelect){ examSelect.addEventListener('change', handleFilter); }
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
    // Khởi tạo ban đầu để đảm bảo count đúng khi load trang
    handleFilter();
}

// Tutor chat widget behavior (self-contained)
function initTutorChat(){
    const toggle = document.getElementById('tutor-chat-toggle');
    const panel = document.getElementById('tutor-chat-panel');
    const closeBtn = document.getElementById('tutor-chat-close');
    const messages = document.getElementById('tutor-chat-messages');
    const form = document.getElementById('tutor-chat-form');
    const input = document.getElementById('tutor-chat-input');
    const suggestButtons = document.querySelectorAll('.chat-suggestions .suggest');

    if(!toggle || !panel || !messages || !form || !input) return;

    function openPanel(){
        panel.style.display = 'flex';
        document.getElementById('tutor-chat').setAttribute('aria-hidden','false');
        input.focus();
        if(messages.children.length===0) {
            botReply('Xin chào! Tôi có thể giúp bạn chọn gia sư. Bạn tìm gia sư môn gì và cho lứa tuổi nào?');
        }
    }

    function closePanel(){
        panel.style.display = 'none';
        document.getElementById('tutor-chat').setAttribute('aria-hidden','true');
        toggle.focus();
    }

    function addMessage(text, who='bot'){
        const el = document.createElement('div');
        el.className = 'msg ' + who;
        el.textContent = text;
        messages.appendChild(el);
        messages.scrollTop = messages.scrollHeight;
    }

    function botReply(text){
        setTimeout(()=> addMessage(text,'bot'), 450);
    }

    toggle.addEventListener('click', ()=>{
        if(panel.style.display === 'flex') closePanel(); else openPanel();
    });
    closeBtn && closeBtn.addEventListener('click', closePanel);

    suggestButtons.forEach(btn=>{
        btn.addEventListener('click', ()=>{
            const msg = btn.getAttribute('data-msg') || btn.textContent;
            addMessage(msg,'user');
            botReply(generateSuggestionReply(msg));
        });
    });

    form.addEventListener('submit', (e)=>{
        e.preventDefault();
        const v = input.value && input.value.trim();
        if(!v) return;
        addMessage(v,'user');
        input.value = '';
        botReply(generateSuggestionReply(v));
    });

    // Extract tutor data from the featured cards on the page
    function extractTutorsFromPage(){
        const track = document.querySelector('[data-rotator-track]');
        if(!track) return [];
        const cards = Array.from(track.querySelectorAll('.tb-card')).filter(c=>!c.hasAttribute('data-clone'));
        return cards.map(card=>{
            const name = card.querySelector('.tb-name')?.textContent?.trim() || '';
            const subject = card.getAttribute('data-subject') || card.querySelector('.tb-head')?.textContent?.trim() || '';
            const salaryAttr = card.getAttribute('data-salary') || '';
            const priceText = card.querySelector('.tb-price')?.textContent?.trim() || '';
            const summary = card.querySelector('.tb-summary')?.textContent?.trim() || '';
            const location = Array.from(card.querySelectorAll('.tb-meta-item')).find(it=>it.textContent.includes('📍'))?.textContent.replace('📍','').trim() || '';
            const examsAttr = card.getAttribute('data-exams') || '';
            const exams = examsAttr.split(',').map(s=>s.trim()).filter(Boolean);
            return { name, subject, salaryAttr, priceText, summary, location, exams, el: card };
        });
    }

    // Find matching tutors by simple keyword matching on subject/name/location
    function findMatchingTutors(userText, limit=3){
        const tutors = extractTutorsFromPage();
        if(tutors.length === 0) return [];
        const t = (userText||'').toLowerCase();
        // Score tutors: +2 subject match, +1 name match, +1 location match, +1 exam match
        const scores = tutors.map(tutor=>{
            let score = 0;
            if(tutor.subject && t.includes(tutor.subject.toLowerCase())) score += 2;
            if(tutor.name && t.includes(tutor.name.toLowerCase())) score += 2;
            if(tutor.location && t.includes(tutor.location.toLowerCase())) score += 1;
            tutor.exams.forEach(ex=>{ if(ex && t.includes(ex.toLowerCase())) score += 1; });
            // keyword heuristics
            if(t.includes('toán') && tutor.subject.toLowerCase().includes('toán')) score += 2;
            if(t.includes('tiếng anh') && tutor.subject.toLowerCase().includes('tiếng anh')) score += 2;
            if(t.includes('vật lí') && tutor.subject.toLowerCase().includes('vật')) score += 2;
            if(t.includes('hóa') && tutor.subject.toLowerCase().includes('hóa')) score += 2;
            return { tutor, score };
        });
        scores.sort((a,b)=> b.score - a.score);
        return scores.filter(s=>s.score>0).slice(0,limit).map(s=>s.tutor);
    }

    function generateSuggestionReply(userText){
        const matches = findMatchingTutors(userText, 4);
        if(matches.length === 0){
            const t = (userText||'').toLowerCase();
            if(t.includes('toán') || t.includes('math')) return 'Mình chưa tìm thấy gia sư Toán phù hợp ngay lập tức. Thử thêm thông tin: lớp, mục tiêu (ôn thi/ nâng cao).';
            if(t.includes('tiếng anh') || t.includes('english')) return 'Mình chưa tìm thấy vì chưa đủ thông tin. Gợi ý: cho biết trình độ & mục tiêu (giao tiếp/IELTS).';
            if(t.includes('lập trình') || t.includes('program')) return 'Hiện trang chỉ liệt kê gia sư phổ biến (Toán, Hóa, Lý, Anh). Nếu cần lập trình, cho biết ngôn ngữ và mục tiêu.';
            return 'Cảm ơn — bạn cho biết thêm môn, lớp và mục tiêu (học nâng cao/ôn thi/giao tiếp) nhé, mình sẽ gợi ý.';
        }
        // Build a response string including small tutor summaries
        let reply = 'Mình tìm thấy một vài gia sư phù hợp:\n';
        matches.forEach(t=>{
            reply += `- ${t.name} — ${t.subject} — ${t.priceText || t.salaryAttr} — ${t.location || ''}\n`;
        });
        reply += 'Bạn muốn xem chi tiết ai? (nhấn tên trong danh sách hoặc gõ tên)';
        // After returning text, also display rich tutor cards in the chat UI
        setTimeout(()=> showTutorCardsInChat(matches), 600);
        return reply;
    }

    // Render small tutor cards into the chat messages area
    function showTutorCardsInChat(tutors){
        tutors.forEach(t=>{
            const card = document.createElement('div');
            card.className = 'chat-tutor-card';
            card.tabIndex = 0;
            card.innerHTML = `<div class="ct-left"><strong class="ct-name">${escapeHtml(t.name)}</strong><div class="ct-sub">${escapeHtml(t.subject)}</div><div class="ct-price">${escapeHtml(t.priceText || t.salaryAttr)}</div></div><div class="ct-action">Xem</div>`;
            card.addEventListener('click', ()=>{
                focusTutorCard(t.el);
            });
            card.addEventListener('keydown',(e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); focusTutorCard(t.el); } });
            const wrapper = document.createElement('div'); wrapper.className = 'msg bot'; wrapper.appendChild(card);
            messages.appendChild(wrapper);
            messages.scrollTop = messages.scrollHeight;
        });
    }

    function focusTutorCard(el){
        if(!el) return;
        // ensure the element is visible and give focus
        el.style.outline = '3px solid #FFB84D';
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(()=> el.style.outline = '', 2500);
    }

    function escapeHtml(text){ return (text||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

}

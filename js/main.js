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
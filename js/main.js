import { auth, onAuthStateChanged } from './firebase.js';
import * as authService from './auth.js';
import * as viewerService from './viewer.js';
import * as adminService from './admin.js';

// --- 전역 상태 관리 ---
const state = {
    allDocsMap: new Map(),
    isCurrentUserAdmin: false,
};

// --- DOM 요소 캐싱 ---
const DOMElements = {
    authStatusContainer: document.getElementById('auth-status'),
    viewerContainer: document.getElementById('viewer-container'),
    adminContainer: document.getElementById('admin-container'),
    searchInput: document.getElementById('searchInput'),
    searchButton: document.getElementById('searchButton'),
    appTitle: document.getElementById('app-title'),
    treeHeader: document.querySelector('.tree-header'),
};

// --- 이벤트 핸들러 ---
function handleNavigation(event) {
    const { id, title } = event.detail;
    viewerService.navigateTo(state.allDocsMap, id, title);
}

function handleAdminTreeRender() {
    adminService.buildAndRenderTree(state.allDocsMap);
}

function handleGoHome(e) {
    if (e) e.preventDefault();
    const toggleBtn = document.getElementById('mode-toggle-btn');
    DOMElements.viewerContainer.style.display = 'flex';
    DOMElements.adminContainer.style.display = 'none';
    if (toggleBtn) toggleBtn.textContent = '관리자 페이지';
    viewerService.navigateTo(state.allDocsMap, null, 'Home');
}

function handleAuthStatusChange(user) {
    authService.processUser(user).then(isAdmin => {
        state.isCurrentUserAdmin = isAdmin;
    });
}

function handleToggleMode() {
    if (state.isCurrentUserAdmin) {
        adminService.toggleMode();
    } else {
        alert('관리자 권한이 없습니다.');
    }
}

function handleCopyPath(e) {
    if (e.target.classList.contains('copy-path-btn')) {
        const path = e.target.dataset.path;
        navigator.clipboard.writeText(path).then(() => {
            const originalText = e.target.textContent;
            e.target.textContent = '복사 완료!';
            setTimeout(() => { e.target.textContent = originalText; }, 1500);
        }).catch(err => {
            console.error('클립보드 복사 실패:', err);
            alert('클립보드 복사에 실패했습니다.');
        });
    }
}

// --- 이벤트 리스너 설정 ---
function setupEventListeners() {
    DOMElements.searchButton.addEventListener('click', viewerService.performSearch);
    DOMElements.searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') viewerService.performSearch();
    });
    
    DOMElements.appTitle.addEventListener('click', handleGoHome);

    DOMElements.authStatusContainer.addEventListener('click', e => {
        if (e.target.id === 'mode-toggle-btn') handleToggleMode();
        if (e.target.id === 'login-btn') authService.signInWithGoogle();
    });

    DOMElements.treeHeader.addEventListener('click', e => {
        if(e.target.id === 'add-new-button') adminService.prepareNewDocumentForm();
        // ... 다른 관리자 버튼 핸들러
    });
    
    document.addEventListener('click', handleCopyPath);
    document.addEventListener('navigateToDoc', handleNavigation);
    document.addEventListener('requestAdminTreeRender', handleAdminTreeRender);
    document.addEventListener('requestViewerMode', handleGoHome);
}

// --- 앱 초기화 ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM 로드 완료, 앱 초기화 시작");

    if (!auth) {
        // firebase.js에서 에러 처리하지만, 만약을 대비
        return;
    }

    setupEventListeners();
    adminService.initResizer(); // 리사이저 초기화

    onAuthStateChanged(auth, handleAuthStatusChange);

    handleGoHome(); // 초기 화면 로드
    viewerService.loadGlobalLeftMargin();
});
// getRedirectResult 관련 import를 제거합니다.
import { auth, onAuthStateChanged } from './firebase.js';
import { signInWithGoogle, processUser, handleSignOut } from './auth.js';
import { navigateTo, performSearch, loadGlobalLeftMargin } from './viewer.js';
import {
    buildAndRenderTree,
    initResizer,
    openAdminManagementUI,
    prepareNewDocumentForm,
    toggleMode,
    loadGlobalNoticeEditor
} from './admin.js';

const state = {
    allDocsMap: new Map(),
    isCurrentUserAdmin: false,
};

const DOMElements = {
    viewerContainer: document.getElementById('viewer-container'),
    adminContainer: document.getElementById('admin-container'),
    searchInput: document.getElementById('searchInput'),
    searchButton: document.getElementById('searchButton'),
    appTitle: document.getElementById('app-title'),
};

function handleNavigation(event) {
    const { id, title } = event.detail;
    navigateTo(state.allDocsMap, id, title);
}

function handleAdminTreeRender() {
    buildAndRenderTree(state.allDocsMap);
}

function handleGlobalNoticeUpdate() {
    loadGlobalLeftMargin();
}

function handleGoHome(e) {
    if (e) e.preventDefault();
    const toggleBtn = document.getElementById('mode-toggle-btn');
    DOMElements.viewerContainer.style.display = 'flex';
    DOMElements.adminContainer.style.display = 'none';
    if (toggleBtn) toggleBtn.textContent = '관리자 페이지';
    navigateTo(state.allDocsMap, null, 'Home');
}

async function handleAuthStatusChange(user) {
    state.isCurrentUserAdmin = await processUser(user);
}

function handleCopyPath(target) {
    const path = target.dataset.path;
    navigator.clipboard.writeText(path).then(() => {
        const originalText = target.textContent;
        target.textContent = '복사 완료!';
        setTimeout(() => { target.textContent = originalText; }, 1500);
    }).catch(err => {
        console.error('클립보드 복사 실패:', err);
        alert('클립보드 복사에 실패했습니다.');
    });
}

function setupEventListeners() {
    DOMElements.searchButton.addEventListener('click', performSearch);
    DOMElements.searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    DOMElements.appTitle.addEventListener('click', handleGoHome);
    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target.id === 'login-btn') signInWithGoogle();
        if (target.id === 'logout-btn') handleSignOut();
        if (target.id === 'mode-toggle-btn') toggleMode(state.isCurrentUserAdmin);
        if (target.id === 'add-new-button') prepareNewDocumentForm(state.allDocsMap);
        if (target.id === 'edit-global-notice-button') loadGlobalNoticeEditor();
        if (target.id === 'manage-admins-button') openAdminManagementUI(state.isCurrentUserAdmin);
        if (target.classList.contains('copy-path-btn')) handleCopyPath(target);
    });
    document.addEventListener('navigateToDoc', handleNavigation);
    document.addEventListener('requestAdminTreeRender', handleAdminTreeRender);
    document.addEventListener('requestViewerMode', handleGoHome);
    document.addEventListener('globalNoticeUpdated', handleGlobalNoticeUpdate);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM 로드 완료, 앱 초기화 시작");

    if (!auth) {
        console.error("Firebase Auth가 초기화되지 않았습니다.");
        return;
    }

    // 리다이렉트 결과 확인 로직을 삭제합니다.
    
    setupEventListeners();
    initResizer();
    onAuthStateChanged(auth, handleAuthStatusChange);
    handleGoHome();
    loadGlobalLeftMargin();
});
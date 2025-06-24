// --- 1. 모듈 가져오기 ---
// 각 기능 파일에서 필요한 함수들을 모두 가져옵니다.
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

// --- 2. 전역 상태 관리 ---
// 앱의 여러 부분에서 공유해야 하는 상태를 관리합니다.
const state = {
    allDocsMap: new Map(),
    isCurrentUserAdmin: false,
};

// --- 3. DOM 요소 캐싱 ---
// 자주 사용하는 HTML 요소들을 미리 찾아 변수에 담아둡니다.
const DOMElements = {
    authStatusContainer: document.getElementById('auth-status'),
    viewerContainer: document.getElementById('viewer-container'),
    adminContainer: document.getElementById('admin-container'),
    searchInput: document.getElementById('searchInput'),
    searchButton: document.getElementById('searchButton'),
    appTitle: document.getElementById('app-title'),
};

// --- 4. 이벤트 핸들러 함수들 ---
// 이벤트 발생 시 실행될 로직을 명확하게 정의합니다.

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

// --- 5. 이벤트 리스너 설정 ---
// 페이지의 모든 이벤트를 설정하고 관리합니다.
function setupEventListeners() {
    // 검색 기능 이벤트
    DOMElements.searchButton.addEventListener('click', performSearch);
    DOMElements.searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    // 앱 제목(홈) 클릭 이벤트
    DOMElements.appTitle.addEventListener('click', handleGoHome);

    // 이벤트 위임: document 전체에 클릭 이벤트를 설정하여 동적으로 생성되는 버튼도 처리합니다.
    document.addEventListener('click', (e) => {
        const target = e.target;

        // auth 관련 버튼
        if (target.id === 'login-btn') signInWithGoogle();
        if (target.id === 'logout-btn') handleSignOut();
        if (target.id === 'mode-toggle-btn') toggleMode(state.isCurrentUserAdmin);

        // 관리자 페이지 헤더 버튼들
        if (target.id === 'add-new-button') prepareNewDocumentForm(state.allDocsMap);
        if (target.id === 'edit-global-notice-button') loadGlobalNoticeEditor();
        if (target.id === 'manage-admins-button') openAdminManagementUI(state.isCurrentUserAdmin);

        // 내용 안의 파일 경로 복사 버튼
        if (target.classList.contains('copy-path-btn')) handleCopyPath(target);
    });

    // 커스텀 이벤트 리스너 설정: 모듈 간 통신을 위해 사용합니다.
    document.addEventListener('navigateToDoc', handleNavigation);
    document.addEventListener('requestAdminTreeRender', handleAdminTreeRender);
    document.addEventListener('requestViewerMode', handleGoHome);
    document.addEventListener('globalNoticeUpdated', handleGlobalNoticeUpdate);
}

// --- 6. 앱 초기화 ---
// DOM이 모두 로드되면 앱의 실행을 시작합니다.
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM 로드 완료, 앱 초기화 시작");

    if (!auth) {
        console.error("Firebase Auth가 초기화되지 않았습니다.");
        return;
    }

    // 모든 이벤트 리스너를 설정합니다.
    setupEventListeners();

    // 관리자 패널의 리사이저를 초기화합니다.
    initResizer();

    // Firebase 인증 상태 변경을 감지합니다.
    onAuthStateChanged(auth, handleAuthStatusChange);

    // 초기 화면(홈)을 로드합니다.
    handleGoHome();

    // 좌측 공지사항을 로드합니다.
    loadGlobalLeftMargin();
});
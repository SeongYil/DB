// js/main.js

// getRedirectResult 관련 import를 제거합니다.
// --- 여기가 추가된 부분이야! ---
// db와 문서 전체를 가져오기 위한 collection, getDocs를 import
import { auth, onAuthStateChanged, db, collection, getDocs } from './firebase.js';
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
    currentUserRole: null, // isCurrentUserAdmin 대신 currentUserRole 사용
};

const DOMElements = {
    viewerContainer: document.getElementById('viewer-container'),
    adminContainer: document.getElementById('admin-container'),
    searchInput: document.getElementById('searchInput'),
    searchButton: document.getElementById('searchButton'),
    appTitle: document.getElementById('app-title'),
};


// --- 여기가 추가된 부분이야! ---
// 앱 시작 시 모든 문서 정보를 가져와 state에 저장하는 함수
async function fetchAllDocuments() {
    try {
        const snapshot = await getDocs(collection(db, "helps"));
        state.allDocsMap.clear();
        snapshot.forEach(doc => {
            state.allDocsMap.set(doc.id, { id: doc.id, data: doc.data(), children: [] });
        });
        console.log("모든 문서 정보를 state에 로드했습니다. 총 문서 수:", state.allDocsMap.size);
    } catch (error) {
        console.error("전체 문서 정보를 불러오는 데 실패했습니다:", error);
    }
}


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
    // processUser는 이제 boolean이 아닌 역할을 반환
    state.currentUserRole = await processUser(user);
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
        // toggleMode에 현재 사용자의 역할을 전달
        if (target.id === 'mode-toggle-btn') toggleMode(state.currentUserRole);
        if (target.id === 'add-new-button') prepareNewDocumentForm(state.allDocsMap);
        // 공지 수정과 관리자 설정 버튼은 Owner만 누를 수 있도록 admin.js에서 제어할 것임
        if (target.id === 'edit-global-notice-button') loadGlobalNoticeEditor();
        if (target.id === 'manage-admins-button') openAdminManagementUI(state.currentUserRole);
        if (target.classList.contains('copy-path-btn')) handleCopyPath(target);
    });
    document.addEventListener('navigateToDoc', handleNavigation);
    document.addEventListener('requestAdminTreeRender', handleAdminTreeRender);
    document.addEventListener('requestViewerMode', handleGoHome);
    document.addEventListener('globalNoticeUpdated', handleGlobalNoticeUpdate);
}

// --- 여기가 수정된 부분이야! ---
// 페이지 로드 시 비동기로 문서들을 먼저 불러오도록 async 추가
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM 로드 완료, 앱 초기화 시작");

    if (!auth) {
        console.error("Firebase Auth가 초기화되지 않았습니다.");
        return;
    }
    
    // 리다이렉트 결과 확인 로직을 삭제합니다.
    
    // UI를 그리거나 다른 로직을 실행하기 전에, 모든 문서 정보를 먼저 불러와서 기다림
    await fetchAllDocuments();
    
    setupEventListeners();
    initResizer();
    onAuthStateChanged(auth, handleAuthStatusChange);
    handleGoHome();
    loadGlobalLeftMargin();
});
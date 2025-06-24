// js/main.js

import { auth, onAuthStateChanged, db, collection, getDocs } from './firebase.js';
import { signInWithGoogle, processUser, handleSignOut } from './auth.js';
import { navigateTo, performSearch, loadGlobalLeftMargin } from './viewer.js';
import { buildAndRenderTree } from './admin/tree.js';
import { prepareNewDocumentForm, loadDocumentIntoEditor } from './admin/editor.js';
import { 
    initResizer, 
    initHorizontalResizer, 
    openAdminManagementUI, 
    toggleMode, 
    loadGlobalNoticeEditor 
} from './admin/ui.js';

const state = {
    allDocsMap: new Map(),
    currentUserRole: null, 
};

const DOMElements = {
    viewerContainer: document.getElementById('viewer-container'),
    adminContainer: document.getElementById('admin-container'),
    searchInput: document.getElementById('searchInput'),
    searchButton: document.getElementById('searchButton'),
    appTitle: document.getElementById('app-title'),
    authStatus: document.getElementById('auth-status'),
};

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

async function handleDocsChange() {
    await fetchAllDocuments();
    buildAndRenderTree(state.allDocsMap);
}

// --- 여기가 수정된 부분입니다 ---
function handleLoadDocToEditor(event) {
    // 이벤트 데이터에서 clickedElement를 추출합니다.
    const { docId, docData, allDocsMap, clickedElement } = event.detail;
    // loadDocumentIntoEditor 함수에 인자로 전달합니다.
    loadDocumentIntoEditor(docId, docData, allDocsMap, clickedElement);
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
    document.body.classList.remove('admin-mode');
    const toggleBtn = document.getElementById('mode-toggle-btn');
    DOMElements.viewerContainer.style.display = 'flex';
    DOMElements.adminContainer.style.display = 'none';
    if (toggleBtn) toggleBtn.textContent = '관리자 페이지';
    navigateTo(state.allDocsMap, null, 'Home');
}

async function handleAuthStatusChange(user) {
    state.currentUserRole = await processUser(user);
    console.log("현재 사용자 역할:", state.currentUserRole);
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

    document.body.addEventListener('click', (e) => {
        const target = e.target;
        if (target.id === 'login-btn') signInWithGoogle();
        if (target.id === 'logout-btn') handleSignOut();
        if (target.id === 'mode-toggle-btn') toggleMode(state.currentUserRole);
        if (target.id === 'add-new-button') prepareNewDocumentForm(state.allDocsMap);
        if (target.id === 'edit-global-notice-button') loadGlobalNoticeEditor();
        if (target.id === 'manage-admins-button') openAdminManagementUI(state.currentUserRole);
        if (target.classList.contains('copy-path-btn')) handleCopyPath(target);
    });

    document.addEventListener('navigateToDoc', handleNavigation);
    document.addEventListener('requestAdminTreeRender', handleAdminTreeRender);
    document.addEventListener('requestViewerMode', handleGoHome);
    document.addEventListener('globalNoticeUpdated', handleGlobalNoticeUpdate);
    document.addEventListener('docsChanged', handleDocsChange);
    document.addEventListener('loadDocToEditor', handleLoadDocToEditor);
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM 로드 완료, 앱 초기화 시작");

    if (!auth) {
        console.error("Firebase Auth가 초기화되지 않았습니다.");
        return;
    }
    
    await fetchAllDocuments();
    
    initResizer();
    initHorizontalResizer();

    setupEventListeners();
    onAuthStateChanged(auth, handleAuthStatusChange);
    handleGoHome();
    loadGlobalLeftMargin();
});
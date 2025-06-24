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

function handleLoadDocToEditor(event) {
    const { docId, docData, allDocsMap, clickedElement } = event.detail;
    loadDocumentIntoEditor(docId, docData, allDocsMap, clickedElement);
}

// --- 여기가 추가된 부분입니다 (1/2) ---
// 뷰어에서 '수정' 버튼 클릭 시 실행될 핸들러
async function handleRequestEditDoc(event) {
    const { docId } = event.detail;
    
    // 1. 관리자 모드로 전환
    // 현재 뷰어 모드일 것이므로, toggleMode를 실행하면 관리자 모드로 바뀝니다.
    toggleMode(state.currentUserRole);

    // 2. 관리자 UI가 준비된 후 문서 로드
    // toggleMode가 동기적으로 UI를 변경하므로, 바로 다음 로직을 실행할 수 있습니다.
    // 더 안정적인 방법은 콜백이나 Promise를 사용하는 것이지만, 현재 구조에서는 이 방식으로도 충분합니다.
    await buildAndRenderTree(state.allDocsMap); // 트리를 먼저 그리고
    
    const docNode = state.allDocsMap.get(docId);
    if (docNode) {
        loadDocumentIntoEditor(docId, docNode.data, state.allDocsMap); // 특정 문서를 편집기에 로드
    }
}


function handleNavigation(event) {
    const { id, title } = event.detail;
    // --- 여기가 수정된 부분입니다 (2/2) ---
    // navigateTo 함수에 현재 사용자 역할을 전달합니다.
    navigateTo(state.allDocsMap, id, title, state.currentUserRole);
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
    navigateTo(state.allDocsMap, null, 'Home', state.currentUserRole);
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
    
    // --- 여기가 추가된 부분입니다 (3/3) ---
    // 새로운 이벤트를 감지합니다.
    document.addEventListener('requestEditDoc', handleRequestEditDoc);
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
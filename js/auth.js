// js/auth.js

import { auth, db, doc, getDoc, GoogleAuthProvider, signInWithPopup, signOut } from './firebase.js';

function getDOMElements() {
    return {
        authStatusContainer: document.getElementById('auth-status'),
        viewerContainer: document.getElementById('viewer-container'),
        adminContainer: document.getElementById('admin-container'),
        appTitle: document.getElementById('app-title'), // 홈으로 가기 위해 추가
        modeToggleButton: document.getElementById('mode-toggle-btn'),
    };
}

function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
        .catch((error) => {
            if (error.code !== 'auth/cancelled-popup-request') {
                console.error("로그인 팝업 에러:", error);
                alert(`로그인 중 에러가 발생했습니다: ${error.message}`);
            }
        });
}

function handleSignOut() {
    signOut(auth).then(() => {
        // 로그아웃 후 UI 초기화 및 뷰어 모드로 강제 전환
        const { viewerContainer, adminContainer, appTitle } = getDOMElements();
        updateAuthUI(null, null);
        viewerContainer.style.display = 'flex';
        adminContainer.style.display = 'none';
        // 홈 화면으로 이동하는 이벤트를 발생시키거나 직접 호출
        appTitle.click(); 
    }).catch(error => {
        console.error("로그아웃 에러:", error);
    });
}

// --- 여기가 수정된 부분이야! ---
// 함수 이름을 checkAdminStatus -> getUserRole로 변경하고 역할(role)을 반환하도록 수정
async function getUserRole(email) {
    if (!db || !email) return null; // 관리자가 아니면 null 반환
    try {
        const adminDocRef = doc(db, 'admins', 'authorized_users');
        const adminDoc = await getDoc(adminDocRef);
        
        if (adminDoc.exists()) {
            // 'emails' 배열 대신 'users' 맵을 사용하도록 수정
            const usersMap = adminDoc.data().users || {};
            // 사용자의 이메일이 맵의 키로 존재하면, 그 값을 (역할) 반환
            if (usersMap.hasOwnProperty(email)) {
                return usersMap[email]; // "owner" 또는 "editor" 반환
            }
        }
        return null; // 문서가 없거나 사용자가 목록에 없으면 null 반환
    } catch (error) {
        console.error("관리자 역할 확인 중 에러:", error);
        return null; // 에러 발생 시에도 권한 없음으로 처리
    }
}

function updateAuthUI(user, role) {
    const { authStatusContainer } = getDOMElements();
    authStatusContainer.innerHTML = ''; // 일단 비우기

    if (user) {
        const userDisplay = document.createElement('div');
        userDisplay.className = 'user-display';
        
        // 역할이 'owner'일 때만 왕관 표시
        const displayName = (role === 'owner' ? '👑 ' : '') + (user.displayName || user.email);
        
        // 역할이 있으면 (editor 또는 owner) 관리자 페이지 버튼 표시
        const adminButtonHTML = role ? '<button id="mode-toggle-btn">관리자 페이지</button>' : '';

        userDisplay.innerHTML = `
            <span class="user-email">${displayName}</span>
            ${adminButtonHTML}
            <button id="logout-btn">로그아웃</button>
        `;
        authStatusContainer.appendChild(userDisplay);

        // UI가 업데이트 된 후에 이벤트 리스너를 다시 연결해야 할 수 있음 (main.js에서 처리)
    } else {
        const loginBtn = document.createElement('button');
        loginBtn.id = 'login-btn';
        loginBtn.textContent = 'Google 계정으로 로그인';
        authStatusContainer.appendChild(loginBtn);
    }
}

// --- 여기가 수정된 부분이야! ---
// processUser가 boolean 대신 role(string 또는 null)을 반환하도록 수정
async function processUser(user) {
    const { viewerContainer, adminContainer, modeToggleButton } = getDOMElements();
    let currentUserRole = null;

    if (user) {
        currentUserRole = await getUserRole(user.email);
        updateAuthUI(user, currentUserRole);

        // 사용자가 관리자가 아닌 경우, 관리자 페이지가 보이면 뷰어 모드로 전환
        if (!currentUserRole && adminContainer.style.display === 'flex') {
            viewerContainer.style.display = 'flex';
            adminContainer.style.display = 'none';
            if(modeToggleButton) modeToggleButton.textContent = '관리자 페이지';
        }
    } else {
        // 로그아웃 상태
        updateAuthUI(null, null);
        // 항상 뷰어 모드로
        viewerContainer.style.display = 'flex';
        adminContainer.style.display = 'none';
    }
    
    // 확인된 최종 역할을 반환
    return currentUserRole;
}

export { signInWithGoogle, processUser, handleSignOut };
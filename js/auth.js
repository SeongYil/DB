// signInWithPopup을 다시 import 합니다.
import { auth, db, doc, getDoc, GoogleAuthProvider, signInWithPopup, signOut } from './firebase.js';

function getDOMElements() {
    return {
        authStatusContainer: document.getElementById('auth-status'),
        viewerContainer: document.getElementById('viewer-container'),
        adminContainer: document.getElementById('admin-container'),
    };
}

// signInWithRedirect를 다시 signInWithPopup으로 변경
function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
        .catch((error) => {
            // 팝업창을 닫거나 할 때 발생하는 에러는 무시하고, 다른 중요한 에러만 표시
            if (error.code !== 'auth/cancelled-popup-request') {
                console.error("로그인 팝업 에러:", error);
                alert(`로그인 중 에러가 발생했습니다: ${error.message}`);
            }
        });
}

function handleSignOut() {
    signOut(auth);
}

async function checkAdminStatus(email) {
    if (!db || !email) return false;
    try {
        const adminDocRef = doc(db, 'admins', 'authorized_users');
        const adminDoc = await getDoc(adminDocRef);
        if (adminDoc.exists()) {
            const adminEmails = adminDoc.data().emails || [];
            return adminEmails.includes(email);
        }
        return false;
    } catch (error) {
        console.error("관리자 확인 중 에러:", error);
        return false;
    }
}

function updateAuthUI(user, isAdmin) {
    const { authStatusContainer } = getDOMElements();
    authStatusContainer.innerHTML = '';
    
    if (user) {
        const userDisplay = document.createElement('div');
        userDisplay.className = 'user-display';
        userDisplay.innerHTML = `
            <span class="user-email">${isAdmin ? '👑' : ''} ${user.displayName || user.email}</span>
            ${isAdmin ? '<button id="mode-toggle-btn">관리자 페이지</button>' : ''}
            <button id="logout-btn">로그아웃</button>
        `;
        authStatusContainer.appendChild(userDisplay);
    } else {
        const loginBtn = document.createElement('button');
        loginBtn.id = 'login-btn';
        loginBtn.textContent = 'Google 계정으로 로그인';
        authStatusContainer.appendChild(loginBtn);
    }
}

async function processUser(user) {
    const { viewerContainer, adminContainer } = getDOMElements();
    let isCurrentUserAdmin = false;

    if (user) {
        isCurrentUserAdmin = await checkAdminStatus(user.email);
        updateAuthUI(user, isCurrentUserAdmin);
        if (!isCurrentUserAdmin) {
            viewerContainer.style.display = 'flex';
            adminContainer.style.display = 'none';
        }
    } else {
        isCurrentUserAdmin = false;
        updateAuthUI(null, false);
        viewerContainer.style.display = 'flex';
        adminContainer.style.display = 'none';
    }
    return isCurrentUserAdmin;
}

export { signInWithGoogle, processUser, handleSignOut };
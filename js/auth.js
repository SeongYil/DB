import { auth, db, doc, getDoc, GoogleAuthProvider, signInWithPopup, signOut } from './firebase.js';

function getDOMElements() {
    return {
        authStatusContainer: document.getElementById('auth-status'),
        viewerContainer: document.getElementById('viewer-container'),
        adminContainer: document.getElementById('admin-container'),
    };
}

function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
        .catch((error) => {
            console.error("로그인 팝업 에러:", error);
            // ui.js 모듈이 없으므로 alert 사용 또는 main에서 처리
            alert(`로그인 중 에러가 발생했습니다: ${error.code}`);
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

        document.getElementById('logout-btn').addEventListener('click', handleSignOut);
        
        if (isAdmin) {
            const toggleBtn = document.getElementById('mode-toggle-btn');
            // 이벤트는 main.js에서 위임하여 처리
        }
    } else {
        const loginBtn = document.createElement('button');
        loginBtn.id = 'login-btn';
        loginBtn.textContent = 'Google 계정으로 로그인';
        loginBtn.addEventListener('click', signInWithGoogle);
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

export { signInWithGoogle, processUser , handleSignOut};
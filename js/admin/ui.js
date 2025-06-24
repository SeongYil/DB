import * as firebase from '../firebase.js';
import * as ui from '../ui.js';

let isResizing = false;
let isHorizontalResizing = false;

export function updateAdminButtonVisibility(role) {
    const noticeBtn = document.getElementById('edit-global-notice-button');
    const adminBtn = document.getElementById('manage-admins-button');

    if (!noticeBtn || !adminBtn) return;

    if (role === 'owner') {
        noticeBtn.style.display = 'inline-block';
        adminBtn.style.display = 'inline-block';
    } else { 
        noticeBtn.style.display = 'none';
        adminBtn.style.display = 'none';
    }
}

export async function openAdminManagementUI(currentUserRole) {
    if (currentUserRole !== 'owner') {
        ui.showModalAlert('이 기능에 접근할 권한이 없습니다.');
        return;
    }
    
    ui.closeModal();
    const authorizedUsers = await fetchAuthorizedUsers();
    
    const userListHTML = Object.entries(authorizedUsers).length > 0 
        ? Object.entries(authorizedUsers).map(([email, role]) => `
            <li>
                <div class="user-info">
                    <span class="email">${email}</span>
                    <span class="role-badge ${role}">${role}</span>
                </div>
                <div class="user-actions">
                    <select class="role-select" data-email="${email}">
                        <option value="owner" ${role === 'owner' ? 'selected' : ''}>Owner</option>
                        <option value="editor" ${role === 'editor' ? 'selected' : ''}>Editor</option>
                    </select>
                    <button class="remove-user-btn" data-email="${email}">삭제</button>
                </div>
            </li>`).join('')
        : '<li>등록된 관리자가 없습니다.</li>';

    const modalContentHTML = `
        <h3>관리자 권한 설정</h3>
        <div class="admin-management-box">
            <div class="form-group">
                <label>새 관리자 추가</label>
                <div class="input-with-button">
                    <input type="email" id="new-admin-email-modal" placeholder="admin@example.com">
                    <select id="new-admin-role-select">
                        <option value="editor">Editor</option>
                        <option value="owner">Owner</option>
                    </select>
                    <button id="add-admin-btn-modal">추가</button>
                </div>
            </div>
            <div class="form-group">
                <label>현재 관리자 목록</label>
                <ul id="admin-user-list">${userListHTML}</ul>
            </div>
        </div>
        <style>
            #admin-user-list { list-style: none; padding: 0; max-height: 250px; overflow-y: auto; }
            #admin-user-list li { display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #ecf0f1; }
            .user-info { display: flex; flex-direction: column; }
            .user-info .email { font-weight: bold; }
            .role-badge { font-size: 12px; padding: 2px 6px; border-radius: 10px; color: white; margin-top: 4px; text-transform: capitalize; }
            .role-badge.owner { background-color: #8e44ad; }
            .role-badge.editor { background-color: #2980b9; }
            .user-actions { display: flex; align-items: center; gap: 10px; }
            .role-select { padding: 5px; border-radius: 4px; }
            .remove-user-btn { background-color: #c0392b; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; }
        </style>
    `;

    ui.showModal({ content: modalContentHTML, id: 'admin-management-modal' });

    const modalNode = document.getElementById('admin-management-modal');
    modalNode.querySelector('#add-admin-btn-modal').addEventListener('click', () => addUser(currentUserRole));
    modalNode.querySelectorAll('.role-select').forEach(select => select.addEventListener('change', (e) => updateUserRole(e, currentUserRole)));
    modalNode.querySelectorAll('.remove-user-btn').forEach(btn => btn.addEventListener('click', (e) => removeUser(e, currentUserRole)));
}

async function fetchAuthorizedUsers() {
    try {
        const docSnap = await firebase.getDoc(firebase.doc(firebase.db, 'admins', 'authorized_users'));
        return docSnap.exists() ? docSnap.data().users || {} : {};
    } catch (error) {
        console.error("관리자 목록 로딩 에러:", error);
        return {};
    }
}

async function updateUser(usersData, currentUserRole) {
    try {
        await firebase.setDoc(firebase.doc(firebase.db, 'admins', 'authorized_users'), { users: usersData });
        await openAdminManagementUI(currentUserRole);
    } catch (error) {
        console.error("관리자 정보 업데이트 에러:", error);
        ui.showModalAlert("관리자 정보 업데이트에 실패했습니다.");
    }
}

async function addUser(currentUserRole) {
    const emailInput = document.getElementById('new-admin-email-modal');
    const roleSelect = document.getElementById('new-admin-role-select');
    const email = emailInput.value.trim();
    const role = roleSelect.value;

    if (!email) { ui.showModalAlert("이메일을 입력하세요."); return; }
    
    const users = await fetchAuthorizedUsers();
    if (users[email]) {
        ui.showModalAlert("이미 등록된 이메일입니다.");
        return;
    }
    users[email] = role;
    await updateUser(users, currentUserRole);
}

async function updateUserRole(event, currentUserRole) {
    const email = event.target.dataset.email;
    const newRole = event.target.value;
    const users = await fetchAuthorizedUsers();
    if (users[email]) {
        users[email] = newRole;
        await updateUser(users, currentUserRole);
    }
}

async function removeUser(event, currentUserRole) {
    const emailToRemove = event.target.dataset.email;
    
    const self = firebase.auth.currentUser;
    if (self && self.email === emailToRemove) {
        ui.showModalAlert("자기 자신을 삭제할 수 없습니다.");
        return;
    }

    ui.showModal({
        content: `<p style="margin-top:0;">'${emailToRemove}' 사용자를 정말 삭제하시겠습니까?</p>`,
        confirmText: '삭제',
        confirmId: 'modal-confirm-delete',
        onConfirm: async () => {
            const users = await fetchAuthorizedUsers();
            if (users[emailToRemove]) {
                delete users[emailToRemove];
                await updateUser(users, currentUserRole);
            }
            ui.closeModal();
        }
    });
}

export async function loadGlobalNoticeEditor() {
    const editorContent = document.getElementById('editor-content');
    editorContent.innerHTML = '<p class="info-text">안내문 내용을 불러오는 중...</p>';
    try {
        const docSnap = await firebase.getDoc(firebase.doc(firebase.db, "globals", "left_margin"));
        const currentContent = docSnap.exists() ? docSnap.data().content : '';
        editorContent.innerHTML = `
            <h3>공지/안내문 수정</h3>
            <div class="form-group"><label><span>모든 페이지 좌측에 공통으로 표시될 내용</span></label><textarea id="global-notice-textarea" style="min-height: 200px; resize: vertical;"></textarea></div>
            <div class="button-group"><button id="save-global-notice-button">저장하기</button></div>`;
        document.getElementById('global-notice-textarea').value = currentContent;
        document.getElementById('save-global-notice-button').onclick = saveGlobalNotice;
    } catch (error) {
        console.error("안내문 편집기 로딩 오류:", error);
        editorContent.innerHTML = '<p class="info-text">편집기를 불러오는 데 실패했습니다.</p>';
    }
}

async function saveGlobalNotice() {
    const saveButton = document.getElementById('save-global-notice-button');
    const newContent = document.getElementById('global-notice-textarea').value;
    saveButton.textContent = '저장 중...'; saveButton.disabled = true;
    try {
        await firebase.setDoc(firebase.doc(firebase.db, "globals", "left_margin"), { content: newContent });
        ui.showModalAlert("안내문이 저장되었습니다.");
        document.dispatchEvent(new CustomEvent('globalNoticeUpdated'));
    } catch (error) {
        console.error("안내문 저장 오류:", error); ui.showModalAlert("저장에 실패했습니다.");
    } finally {
        saveButton.textContent = '저장하기'; saveButton.disabled = false;
    }
}

export function toggleMode(role) { 
    if (!role) { 
        ui.showModalAlert("관리자만 접근할 수 있는 페이지입니다.");
        return;
    }

    const viewerContainer = document.getElementById('viewer-container');
    const adminContainer = document.getElementById('admin-container');
    const toggleBtn = document.getElementById('mode-toggle-btn');
    const isViewerVisible = viewerContainer.style.display !== 'none';
    
    if (isViewerVisible) {
        document.body.classList.add('admin-mode');
        viewerContainer.style.display = 'none';
        adminContainer.style.display = 'flex';
        if (toggleBtn) toggleBtn.textContent = '뷰어 모드로';
        updateAdminButtonVisibility(role); 
        document.dispatchEvent(new CustomEvent('requestAdminTreeRender'));
    } else {
        document.dispatchEvent(new CustomEvent('requestViewerMode'));
    }
}

export function initResizer() {
    const resizer = document.getElementById('resizer');
    if(resizer) resizer.addEventListener('mousedown', (e) => {
        isResizing = true; e.preventDefault();
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    });
}

function handleMouseMove(e) {
    if (!isResizing) return;
    const treeContainer = document.getElementById('tree-container');
    if (!treeContainer || !treeContainer.parentElement) return;
    const containerRect = treeContainer.parentElement.getBoundingClientRect();
    let newLeftWidth = e.clientX - containerRect.left;
    if (newLeftWidth < 200) newLeftWidth = 200;
    if (newLeftWidth > containerRect.width - 200) newLeftWidth = containerRect.width - 200;
    treeContainer.style.width = `${newLeftWidth}px`;
}

function handleMouseUp() {
    isResizing = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
}

export function initHorizontalResizer() {
    const horizontalResizer = document.getElementById('horizontal-resizer');
    if (horizontalResizer) {
        horizontalResizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isHorizontalResizing = true;
            document.addEventListener('mousemove', handleHorizontalMouseMove);
            document.addEventListener('mouseup', handleHorizontalMouseUp);
        });
    }
}

function handleHorizontalMouseMove(e) {
    if (!isHorizontalResizing) return;
    const treeHeader = document.querySelector('.tree-header');
    const treeContainer = document.getElementById('tree-container');
    if (!treeHeader || !treeContainer) return;
    const containerRect = treeContainer.getBoundingClientRect();
    let newHeaderHeight = e.clientY - containerRect.top;
    const minHeight = 45;
    const maxHeight = treeContainer.clientHeight - 80;
    if (newHeaderHeight < minHeight) newHeaderHeight = minHeight;
    if (newHeaderHeight > maxHeight) newHeaderHeight = maxHeight;
    treeHeader.style.height = `${newHeaderHeight}px`;
}

function handleHorizontalMouseUp() {
    isHorizontalResizing = false;
    document.removeEventListener('mousemove', handleHorizontalMouseMove);
    document.removeEventListener('mouseup', handleHorizontalMouseUp);
}
import * as firebase from './firebase.js';
import * as ui from './ui.js';

// --- 모듈 상태 변수 ---
let currentSelectedDocId = null;
const EXPANDED_STATE_KEY = 'treeExpandedState';
let isResizing = false;

// --- DOM 요소 캐싱 ---
function getDOMElements() {
    return {
        editorContent: document.getElementById('editor-content'),
        treeRoot: document.getElementById('tree-root'),
        treeContainer: document.getElementById('tree-container'),
        resizer: document.getElementById('resizer'),
    };
}

// --- 로컬 스토리지 상태 관리 ---
function getExpandedState() {
    try {
        return localStorage.getItem(EXPANDED_STATE_KEY) ? JSON.parse(localStorage.getItem(EXPANDED_STATE_KEY)) : [];
    } catch {
        return [];
    }
}
function saveExpandedState(expandedIds) {
    try {
        localStorage.setItem(EXPANDED_STATE_KEY, JSON.stringify(expandedIds));
    } catch (e) {
        console.error("로컬 스토리지 저장 실패", e)
    }
}

// --- 문서 편집 ---
function prepareNewDocumentForm(allDocsMap) {
    currentSelectedDocId = null;
    const currentActive = document.querySelector('#tree-root .tree-item-title.active');
    if (currentActive) {
        currentActive.classList.remove('active');
    }
    loadDocumentIntoEditor(null, { title: '', contents: '', keywords: [], parentIds: [] }, allDocsMap);
    const titleInput = document.getElementById('editor-title-input');
    if (titleInput) titleInput.focus();
}

async function saveChanges(allDocsMap) {
    const newTitle = document.getElementById('editor-title-input').value.trim();
    if (!newTitle) {
        ui.showModalAlert("제목은 필수 항목입니다.");
        return;
    }
    const newContents = document.getElementById('editor-contents-textarea').value;
    const parentSpans = document.querySelectorAll('#parent-display .parent-tag');
    const newParentIds = Array.from(parentSpans).map(span => span.dataset.parentId);
    const newKeywords = Array.from(document.querySelectorAll('.tag-item')).map(tag => tag.firstChild.textContent.trim());
    const newKeywordsLowercase = newKeywords.map(kw => kw.toLowerCase());
    
    const saveButton = document.getElementById('save-button');
    saveButton.textContent = '저장 중...';
    saveButton.disabled = true;

    try {
        const docData = { title: newTitle, contents: newContents, keywords: newKeywords, keywords_lowercase: newKeywordsLowercase, parentIds: newParentIds };
        if (currentSelectedDocId) {
            await firebase.updateDoc(firebase.doc(firebase.db, "helps", currentSelectedDocId), docData);
        } else {
            const docRef = await firebase.addDoc(firebase.collection(firebase.db, "helps"), docData);
            currentSelectedDocId = docRef.id;
        }
        // 저장 후에는 전체 문서를 다시 불러와서 state를 최신화하고 트리를 다시 그림
        const snapshot = await firebase.getDocs(firebase.collection(firebase.db, "helps"));
        allDocsMap.clear();
        snapshot.forEach(doc => allDocsMap.set(doc.id, { id: doc.id, data: doc.data(), children: [] }));
        await buildAndRenderTree(allDocsMap);

    } catch (error) {
        console.error("저장 중 오류 발생:", error);
        ui.showModalAlert("저장에 실패했습니다.");
    } finally {
        const finalSaveButton = document.getElementById('save-button');
        if (finalSaveButton) {
            finalSaveButton.textContent = '저장하기';
            finalSaveButton.disabled = false;
        }
    }
}

async function deleteDocument(allDocsMap) {
    if (!currentSelectedDocId) {
        ui.showModalAlert("삭제할 항목을 먼저 선택해주세요.");
        return;
    }
    ui.showModal({
        content: `<p style="margin-top:0;">정말 이 문서를 삭제하시겠습니까? 하위 문서들의 연결이 끊어질 수 있습니다.</p>`,
        confirmText: '삭제', confirmId: 'modal-confirm-delete', modalClass: 'modal-confirm',
        onConfirm: async () => {
            ui.closeModal();
            try {
                await firebase.deleteDoc(firebase.doc(firebase.db, "helps", currentSelectedDocId));
                getDOMElements().editorContent.innerHTML = '<p class="info-text">왼쪽 트리에서 항목을 선택하거나, 새 문서를 추가하세요.</p>';
                
                // 문서 삭제 후 allDocsMap에서도 해당 항목을 제거
                allDocsMap.delete(currentSelectedDocId);
                currentSelectedDocId = null;

                await buildAndRenderTree(allDocsMap);
            } catch (error) {
                console.error("삭제 중 오류 발생:", error);
                ui.showModalAlert("삭제에 실패했습니다.");
            }
        }
    });
}

function loadDocumentIntoEditor(docId, docData, allDocsMap) {
    const { editorContent } = getDOMElements();
    currentSelectedDocId = docId;
    const parentIds = docData.parentIds || [];

    editorContent.innerHTML = `
        <h3>${docData.title || '새 문서 작성'}</h3>
        <div class="form-group"><label for="editor-title-input">제목</label><input type="text" id="editor-title-input" value="${docData.title || ''}"></div>
        <div class="form-group">
            <label for="editor-contents-textarea"><span>내용</span><span class="label-buttons"><button id="add-hyperlink-btn" class="inline-btn">하이퍼링크 추가</button><button id="add-filepath-btn" class="inline-btn">폴더/파일 경로 추가</button></span></label>
            <textarea id="editor-contents-textarea" placeholder="여기에 내용을 입력하세요... HTML 태그 사용이 가능합니다."></textarea>
        </div>
        <div class="form-group"><label>검색 키워드</label><div id="tag-container" class="tag-input-container"><input type="text" id="tag-input" placeholder="키워드 입력 후 Enter"></div></div>
        <div class="form-group"><label>부모 문서</label><div id="parent-display-wrapper"><div id="parent-display"></div><button id="change-parent-btn">변경</button></div></div>
        <div class="button-group"><button id="save-button">저장하기</button>${docId ? '<button id="delete-button">삭제하기</button>' : ''}</div>
    `;

    updateParentDisplay(parentIds, allDocsMap);
    
    document.getElementById('save-button').onclick = () => saveChanges(allDocsMap);
    if (docId) document.getElementById('delete-button').onclick = () => deleteDocument(allDocsMap);

    const mainTextarea = document.getElementById('editor-contents-textarea');
    mainTextarea.value = docData.contents || '';
    function autoResize() { this.style.height = 'auto'; this.style.height = (this.scrollHeight) + 'px'; }
    mainTextarea.addEventListener('input', autoResize, false);
    setTimeout(() => autoResize.call(mainTextarea), 0);

    document.getElementById('add-hyperlink-btn').onclick = () => ui.openHyperlinkModal(() => {
        const text = document.getElementById('link-text-input').value.trim();
        let url = document.getElementById('link-url-input').value.trim();
        if (!text || !url) { ui.showModalAlert('내용과 경로를 모두 입력해주세요.'); return; }
        if (!url.toLowerCase().startsWith('http')) url = 'https://' + url;
        const link = `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        ui.insertTextIntoTextarea(link);
        ui.closeModal();
    });

    document.getElementById('add-filepath-btn').onclick = () => ui.openFilePathModal(() => {
        const path = document.getElementById('filepath-input').value.trim();
        if(!path) { ui.showModalAlert('경로를 입력해주세요.'); return; }
        const filePathHtml = `<div class="file-path-container"><span class="path-text">${path}</span><button type="button" class="copy-path-btn" data-path="${path}">복사</button></div>`;
        ui.insertTextIntoTextarea(filePathHtml);
        ui.closeModal();
    });

    document.getElementById('change-parent-btn').onclick = () => setupParentSelectorModal(parentIds, allDocsMap);
    ui.setupTagInput(docData.keywords || []);
}

function updateParentDisplay(parentIds, allDocsMap) {
    const parentDisplay = document.getElementById('parent-display');
    parentDisplay.innerHTML = '';
    if (parentIds && parentIds.length > 0) {
        parentIds.forEach(pId => {
            const parentNode = allDocsMap.get(pId);
            if (parentNode) {
                const parentTag = document.createElement('div');
                parentTag.className = 'parent-tag';
                parentTag.dataset.parentId = pId;
                parentTag.innerHTML = `<span>${parentNode.data.title}</span><span class="remove-parent-tag" title="삭제">x</span>`;
                parentDisplay.appendChild(parentTag);
            }
        });
    } else {
        parentDisplay.textContent = '없음';
    }
    parentDisplay.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-parent-tag')) {
            e.target.parentElement.remove();
            if (parentDisplay.children.length === 0) parentDisplay.textContent = '없음';
        }
    });
}

// --- 트리 뷰 관리 ---
async function buildAndRenderTree(allDocsMap) {
    const { treeRoot } = getDOMElements();
    treeRoot.innerHTML = '<p class="info-text">트리 구조를 만드는 중...</p>';
    try {
        if (allDocsMap.size === 0) {
            treeRoot.innerHTML = '<p class="info-text">표시할 데이터가 없습니다.</p>';
            return;
        }
        
        const tree = buildTreeFromMap(allDocsMap);
        tree.sort((a, b) => a.data.title.localeCompare(b.data.title, 'ko'));
        treeRoot.innerHTML = '';
        const rootUl = document.createElement('ul');
        treeRoot.appendChild(rootUl);
        renderTree(tree, rootUl, false, [], allDocsMap, new Set());

        if (currentSelectedDocId && document.getElementById('parent-display')) {
            const docData = allDocsMap.get(currentSelectedDocId)?.data;
            if (docData) updateParentDisplay(docData.parentIds || [], allDocsMap);
        }
    } catch (error) {
        console.error("트리 생성 중 오류:", error);
        treeRoot.innerHTML = '<p class="info-text">데이터를 불러오는 데 실패했습니다.</p>';
    }
}

function buildTreeFromMap(allDocsMap) {
    allDocsMap.forEach(node => {
        if (node) node.children = [];
    });
    
    const tree = [];

    allDocsMap.forEach(node => {
        if (!node || !node.data) return; 

        const parentIds = node.data.parentIds || [];

        if (parentIds.length === 0) {
            tree.push(node);
            return;
        }

        let hasAtLeastOneValidParent = false;
        parentIds.forEach(parentId => {
            const parentNode = allDocsMap.get(parentId);
            if (parentNode) {
                parentNode.children.push(node);
                hasAtLeastOneValidParent = true;
            } else {
                console.warn(`문서 '${node.data.title}' (ID: ${node.id})가 존재하지 않는 부모(ID: ${parentId})를 참조합니다.`);
            }
        });

        if (!hasAtLeastOneValidParent) {
            tree.push(node);
        }
    });

    allDocsMap.forEach(node => {
        if (node && node.children && node.children.length > 1) {
            node.children = Array.from(new Map(node.children.map(c => [c.id, c])).values());
        }
        if (node && node.children && node.children.length > 0) {
            node.children.sort((a, b) => a.data.title.localeCompare(b.data.title, 'ko'));
        }
    });

    return tree;
}

function renderTree(nodes, container, isModal, checkedIds, allDocsMap, ancestorPath) {
    nodes.forEach(node => {
        if (ancestorPath.has(node.id)) {
            console.warn(`순환 참조가 발견되었습니다. ID: ${node.id}, 제목: ${node.data.title}. 이 하위 트리는 렌더링하지 않습니다.`);
            return;
        }
        
        const newAncestorPath = new Set(ancestorPath).add(node.id);

        const listItem = document.createElement('li');
        const hasChildren = node.children && node.children.length > 0;
        const itemContainer = document.createElement('div');
        itemContainer.className = 'item-container';

        if (hasChildren) {
            const expandedIds = isModal ? [] : getExpandedState();
            const isCollapsed = !expandedIds.includes(node.id);
            if (!isModal) listItem.classList.toggle('collapsed', isCollapsed);
            else listItem.classList.add('collapsed');
            const toggleBtn = document.createElement('span');
            toggleBtn.className = 'toggle-btn';
            toggleBtn.textContent = listItem.classList.contains('collapsed') ? '▸' : '▾';
            toggleBtn.onclick = (e) => {
                e.stopPropagation();
                const nowIsCollapsed = listItem.classList.toggle('collapsed');
                toggleBtn.textContent = nowIsCollapsed ? '▸' : '▾';
                if (!isModal) {
                    let currentState = getExpandedState();
                    if (nowIsCollapsed) currentState = currentState.filter(id => id !== node.id);
                    else if (!currentState.includes(node.id)) currentState.push(node.id);
                    saveExpandedState(currentState);
                }
            };
            itemContainer.appendChild(toggleBtn);
        } else {
            const emptySpan = document.createElement('span');
            emptySpan.style.display = 'inline-block';
            emptySpan.style.width = '20px';
            itemContainer.appendChild(emptySpan);
        }
        if (isModal) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'modal-checkbox';
            checkbox.dataset.id = node.id;
            checkbox.dataset.title = node.data.title;
            if (checkedIds.includes(node.id)) checkbox.checked = true;
            if (node.id === currentSelectedDocId) checkbox.disabled = true;
            itemContainer.appendChild(checkbox);
        }
        const titleSpan = document.createElement('span');
        titleSpan.className = 'tree-item-title';
        titleSpan.textContent = node.data.title;
        titleSpan.dataset.id = node.id;
        if (!isModal) {
            titleSpan.draggable = true;
            titleSpan.addEventListener('dragstart', (e) => {
                e.stopPropagation(); e.dataTransfer.setData('text/plain', node.id);
                e.dataTransfer.effectAllowed = 'move'; setTimeout(() => e.target.classList.add('dragging'), 0);
            });
            titleSpan.addEventListener('dragend', (e) => e.target.classList.remove('dragging'));
            titleSpan.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.target.classList.add('drop-target'); });
            titleSpan.addEventListener('dragleave', (e) => e.target.classList.remove('drop-target'));
            titleSpan.addEventListener('drop', (e) => handleDrop(e, allDocsMap));
            titleSpan.onclick = () => {
                const currentActive = document.querySelector('#tree-root .tree-item-title.active');
                if (currentActive) currentActive.classList.remove('active');
                titleSpan.classList.add('active');
                loadDocumentIntoEditor(node.id, node.data, allDocsMap);
            };
        }
        itemContainer.appendChild(titleSpan);
        listItem.appendChild(itemContainer);
        if (hasChildren) {
            const childrenContainer = document.createElement('ul');
            listItem.appendChild(childrenContainer);
            renderTree(node.children, childrenContainer, isModal, checkedIds, allDocsMap, newAncestorPath);
        }
        container.appendChild(listItem);
    });
}


async function handleDrop(e, allDocsMap) {
    e.preventDefault(); e.stopPropagation(); e.target.classList.remove('drop-target');
    const draggedDocId = e.dataTransfer.getData('text/plain');
    const newParentId = e.target.dataset.id;
    if (draggedDocId === newParentId) return;
    
    let tempId = newParentId;
    while (tempId) {
        if (tempId === draggedDocId) {
            ui.showModalAlert("자신의 하위 항목으로 문서를 이동할 수 없습니다.");
            return;
        }
        const parentNode = allDocsMap.get(tempId);
        if (!parentNode || !parentNode.data.parentIds || parentNode.data.parentIds.length === 0) break;
        tempId = parentNode.data.parentIds[0];
    }

    try {
        const draggedDoc = allDocsMap.get(draggedDocId);
        if (draggedDoc) {
            draggedDoc.data.parentIds = [newParentId];
            await firebase.updateDoc(firebase.doc(firebase.db, "helps", draggedDocId), { parentIds: [newParentId] });
            await buildAndRenderTree(allDocsMap);
        }
    } catch (error) {
        console.error("부모 변경 중 오류:", error);
        ui.showModalAlert("부모를 변경하는 데 실패했습니다.");
    }
}

function filterTree(nodes, filterText, ancestorPath = new Set()) {
    const filteredNodes = [];
    for (const node of nodes) {
        if (ancestorPath.has(node.id)) {
            continue;
        }
        const newAncestorPath = new Set(ancestorPath).add(node.id);
        
        let matches = node.data.title.toLowerCase().includes(filterText);
        let children = (node.children && node.children.length > 0) ? filterTree(node.children, filterText, newAncestorPath) : [];
        if (matches || children.length > 0) {
            filteredNodes.push({ ...node, children: children });
        }
    }
    return filteredNodes;
}

function setupParentSelectorModal(currentParentIds, allDocsMap) {
    const content = `<h3>부모 문서 선택</h3><input type="text" id="modal-search-input" placeholder="검색으로 필터링..."><div id="modal-tree-container"></div>`;
    ui.showModal({
        content: content,
        confirmText: '선택 완료',
        onConfirm: () => {
            const selectedIds = Array.from(document.querySelectorAll('#modal-tree-container input[type="checkbox"]:checked')).map(cb => cb.dataset.id);
            updateParentDisplay(selectedIds, allDocsMap);
            ui.closeModal();
        }
    });

    const modalTreeContainer = document.getElementById('modal-tree-container');
    const searchInput = document.getElementById('modal-search-input');
    const renderModalTree = (filterText = '') => {
        modalTreeContainer.innerHTML = '';
        const rootUl = document.createElement('ul');
        modalTreeContainer.appendChild(rootUl);
        const tree = buildTreeFromMap(allDocsMap);
        tree.sort((a, b) => a.data.title.localeCompare(b.data.title, 'ko'));
        const filteredTree = filterText ? filterTree(tree, filterText.toLowerCase()) : tree;
        renderTree(filteredTree, rootUl, true, currentParentIds, allDocsMap, new Set());
    };
    renderModalTree();
    searchInput.addEventListener('input', () => renderModalTree(searchInput.value));
}

function updateAdminButtonVisibility(role) {
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

async function openAdminManagementUI(currentUserRole) {
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


async function loadGlobalNoticeEditor() {
    const { editorContent } = getDOMElements();
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

function toggleMode(role) { 
    if (!role) { // 역할이 없으면(null) 관리자 모드 진입 불가
        ui.showModalAlert("관리자만 접근할 수 있는 페이지입니다.");
        return;
    }

    const viewerContainer = document.getElementById('viewer-container');
    const adminContainer = document.getElementById('admin-container');
    const toggleBtn = document.getElementById('mode-toggle-btn');
    const isViewerVisible = viewerContainer.style.display !== 'none';
    
    if (isViewerVisible) {
        viewerContainer.style.display = 'none';
        adminContainer.style.display = 'flex';
        if (toggleBtn) toggleBtn.textContent = '뷰어 모드로';
        
        updateAdminButtonVisibility(role); 
        document.dispatchEvent(new CustomEvent('requestAdminTreeRender'));
    } else {
        document.dispatchEvent(new CustomEvent('requestViewerMode'));
    }
}

function initResizer() {
    const { resizer } = getDOMElements();
    if(resizer) resizer.addEventListener('mousedown', (e) => {
        isResizing = true; e.preventDefault();
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    });
}
function handleMouseMove(e) {
    if (!isResizing) return;
    const { treeContainer } = getDOMElements();
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

export {
    prepareNewDocumentForm,
    buildAndRenderTree,
    toggleMode,
    initResizer,
    loadGlobalNoticeEditor,
    openAdminManagementUI,
};
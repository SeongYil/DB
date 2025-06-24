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
    treeRoot.innerHTML = '<p class="info-text">데이터 로딩 중...</p>';
    try {
        const snapshot = await firebase.getDocs(firebase.collection(firebase.db, "helps"));
        if (snapshot.empty) {
            treeRoot.innerHTML = '<p class="info-text">데이터가 없습니다.</p>';
            return;
        }
        allDocsMap.clear();
        snapshot.forEach(doc => allDocsMap.set(doc.id, { id: doc.id, data: doc.data(), children: [] }));
        const tree = buildTreeFromMap(allDocsMap);
        tree.sort((a, b) => a.data.title.localeCompare(b.data.title, 'ko'));
        treeRoot.innerHTML = '';
        const rootUl = document.createElement('ul');
        treeRoot.appendChild(rootUl);
        renderTree(tree, rootUl, false, [], allDocsMap);

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
    allDocsMap.forEach(node => node.children = []);
    const tree = [];
    allDocsMap.forEach(node => {
        const parentIds = node.data.parentIds || [];
        if (parentIds.length === 0) tree.push(node);
        else parentIds.forEach(parentId => { if (allDocsMap.has(parentId)) allDocsMap.get(parentId).children.push(node); });
    });
    allDocsMap.forEach(node => {
        if (node.children.length > 1) node.children = Array.from(new Map(node.children.map(c => [c.id, c])).values());
        if (node.children.length > 0) node.children.sort((a, b) => a.data.title.localeCompare(b.data.title, 'ko'));
    });
    return tree;
}

function renderTree(nodes, container, isModal, checkedIds, allDocsMap) {
    nodes.forEach(node => {
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
            renderTree(node.children, childrenContainer, isModal, checkedIds, allDocsMap);
        }
        container.appendChild(listItem);
    });
}

async function handleDrop(e, allDocsMap) {
    e.preventDefault(); e.stopPropagation(); e.target.classList.remove('drop-target');
    const draggedDocId = e.dataTransfer.getData('text/plain');
    const newParentId = e.target.dataset.id;
    if (draggedDocId === newParentId) return;
    
    // 순환 종속성 체크
    let tempId = newParentId;
    while (tempId) {
        if (tempId === draggedDocId) {
            ui.showModalAlert("자신의 하위 항목으로 문서를 이동할 수 없습니다.");
            return;
        }
        const parentNode = allDocsMap.get(tempId);
        if (!parentNode || !parentNode.data.parentIds || parentNode.data.parentIds.length === 0) break;
        tempId = parentNode.data.parentIds[0]; // 단순화를 위해 첫 번째 부모만 따라감
    }

    try {
        await firebase.updateDoc(firebase.doc(firebase.db, "helps", draggedDocId), { parentIds: [newParentId] });
        await buildAndRenderTree(allDocsMap);
    } catch (error) {
        console.error("부모 변경 중 오류:", error);
        ui.showModalAlert("부모를 변경하는 데 실패했습니다.");
    }
}

function filterTree(nodes, filterText) {
    const filteredNodes = [];
    for (const node of nodes) {
        let matches = node.data.title.toLowerCase().includes(filterText);
        let children = (node.children && node.children.length > 0) ? filterTree(node.children, filterText) : [];
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
        renderTree(filteredTree, rootUl, true, currentParentIds, allDocsMap);
    };
    renderModalTree();
    searchInput.addEventListener('input', () => renderModalTree(searchInput.value));
}

// --- 관리자/공지 관리 ---
async function openAdminManagementUI() {
    ui.closeModal();
    const fetchedAdmins = await fetchAdmins();
    const adminList = Array.isArray(fetchedAdmins) ? fetchedAdmins : [];
    const modalContentHTML = `
        <h3>관리자 권한 설정</h3><div class="admin-management-box">
        <div class="form-group"><label>새 관리자 이메일 추가</label><div class="input-with-button"><input type="email" id="new-admin-email-modal" placeholder="admin@google.com"><button id="add-admin-btn-modal">추가</button></div></div>
        <div class="form-group"><label>현재 관리자 목록</label><ul id="admin-email-list">${adminList.length > 0 ? adminList.map(e => `<li><span>${e}</span><button class="remove-admin-btn" data-email="${e}">삭제</button></li>`).join('') : '<li>등록된 관리자가 없습니다.</li>'}</ul></div>
        </div>`;
    ui.showModal({ content: modalContentHTML, id: 'admin-management-modal' });

    const modalNode = document.getElementById('admin-management-modal');
    modalNode.querySelector('#add-admin-btn-modal').addEventListener('click', addAdminEmail);
    modalNode.querySelectorAll('.remove-admin-btn').forEach(btn => btn.addEventListener('click', (e) => removeAdminEmail(e)));
}

async function fetchAdmins() {
    try {
        const docSnap = await firebase.getDoc(firebase.doc(firebase.db, 'admins', 'authorized_users'));
        return docSnap.exists() ? docSnap.data().emails || [] : [];
    } catch (error) { console.error("관리자 목록 로딩 에러:", error); return []; }
}

async function addAdminEmail() {
    const input = document.getElementById('new-admin-email-modal');
    const email = input.value.trim();
    if (!email) return;
    if (!email.toLowerCase().endsWith('@gmail.com')) {
        ui.showModalAlert("구글 이메일 주소(@gmail.com)만 관리자로 추가할 수 있습니다."); return;
    }
    try {
        await firebase.updateDoc(firebase.doc(firebase.db, 'admins', 'authorized_users'), { emails: firebase.arrayUnion(email) });
        await openAdminManagementUI(); // Refresh the modal
    } catch (error) {
        if (error.code === 'not-found') {
            await firebase.setDoc(firebase.doc(firebase.db, 'admins', 'authorized_users'), { emails: [email] });
            await openAdminManagementUI();
        } else { console.error("관리자 추가 에러:", error); ui.showModalAlert("관리자 추가에 실패했습니다."); }
    }
}

async function removeAdminEmail(event) {
    const email = event.target.dataset.email;
    if (!email) return;
    ui.showModal({
        content: `<p style="margin-top:0;">'${email}' 관리자를 정말 삭제하시겠습니까?</p>`, confirmText: '삭제', confirmId: 'modal-confirm-delete',
        onConfirm: async () => {
            try {
                await firebase.updateDoc(firebase.doc(firebase.db, 'admins', 'authorized_users'), { emails: firebase.arrayRemove(email) });
                ui.closeModal();
                await openAdminManagementUI();
            } catch (error) { console.error("관리자 삭제 에러:", error); ui.showModalAlert("관리자 삭제에 실패했습니다."); }
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

// --- 모드 전환 및 리사이저 ---
function toggleMode() {
    const viewerContainer = document.getElementById('viewer-container');
    const adminContainer = document.getElementById('admin-container');
    const toggleBtn = document.getElementById('mode-toggle-btn');
    const isViewerVisible = viewerContainer.style.display !== 'none';
    
    if (isViewerVisible) {
        viewerContainer.style.display = 'none';
        adminContainer.style.display = 'flex';
        if (toggleBtn) toggleBtn.textContent = '뷰어 모드로';
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
    openAdminManagementUI
};
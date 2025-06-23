// =============================================================
//
//  통합 문서 시스템 (main.js)
//  - 뷰어 모드와 관리자 모드를 모두 포함하는 단일 파일
//
// =============================================================


// -------------------------------------------------------------
// Firebase 설정
// -------------------------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyCBimrNdCRm88oFQZtk2ZwTOjnhrFt9y8U",
    authDomain: "honey-db.firebaseapp.com",
    projectId: "honey-db",
    storageBucket: "honey-db.appspot.com",
    messagingSenderId: "199052115391",
    appId: "1:199052115391:web:db3bf8bc864a026d2f750a"
};
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// -------------------------------------------------------------
// HTML 요소 가져오기
// -------------------------------------------------------------
const modeToggleButton = document.getElementById('mode-toggle-btn');
const viewerContainer = document.getElementById('viewer-container');
const adminContainer = document.getElementById('admin-container');

// 뷰어 모드 요소
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const viewerMainContent = document.getElementById('mainContentContainer');
const viewerResults = document.getElementById('resultsContainer');
const breadcrumbContainer = document.getElementById('breadcrumbContainer');

// 관리자 모드 요소
const treeContainer = document.getElementById('tree-container');
const editorContainer = document.getElementById('editor-container');
const resizer = document.getElementById('resizer');
const treeRoot = document.getElementById('tree-root');
const editorContent = document.getElementById('editor-content');
const addNewButton = document.getElementById('add-new-button');
const testPanelHeader = document.getElementById('test-panel-header');
const testPanelContent = document.getElementById('test-panel-content');
const create1Btn = document.getElementById('btn-create-1');
const create100Btn = document.getElementById('btn-create-100');
const deleteAllBtn = document.getElementById('btn-delete-all');

// -------------------------------------------------------------
// 상태 관리 변수
// -------------------------------------------------------------
let breadcrumbTrail = [];
let currentSelectedDocId = null;
let allDocsMap = new Map();
const EXPANDED_STATE_KEY = 'treeExpandedState';

// =============================================================
//  뷰어 모드 (Viewer Mode) 함수들
// =============================================================

/**
 * Breadcrumb 렌더링 함수
 */
function renderBreadcrumbs() {
    breadcrumbContainer.innerHTML = '';
    breadcrumbTrail.forEach((item, index) => {
        let element;
        if (index === breadcrumbTrail.length - 1) {
            element = document.createElement('span');
            element.className = 'breadcrumb-current';
            element.textContent = item.title;
        } else {
            element = document.createElement('a');
            element.className = 'breadcrumb-item';
            element.textContent = item.title;
            element.onclick = (e) => {
                e.preventDefault();
                navigateTo(item.id, item.title);
            };
        }
        breadcrumbContainer.appendChild(element);
        if (index < breadcrumbTrail.length - 1) {
            const separator = document.createElement('span');
            separator.className = 'breadcrumb-separator';
            separator.textContent = '>';
            breadcrumbContainer.appendChild(separator);
        }
    });
}

/**
 * Breadcrumb 경로 생성 헬퍼 함수
 */
async function buildBreadcrumbsFor(startDocId) {
    let trail = [];
    let currentId = startDocId;
    while (currentId) {
        let docData;
        // 먼저 메모리에 저장된 allDocsMap에서 찾아봄 (DB 요청 줄이기)
        if (allDocsMap.has(currentId)) {
            docData = allDocsMap.get(currentId).data;
        } else {
            // 없으면 DB에서 직접 가져옴
            const docSnap = await db.collection("helps").doc(currentId).get();
            if (docSnap.exists) {
                docData = docSnap.data();
            } else {
                break; // 문서가 없으면 경로 추적 중단
            }
        }
        trail.unshift({ id: currentId, title: docData.title });
        currentId = docData.parentIds && docData.parentIds.length > 0 ? docData.parentIds[0] : null;
    }
    trail.unshift({ id: null, title: 'Home' });
    return trail;
}

/**
 * [탐색 모드] 메인 탐색 함수
 */
async function navigateTo(docId, docTitle) {
    // 1. 전체 부모 경로 생성
    if (docId) {
        breadcrumbTrail = await buildBreadcrumbsFor(docId);
    } else {
        breadcrumbTrail = [{ id: null, title: 'Home' }];
    }
    renderBreadcrumbs();

    // 2. 화면 초기화
    viewerMainContent.innerHTML = '';
    viewerResults.innerHTML = '<p class="info-text">목록을 불러오는 중...</p>';

    // 3. 현재 문서 내용 표시
    if (docId) {
        try {
            const docSnap = await db.collection("helps").doc(docId).get();
            if (docSnap.exists) {
                const data = docSnap.data();
                let keywordsHtml = '';
                if (data.keywords && data.keywords.length > 0) {
                    keywordsHtml = `<div class="keyword-tag-container"><h4>관련 키워드</h4>${data.keywords.map(kw => `<span class="keyword-tag">${kw}</span>`).join('')}</div>`;
                }
                viewerMainContent.innerHTML = `<h2>${data.title}</h2><p>${data.contents || '내용이 없습니다.'}</p>${keywordsHtml}`;
            } else {
                 viewerMainContent.innerHTML = '<h4>문서가 존재하지 않습니다.</h4>';
            }
        } catch(error) {
            console.error("메인 컨텐츠 로딩 오류:", error);
            viewerMainContent.innerHTML = '<h4>컨텐츠를 불러오는 데 실패했습니다.</h4>';
        }
    } else {
         viewerMainContent.innerHTML = '<h2>Home</h2><p>최상위 문서 목록입니다.</p>';
    }

    // 4. 자식 목록 표시
    try {
        let query = docId === null
            ? db.collection("helps").where("parentIds", "==", [])
            : db.collection("helps").where("parentIds", "array-contains", docId);
        
        const snapshot = await query.get();
        viewerResults.innerHTML = '';
        if (snapshot.empty) {
            viewerResults.innerHTML = '<p class="info-text">하위 항목이 없습니다.</p>';
        } else {
            snapshot.forEach(childDoc => {
                const childData = childDoc.data();
                const resultItem = document.createElement('div');
                resultItem.className = 'result-item';
                resultItem.innerHTML = `<h3>${childData.title}</h3>`;
                resultItem.onclick = () => navigateTo(childDoc.id, childData.title);
                viewerResults.appendChild(resultItem);
            });
        }
    } catch (error) {
        console.error("하위 목록 탐색 중 오류:", error);
        viewerResults.innerHTML = '<p class="info-text">하위 목록을 불러오는 데 실패했습니다.</p>';
    }
}

/**
 * [검색 모드] 키워드 검색 함수
 */
async function performSearch() {
    const searchTerm = searchInput.value.trim();
    if (!searchTerm) return;
    viewerMainContent.innerHTML = `<h2>'${searchTerm}' 검색 결과</h2>`;
    breadcrumbContainer.innerHTML = '';
    viewerResults.innerHTML = '<p class="info-text">검색 중입니다...</p>';
    try {
        const snapshot = await db.collection("helps").where("keywords", "array-contains", searchTerm).get();
        viewerResults.innerHTML = '';
        if (snapshot.empty) {
            viewerResults.innerHTML = '<p class="info-text">검색 결과가 없습니다.</p>';
        } else {
            const regex = new RegExp(searchTerm, 'gi');
            snapshot.forEach(doc => {
                const data = doc.data();
                const resultItem = document.createElement('div');
                resultItem.className = 'result-item';
                const highlightedTitle = data.title.replace(regex, `<mark class="highlight">$&</mark>`);
                const highlightedContents = (data.contents || '').replace(regex, `<mark class="highlight">$&</mark>`);
                resultItem.innerHTML = `<h3>${highlightedTitle}</h3><p>${highlightedContents}</p><p style="margin-top: 10px; font-size: 12px; color: #7f8c8d;">매칭 키워드: ${searchTerm}</p>`;
                resultItem.onclick = () => navigateTo(doc.id, data.title);
                viewerResults.appendChild(resultItem);
            });
        }
    } catch (error) {
        console.error("검색 중 오류 발생:", error);
        viewerResults.innerHTML = '<p class="info-text">검색에 실패했습니다.</p>';
    }
}

// =============================================================
//
// 관리자 모드 (Admin Mode) 함수들
//
// =============================================================

function prepareNewDocumentForm() {
    currentSelectedDocId = null; 
    const currentActive = document.querySelector('#tree-root .tree-item-title.active');
    if (currentActive) {
        currentActive.classList.remove('active');
    }
    loadDocumentIntoEditor(null, { title: '', contents: '', keywords: [], parentIds: [] });
    document.getElementById('editor-title-input').focus();
}

async function saveChanges() {
    const newTitle = document.getElementById('editor-title-input').value;
    const newContents = document.getElementById('editor-contents-textarea').value;
    const parentSpans = document.querySelectorAll('#parent-display .parent-tag');
    const newParentIds = Array.from(parentSpans).map(span => span.dataset.parentId);
    const newKeywords = [];
    document.querySelectorAll('.tag-item').forEach(tag => {
        newKeywords.push(tag.firstChild.textContent.trim());
    });
    if (!newTitle) {
        alert("제목은 필수 항목입니다.");
        return;
    }
    const saveButton = document.getElementById('save-button');
    saveButton.textContent = '저장 중...';
    saveButton.disabled = true;
    try {
        const docData = { title: newTitle, contents: newContents, keywords: newKeywords, parentIds: newParentIds };
        if (currentSelectedDocId) {
            await db.collection("helps").doc(currentSelectedDocId).update(docData);
        } else {
            const docRef = await db.collection("helps").add(docData);
            currentSelectedDocId = docRef.id;
        }
        await buildAndRenderTree();
    } catch (error) {
        console.error("저장 중 오류 발생:", error);
        alert("저장에 실패했습니다.");
    } finally {
        if(document.getElementById('save-button')) {
            document.getElementById('save-button').textContent = '저장하기';
            document.getElementById('save-button').disabled = false;
        }
    }
}

async function deleteDocument() {
    if (!currentSelectedDocId) {
        alert("삭제할 항목을 먼저 선택해주세요.");
        return;
    }
    if (!confirm("정말 이 문서를 삭제하시겠습니까?")) { return; }
    try {
        await db.collection("helps").doc(currentSelectedDocId).delete();
        editorContent.innerHTML = '<p class="info-text">왼쪽 트리에서 항목을 선택하거나, 새 문서를 추가하세요.</p>';
        currentSelectedDocId = null;
        await buildAndRenderTree();
    } catch (error) {
        console.error("삭제 중 오류 발생:", error);
        alert("삭제에 실패했습니다.");
    }
}

function loadDocumentIntoEditor(docId, docData) {
    currentSelectedDocId = docId;
    const parentIds = docData.parentIds || [];
    editorContent.innerHTML = `<h3>${docData.title || '새 문서 작성'}</h3><div class="form-group"><label>제목</label><input type="text" id="editor-title-input" value="${docData.title || ''}"></div><div class="form-group"><label>내용</label><textarea id="editor-contents-textarea">${docData.contents || ''}</textarea></div><div class="form-group"><label>검색 키워드</label><div id="tag-container" class="tag-input-container"><input type="text" id="tag-input" placeholder="키워드 입력 후 Enter"></div></div><div class="form-group"><label>부모 문서</label><div id="parent-display-wrapper"><div id="parent-display"></div><button id="change-parent-btn">변경</button></div></div><div class="button-group"><button id="save-button">저장하기</button><button id="delete-button">삭제하기</button></div>`;
    
    const parentDisplay = document.getElementById('parent-display');
    parentDisplay.innerHTML = '';
    if (parentIds.length > 0) {
        parentIds.forEach(pId => {
            const parentNode = allDocsMap.get(pId);
            if (parentNode) {
                const parentTag = document.createElement('span');
                parentTag.className = 'parent-tag';
                parentTag.textContent = parentNode.data.title;
                parentTag.dataset.parentId = pId;
                parentDisplay.appendChild(parentTag);
            }
        });
    } else {
        parentDisplay.textContent = '없음';
    }

    const textarea = document.getElementById('editor-contents-textarea');
    function autoResize() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    }
    textarea.addEventListener('input', autoResize, false);
    setTimeout(() => { if(textarea) autoResize.call(textarea); }, 0);

    document.getElementById('save-button').onclick = saveChanges;
    document.getElementById('delete-button').onclick = deleteDocument;
    document.getElementById('change-parent-btn').onclick = () => setupParentSelectorModal(parentIds);
    setupTagInput(docData.keywords || []);
}

function setupTagInput(keywords) {
    const container = document.getElementById('tag-container');
    const input = document.getElementById('tag-input');
    keywords.forEach(keyword => container.insertBefore(createTag(keyword), input));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const tagText = input.value.trim();
            if (tagText) {
                container.insertBefore(createTag(tagText), input);
                input.value = '';
            }
        }
    });
    container.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-tag')) e.target.parentElement.remove();
    });
}

function createTag(text) {
    const tag = document.createElement('div');
    tag.className = 'tag-item';
    tag.innerHTML = `<span>${text}</span> <span class="remove-tag" title="삭제">x</span>`;
    return tag;
}

function setupParentSelectorModal(currentParentIds) {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.innerHTML = `<div class="modal-content"><h3>부모 문서 선택</h3><input type="text" id="modal-search-input" placeholder="검색으로 필터링..."><div id="modal-tree-container"></div><div class="modal-buttons"><button id="modal-cancel">취소</button><button id="modal-select">선택 완료</button></div></div>`;
    document.body.appendChild(modalOverlay);
    modalOverlay.style.display = 'flex';
    const modalTreeContainer = document.getElementById('modal-tree-container');
    const searchInput = document.getElementById('modal-search-input');
    
    const renderModalTree = (filterText = '') => {
        modalTreeContainer.innerHTML = '';
        const rootUl = document.createElement('ul');
        modalTreeContainer.appendChild(rootUl);
        const tree = buildTreeFromMap();
        const filteredTree = filterText ? filterTree(tree, filterText.toLowerCase()) : tree;
        renderTree(filteredTree, rootUl, true, currentParentIds);
    };
    renderModalTree();
    searchInput.addEventListener('keyup', () => renderModalTree(searchInput.value));

    document.getElementById('modal-select').onclick = () => {
        const selectedIds = [], selectedTitles = [];
        modalTreeContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
            selectedIds.push(cb.dataset.id);
            selectedTitles.push(cb.dataset.title);
        });
        const parentDisplay = document.getElementById('parent-display');
        parentDisplay.innerHTML = '';
        if (selectedIds.length > 0) {
             selectedIds.forEach((id, index) => {
                const parentTag = document.createElement('span');
                parentTag.className = 'parent-tag';
                parentTag.textContent = selectedTitles[index];
                parentTag.dataset.parentId = id;
                parentDisplay.appendChild(parentTag);
            });
        } else {
            parentDisplay.textContent = '없음';
        }
        closeModal();
    };
    const closeModal = () => document.body.removeChild(modalOverlay);
    document.getElementById('modal-cancel').onclick = closeModal;
    modalOverlay.onclick = (e) => { if (e.target === modalOverlay) closeModal(); };
}

function renderTree(nodes, container, isModal, checkedIds = []) {
    nodes.forEach(node => {
        const listItem = document.createElement('li');
        const hasChildren = node.children && node.children.length > 0;
        const itemContainer = document.createElement('div');
        itemContainer.className = 'item-container';
        if (hasChildren) {
            const expandedIds = isModal ? [] : getExpandedState();
            const isCollapsed = !expandedIds.includes(node.id);
            if (!isModal && isCollapsed) listItem.classList.add('collapsed');
            else if (isModal) listItem.classList.add('collapsed');
            const toggleBtn = document.createElement('span');
            toggleBtn.className = 'toggle-btn';
            toggleBtn.textContent = listItem.classList.contains('collapsed') ? '+' : '-';
            toggleBtn.onclick = (e) => {
                e.stopPropagation();
                const nowIsCollapsed = listItem.classList.toggle('collapsed');
                toggleBtn.textContent = nowIsCollapsed ? '+' : '-';
                if (!isModal) {
                    let currentState = getExpandedState();
                    if (nowIsCollapsed) {
                        currentState = currentState.filter(id => id !== node.id);
                    } else {
                        if (!currentState.includes(node.id)) currentState.push(node.id);
                    }
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
            titleSpan.addEventListener('dragstart', (e) => { e.stopPropagation(); e.dataTransfer.setData('text/plain', node.id); e.dataTransfer.effectAllowed = 'move'; setTimeout(() => e.target.classList.add('dragging'), 0); });
            titleSpan.addEventListener('dragend', (e) => e.target.classList.remove('dragging'));
            titleSpan.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.target.classList.add('drop-target'); });
            titleSpan.addEventListener('dragleave', (e) => e.target.classList.remove('drop-target'));
            titleSpan.addEventListener('drop', handleDrop);
            titleSpan.onclick = () => {
                const currentActive = document.querySelector('#tree-root .tree-item-title.active');
                if (currentActive) currentActive.classList.remove('active');
                titleSpan.classList.add('active');
                loadDocumentIntoEditor(node.id, node.data);
            };
        }
        itemContainer.appendChild(titleSpan);
        listItem.appendChild(itemContainer);
        if (hasChildren) {
            const childrenContainer = document.createElement('ul');
            listItem.appendChild(childrenContainer);
            renderTree(node.children, childrenContainer, isModal, checkedIds);
        }
        container.appendChild(listItem);
    });
}

function filterTree(nodes, filterText) {
    const filteredNodes = [];
    for (const node of nodes) {
        let matches = node.data.title.toLowerCase().includes(filterText);
        let children = [];
        if (node.children && node.children.length > 0) {
            children = filterTree(node.children, filterText);
        }
        if (matches || children.length > 0) {
            filteredNodes.push({ ...node, children: children });
        }
    }
    return filteredNodes;
}

async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.target.classList.remove('drop-target');
    const draggedDocId = e.dataTransfer.getData('text/plain');
    const newParentId = e.target.dataset.id;
    if (draggedDocId === newParentId) return;
    let tempId = newParentId;
    while(tempId) {
        if (tempId === draggedDocId) {
            alert("자신의 하위 항목으로 문서를 이동할 수 없습니다.");
            return;
        }
        const parentNode = allDocsMap.get(tempId);
        if (!parentNode) break;
        tempId = parentNode.data.parentIds && parentNode.data.parentIds.length > 0 ? parentNode.data.parentIds[0] : null;
    }
    try {
        await db.collection("helps").doc(draggedDocId).update({ parentIds: [newParentId] });
        buildAndRenderTree();
    } catch (error) {
        console.error("부모 변경 중 오류:", error);
        alert("부모를 변경하는 데 실패했습니다.");
    }
}

function buildTreeFromMap() {
    allDocsMap.forEach(node => node.children = []);
    const tree = [];
    allDocsMap.forEach(node => {
        const parentIds = node.data.parentIds || [];
        if (parentIds.length === 0) {
            tree.push(node);
        } else {
            parentIds.forEach(parentId => {
                if (allDocsMap.has(parentId)) {
                    allDocsMap.get(parentId).children.push(node);
                }
            });
        }
    });
    return tree;
}

async function buildAndRenderTree() {
    treeRoot.innerHTML = '<p class="info-text">데이터 로딩 중...</p>';
    try {
        const snapshot = await db.collection("helps").get();
        if (snapshot.empty) {
            treeRoot.innerHTML = '<p class="info-text">데이터가 없습니다.</p>';
            return;
        }
        allDocsMap.clear();
        snapshot.forEach(doc => {
            allDocsMap.set(doc.id, { id: doc.id, data: doc.data(), children: [] });
        });
        const tree = buildTreeFromMap();
        treeRoot.innerHTML = '';
        const rootUl = document.createElement('ul');
        treeRoot.appendChild(rootUl);
        renderTree(tree, rootUl);
    } catch (error) {
        console.error("트리 생성 중 오류:", error);
        treeRoot.innerHTML = '<p class="info-text">데이터를 불러오는 데 실패했습니다.</p>';
    }
}

let isResizing = false;
resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    e.preventDefault();
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
});
function handleMouseMove(e) {
    if (!isResizing) return;
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

const dummyThemes = { "지상동물": ["사자", "호랑이", "코끼리", "기린", "토끼", "하마", "얼룩말", "원숭이", "캥거루", "판다"], "해산물": ["고등어", "오징어", "새우", "꽃게", "광어", "연어", "참치", "문어", "전복", "가리비"], "식물": ["장미", "소나무", "민들레", "해바라기", "튤립", "선인장", "대나무", "은행나무", "단풍나무", "국화"], "과일": ["사과", "바나나", "딸기", "포도", "오렌지", "수박", "파인애플", "체리", "복숭아", "망고"] };
const log = (message) => { const logContainer = document.getElementById('test-log'); if (logContainer) logContainer.innerHTML = `> ${message}<br>` + logContainer.innerHTML; };
async function createSingleDummy() { if (!confirm("랜덤 테마의 더미 문서 1개를 생성하시겠습니까?")) return; log("더미 문서 1개 생성 시작..."); try { const categories = Object.keys(dummyThemes); const randomCategory = categories[Math.floor(Math.random() * categories.length)]; const items = dummyThemes[randomCategory]; const randomItem = items[Math.floor(Math.random() * items.length)]; await db.collection("helps").add({ title: randomItem, contents: `이것은 ${randomCategory} 카테고리의 ${randomItem} 문서입니다.`, keywords: ["더미", "테스트", randomItem, randomCategory], parentIds: [] }); log("✅ 더미 문서 1개 생성 완료!"); buildAndRenderTree(); } catch (e) { log("❌ 생성 실패: " + e.message); console.error(e); } }
async function createThematicDummies() {
    const docCount = 100;
    if (!confirm(`정말로 테마 더미 문서 ${docCount}개를 생성하시겠습니까?`)) return;
    log(`테마 더미 ${docCount}개 생성 시작...`);
    try {
        const batch = db.batch();
        const categories = Object.keys(dummyThemes);
        let parentId = null;
        for (let i = 0; i < docCount; i++) {
            const docRef = db.collection("helps").doc();
            if (i % 10 === 0) {
                const categoryName = categories[Math.floor(i / 10) % categories.length];
                parentId = docRef.id;
                batch.set(docRef, { title: categoryName, contents: `${categoryName}에 대한 모든 문서들을 포함합니다.`, keywords: ["부모", "카테고리", categoryName], parentIds: [] });
            } else {
                const items = dummyThemes[categories[Math.floor(i / 10) % categories.length]] || [];
                const itemName = items[i % items.length] || `항목 ${i}`;
                batch.set(docRef, { title: itemName, contents: `이것은 ${itemName}에 대한 내용입니다.`, keywords: ["자식", "테스트", itemName, categories[Math.floor(i / 10) % categories.length]], parentIds: parentId ? [parentId] : [] });
            }
        }
        await batch.commit();
        log(`✅ 테마 더미 ${docCount}개 생성 완료!`);
        buildAndRenderTree();
    } catch (e) {
        log("❌ 생성 실패: " + e.message);
        console.error(e);
    }
}
async function deleteAllDocuments() {
    if (!confirm("⚠️ 경고! 'helps' 컬렉션의 모든 문서를 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없습니다!")) return;
    log("전체 문서 삭제 시작...");
    try {
        const snapshot = await db.collection("helps").get();
        if (snapshot.empty) { log("삭제할 문서가 없습니다."); return; }
        const totalDocs = snapshot.size;
        log(`총 ${totalDocs}개의 문서를 삭제합니다...`);
        const batches = [];
        let currentBatch = db.batch();
        let currentBatchSize = 0;
        snapshot.forEach(doc => {
            currentBatch.delete(doc.ref);
            currentBatchSize++;
            if (currentBatchSize === 499) {
                batches.push(currentBatch);
                currentBatch = db.batch();
                currentBatchSize = 0;
            }
        });
        if (currentBatchSize > 0) batches.push(currentBatch);
        for (const batch of batches) {
            await batch.commit();
        }
        log("✅ 전체 문서 삭제 완료!");
        buildAndRenderTree();
    } catch (e) {
        log("❌ 삭제 실패: " + e.message); console.error(e);
    }
}

function toggleMode() {
    const isViewerVisible = viewerContainer.style.display !== 'none';
    if (isViewerVisible) {
        viewerContainer.style.display = 'none';
        adminContainer.style.display = 'block';
        modeToggleButton.textContent = '뷰어 모드로 전환';
        buildAndRenderTree();
    } else {
        viewerContainer.style.display = 'block';
        adminContainer.style.display = 'none';
        modeToggleButton.textContent = '관리자 모드';
        navigateTo(null, 'Home');
    }
}

function setupTestPanelToggle() {
    const header = document.getElementById('test-panel-header');
    const content = document.getElementById('test-panel-content');
    const icon = header.querySelector('.toggle-icon');
    if (!header || !content || !icon) return;
    header.addEventListener('click', () => {
        const isCollapsed = content.classList.toggle('collapsed');
        icon.textContent = isCollapsed ? '▼' : '▲';
    });
}

searchButton.addEventListener('click', performSearch);
searchInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') performSearch();
});
addNewButton.addEventListener('click', prepareNewDocumentForm);
document.getElementById('btn-create-1').onclick = createSingleDummy;
document.getElementById('btn-create-100').onclick = createThematicDummies;
document.getElementById('btn-delete-all').onclick = deleteAllDocuments;
modeToggleButton.addEventListener('click', toggleMode);

setupTestPanelToggle();
navigateTo(null, 'Home');
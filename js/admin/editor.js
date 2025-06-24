import * as firebase from '../firebase.js';
import * as ui from '../ui.js';
import { buildTreeFromMap, filterTree, renderTree } from './tree.js';

let currentSelectedDocId = null;

export function getCurrentSelectedDocId() {
    return currentSelectedDocId;
}

export function prepareNewDocumentForm(allDocsMap) {
    currentSelectedDocId = null;
    const currentActive = document.querySelector('#tree-root .tree-item-title.active');
    if (currentActive) {
        currentActive.classList.remove('active');
    }
    loadDocumentIntoEditor(null, { title: '', contents: '', keywords: [], parentIds: [] }, allDocsMap, null);
    const titleInput = document.getElementById('editor-title-input');
    if (titleInput) titleInput.focus();
}

export async function saveChanges(allDocsMap) {
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
        document.dispatchEvent(new CustomEvent('docsChanged'));

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

export async function deleteDocument(allDocsMap) {
    if (!currentSelectedDocId) {
        ui.showModalAlert("삭제할 항목을 먼저 선택해주세요.");
        return;
    }
    const docToDelete = allDocsMap.get(currentSelectedDocId);
    if (!docToDelete) {
        console.error("삭제하려는 문서를 찾을 수 없습니다.");
        ui.showModalAlert("삭제하려는 문서를 찾을 수 없습니다.");
        return;
    }
    const docTitle = docToDelete.data.title;
    ui.showModal({
        content: `<p style="margin-top:0;">정말 <strong>'${docTitle}'</strong> 문서를 삭제하시겠습니까? 하위 문서들의 연결이 끊어질 수 있습니다.</p>`,
        confirmText: '삭제', confirmId: 'modal-confirm-delete', modalClass: 'modal-confirm',
        onConfirm: async () => {
            ui.closeModal();
            try {
                await firebase.deleteDoc(firebase.doc(firebase.db, "helps", currentSelectedDocId));
                document.getElementById('editor-content').innerHTML = '<p class="info-text">왼쪽 트리에서 항목을 선택하거나, 새 문서를 추가하세요.</p>';
                currentSelectedDocId = null;
                document.dispatchEvent(new CustomEvent('docsChanged'));
            } catch (error) {
                console.error("삭제 중 오류 발생:", error);
                ui.showModalAlert("삭제에 실패했습니다.");
            }
        }
    });
}

// --- 여기가 수정된 부분입니다 ---
// clickedElement 파라미터를 optional로 변경하고, 없을 때의 로직을 추가합니다.
export function loadDocumentIntoEditor(docId, docData, allDocsMap, clickedElement = null) {
    currentSelectedDocId = docId;

    const currentActive = document.querySelector('#tree-root .tree-item-title.active');
    if (currentActive) {
        currentActive.classList.remove('active');
    }

    if (clickedElement) {
        // 클릭된 요소가 있으면 그것을 바로 활성화합니다.
        clickedElement.classList.add('active');
    } else if (docId) {
        // 클릭된 요소가 없고 docId가 있으면, 해당 ID를 가진 첫 번째 항목을 찾아 활성화합니다.
        // '수정' 버튼을 통해 진입했을 때 이 로직이 사용됩니다.
        const newActiveItem = document.querySelector(`#tree-root .tree-item-title[data-id="${docId}"]`);
        if(newActiveItem) newActiveItem.classList.add('active');
    }

    const editorContent = document.getElementById('editor-content');
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

export function updateParentDisplay(parentIds, allDocsMap) {
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
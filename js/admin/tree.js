import * as firebase from '../firebase.js';
import * as ui from '../ui.js';

const EXPANDED_STATE_KEY = 'treeExpandedState';

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

export async function buildAndRenderTree(allDocsMap) {
    const treeRoot = document.getElementById('tree-root');
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

    } catch (error) {
        console.error("트리 생성 중 오류:", error);
        treeRoot.innerHTML = '<p class="info-text">데이터를 불러오는 데 실패했습니다.</p>';
    }
}

export function buildTreeFromMap(allDocsMap) {
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

export function renderTree(nodes, container, isModal, checkedIds, allDocsMap, ancestorPath, contextualParentId = null) {
    const currentSelectedDocId = document.querySelector('#tree-root .tree-item-title.active')?.dataset.id;

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
        
        if (contextualParentId) {
            titleSpan.dataset.contextParentId = contextualParentId;
        }

        if (!isModal) {
            titleSpan.draggable = true;
            titleSpan.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                const transferData = {
                    draggedDocId: node.id,
                    sourceParentId: e.currentTarget.dataset.contextParentId || null
                };
                e.dataTransfer.setData('application/json', JSON.stringify(transferData));
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => e.target.classList.add('dragging'), 0);
            });
            titleSpan.addEventListener('dragend', (e) => e.target.classList.remove('dragging'));
            titleSpan.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.target.classList.add('drop-target'); });
            titleSpan.addEventListener('dragleave', (e) => e.target.classList.remove('drop-target'));
            titleSpan.addEventListener('drop', (e) => handleDrop(e, allDocsMap));
            
            // --- 여기가 수정된 부분입니다 ---
            // 이벤트 핸들러에서 event 객체(e)를 사용합니다.
            titleSpan.onclick = (e) => {
                const event = new CustomEvent('loadDocToEditor', {
                    detail: {
                        docId: node.id,
                        docData: node.data,
                        allDocsMap: allDocsMap,
                        // 클릭된 요소 자체를 이벤트 정보에 추가합니다.
                        clickedElement: e.currentTarget 
                    }
                });
                document.dispatchEvent(event);
            };
        }
        itemContainer.appendChild(titleSpan);
        listItem.appendChild(itemContainer);
        if (hasChildren) {
            const childrenContainer = document.createElement('ul');
            listItem.appendChild(childrenContainer);
            renderTree(node.children, childrenContainer, isModal, checkedIds, allDocsMap, newAncestorPath, node.id);
        }
        container.appendChild(listItem);
    });
}

async function handleDrop(e, allDocsMap) {
    e.preventDefault();
    e.stopPropagation();
    e.target.classList.remove('drop-target');

    const transferData = JSON.parse(e.dataTransfer.getData('application/json'));
    const { draggedDocId, sourceParentId } = transferData;
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
            const currentParentIds = draggedDoc.data.parentIds || [];
            let newParentIdsArray = [...currentParentIds];

            if (sourceParentId) {
                newParentIdsArray = newParentIdsArray.filter(id => id !== sourceParentId);
            }

            if (!newParentIdsArray.includes(newParentId)) {
                newParentIdsArray.push(newParentId);
            }
            
            if (JSON.stringify(newParentIdsArray.sort()) !== JSON.stringify(currentParentIds.sort())) {
                await firebase.updateDoc(firebase.doc(firebase.db, "helps", draggedDocId), { parentIds: newParentIdsArray });
                document.dispatchEvent(new CustomEvent('docsChanged'));
            }
        }
    } catch (error) {
        console.error("부모 변경 중 오류:", error);
        ui.showModalAlert("부모를 변경하는 데 실패했습니다.");
    }
}

export function filterTree(nodes, filterText, ancestorPath = new Set()) {
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
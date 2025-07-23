import { db, getDocs, getDoc, collection, query, where, doc } from './firebase.js';

let breadcrumbTrail = [];

function naturalCompare(a, b) {
    const re = /(\d+)/g;
    const aParts = a.split(re);
    const bParts = b.split(re);
    const len = Math.min(aParts.length, bParts.length);
    for (let i = 0; i < len; i++) {
        const aPart = aParts[i];
        const bPart = bParts[i];
        if (i % 2 === 1) { 
            const aNum = parseInt(aPart, 10);
            const bNum = parseInt(bPart, 10);
            if (aNum !== bNum) return aNum - bNum;
        } else {
            if (aPart !== bPart) return aPart.localeCompare(bPart, 'ko');
        }
    }
    return aParts.length - bParts.length;
}

function getDOMElements() {
    return {
        viewerMainContent: document.getElementById('mainContentContainer'),
        viewerResults: document.getElementById('resultsContainer'),
        breadcrumbContainer: document.getElementById('breadcrumbContainer'),
        leftMarginContainer: document.getElementById('leftMargin'),
        searchInput: document.getElementById('searchInput'),
    };
}

// --- 여기가 수정된 부분이야! (1/2) ---
// 여러 경로를 접고 펼 수 있는 기능으로 renderBreadcrumbs 함수를 수정했어.
function renderBreadcrumbs() {
    const { breadcrumbContainer } = getDOMElements();
    breadcrumbContainer.innerHTML = '';
    if (!breadcrumbTrail || breadcrumbTrail.length === 0) return;

    const createPathElement = (path) => {
        const pathContainer = document.createElement('div');
        pathContainer.className = 'breadcrumb-path';
        path.forEach((item, index) => {
            let element;
            if (index === path.length - 1) {
                element = document.createElement('span');
                element.className = 'breadcrumb-current';
                element.textContent = item.title;
            } else {
                element = document.createElement('a');
                element.className = 'breadcrumb-item';
                element.textContent = item.title;
                element.href = '#';
                element.onclick = (e) => {
                    e.preventDefault();
                    document.dispatchEvent(new CustomEvent('navigateToDoc', { detail: { id: item.id, title: item.title } }));
                };
            }
            pathContainer.appendChild(element);
            if (index < path.length - 1) {
                const separator = document.createElement('span');
                separator.className = 'breadcrumb-separator';
                separator.textContent = '>';
                pathContainer.appendChild(separator);
            }
        });
        return pathContainer;
    };

    // 항상 첫 번째 경로(대표 경로)는 표시해.
    breadcrumbContainer.appendChild(createPathElement(breadcrumbTrail[0]));

    // 경로가 2개 이상일 때만 '경로 더보기' 기능을 추가했어.
    if (breadcrumbTrail.length > 1) {
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'breadcrumb-toggle-container';

        const moreButton = document.createElement('a');
        moreButton.href = '#';
        moreButton.className = 'breadcrumb-more-btn';
        moreButton.textContent = `+ ${breadcrumbTrail.length - 1}개 경로 더보기`;
        toggleContainer.appendChild(moreButton);

        const otherPathsContainer = document.createElement('div');
        otherPathsContainer.className = 'breadcrumb-other-paths';
        otherPathsContainer.style.display = 'none'; // 기본적으로 숨김

        // 나머지 경로들을 숨겨진 컨테이너에 추가해.
        for (let i = 1; i < breadcrumbTrail.length; i++) {
            otherPathsContainer.appendChild(createPathElement(breadcrumbTrail[i]));
        }
        
        toggleContainer.appendChild(otherPathsContainer);
        breadcrumbContainer.appendChild(toggleContainer);

        // 더보기 버튼 클릭 이벤트를 설정했어.
        moreButton.onclick = (e) => {
            e.preventDefault();
            const isHidden = otherPathsContainer.style.display === 'none';
            otherPathsContainer.style.display = isHidden ? 'block' : 'none';
            moreButton.textContent = isHidden ? '▲ 경로 접기' : `+ ${breadcrumbTrail.length - 1}개 경로 더보기`;
        };
    }
}


async function buildAllBreadcrumbPaths(allDocsMap, startDocId, ancestorPath) {
    if (ancestorPath.has(startDocId)) {
        console.warn(`순환 참조 발견: ID ${startDocId}는 이미 경로에 있습니다. 탐색을 중단합니다.`);
        return [];
    }
    
    if (!db) return [];
    if (!startDocId || !allDocsMap.has(startDocId)) return [];

    const newAncestorPath = new Set(ancestorPath).add(startDocId);

    const docNode = allDocsMap.get(startDocId);
    const currentDocInfo = { id: startDocId, title: docNode.data.title };
    const parentIds = docNode.data.parentIds || [];

    if (parentIds.length === 0) {
        return [[{ id: null, title: 'Home' }, currentDocInfo]];
    }

    let allPaths = [];
    for (const parentId of parentIds) {
        const parentPaths = await buildAllBreadcrumbPaths(allDocsMap, parentId, newAncestorPath);
        for (const path of parentPaths) {
            allPaths.push([...path, currentDocInfo]);
        }
    }
    return allPaths;
}

export async function navigateTo(allDocsMap, docId, docTitle, currentUserRole) {
    const { viewerMainContent, viewerResults } = getDOMElements();
    if (!db) return;

    if (docId) {
        breadcrumbTrail = await buildAllBreadcrumbPaths(allDocsMap, docId, new Set());
    } else {
        breadcrumbTrail = [[{ id: null, title: 'Home' }]];
    }
    // --- 여기가 수정된 부분이야! (2/2) ---
    // 파라미터 없이 renderBreadcrumbs를 호출하도록 수정했어.
    renderBreadcrumbs();

    viewerMainContent.innerHTML = '';
    viewerResults.innerHTML = '<p class="info-text">목록을 불러오는 중...</p>';

    if (docId) {
        const docSnap = await getDoc(doc(db, "helps", docId));
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            const titleContainer = document.createElement('div');
            titleContainer.style.display = 'flex';
            titleContainer.style.justifyContent = 'space-between';
            titleContainer.style.alignItems = 'center';

            const titleHeader = document.createElement('h2');
            titleHeader.textContent = data.title;
            titleContainer.appendChild(titleHeader);

            if (currentUserRole) {
                const editButton = document.createElement('button');
                editButton.id = 'edit-from-viewer-btn';
                editButton.className = 'inline-btn';
                editButton.textContent = '수정하기';
                editButton.style.padding = '8px 15px';
                editButton.onclick = () => {
                    document.dispatchEvent(new CustomEvent('requestEditDoc', { detail: { docId } }));
                };
                titleContainer.appendChild(editButton);
            }
            
            const contentDiv = document.createElement('div');
            contentDiv.innerHTML = data.contents || '내용이 없습니다.';
            
            viewerMainContent.appendChild(titleContainer);
            viewerMainContent.appendChild(contentDiv);

            if (data.keywords?.length > 0) {
                const keywordsDiv = document.createElement('div');
                keywordsDiv.className = 'keyword-tag-container';
                keywordsDiv.innerHTML = `<h4>관련 키워드</h4>${data.keywords.map(kw => `<span class="keyword-tag">${kw}</span>`).join('')}`;
                viewerMainContent.appendChild(keywordsDiv);
            }
            
        } else {
            viewerMainContent.innerHTML = '<h4>문서가 존재하지 않습니다.</h4>';
        }
    } else {
        viewerMainContent.innerHTML = '<h2>Home</h2><p>최상위 문서 목록입니다.</p>';
    }

    const q = docId === null ? query(collection(db, "helps"), where("parentIds", "==", [])) : query(collection(db, "helps"), where("parentIds", "array-contains", docId));
    const snapshot = await getDocs(q);
    viewerResults.innerHTML = '';
    if (snapshot.empty) {
        viewerResults.innerHTML = '<p class="info-text">하위 항목이 없습니다.</p>';
    } else {
        const childDocs = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })).sort((a, b) => naturalCompare(a.data.title, b.data.title));
        childDocs.forEach(child => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            resultItem.innerHTML = `<h3>${child.data.title}</h3>`;
            resultItem.onclick = () => navigateTo(allDocsMap, child.id, child.data.title, currentUserRole);
            viewerResults.appendChild(resultItem);
        });
    }
}

export async function performSearch() {
    const { searchInput, viewerMainContent, viewerResults, breadcrumbContainer } = getDOMElements();
    if (!db) return;
    const searchTerm = searchInput.value.trim();
    if (!searchTerm) return;

    const searchTermLower = searchTerm.toLowerCase();
    viewerMainContent.innerHTML = `<h2>'${searchTerm}' 검색 결과</h2>`;
    breadcrumbContainer.innerHTML = '';
    viewerResults.innerHTML = '<p class="info-text">검색 중입니다...</p>';

    const q = query(collection(db, "helps"), where("keywords_lowercase", "array-contains", searchTermLower));
    const snapshot = await getDocs(q);
    viewerResults.innerHTML = '';

    if (snapshot.empty) {
        viewerResults.innerHTML = '<p class="info-text">검색 결과가 없습니다.</p>';
        return;
    }

    const results = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })).sort((a, b) => naturalCompare(a.data.title, b.data.title));
    const regex = new RegExp(searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');

    results.forEach(doc => {
        const data = doc.data;
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        
        const highlightedTitle = data.title.replace(regex, `<mark class="highlight">$&</mark>`);
        const highlightedContents = (data.contents || '').replace(regex, `<mark class="highlight">$&</mark>`);

        const measurementDiv = document.createElement('div');
        measurementDiv.style.position = 'absolute';
        measurementDiv.style.visibility = 'hidden';
        measurementDiv.style.width = '100%';
        measurementDiv.innerHTML = highlightedContents;
        document.body.appendChild(measurementDiv);
        const isContentOverflowing = measurementDiv.scrollHeight > 120;
        document.body.removeChild(measurementDiv);
        
        const snippetClass = isContentOverflowing
            ? 'search-result-snippet is-overflowing'
            : 'search-result-snippet';

        resultItem.innerHTML = `
            <h3>${highlightedTitle}</h3>
            <div class="${snippetClass}">${highlightedContents}</div>
            <p style="margin-top: 10px; font-size: 12px; color: #7f8c8d;">
                매칭 키워드: ${data.keywords.filter(k => k.toLowerCase().includes(searchTermLower)).join(', ')}
            </p>
        `;
        
        resultItem.onclick = () => document.dispatchEvent(new CustomEvent('navigateToDoc', { detail: { id: doc.id, title: data.title } }));
        viewerResults.appendChild(resultItem);
    });
}

export async function loadGlobalLeftMargin() {
    const { leftMarginContainer } = getDOMElements();
    if (!db) return;
    try {
        const docSnap = await getDoc(doc(db, "globals", "left_margin"));
        leftMarginContainer.textContent = docSnap.exists() ? docSnap.data().content : '안내문이 없습니다.';
    } catch (error) {
        console.error("안내문 로딩 오류:", error);
        leftMarginContainer.textContent = '안내문을 불러오는 데 실패했습니다.';
    }
}
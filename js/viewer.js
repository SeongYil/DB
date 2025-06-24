import { db, getDocs, getDoc, collection, query, where, doc } from './firebase.js';

let breadcrumbTrail = [];

function getDOMElements() {
    return {
        viewerMainContent: document.getElementById('mainContentContainer'),
        viewerResults: document.getElementById('resultsContainer'),
        breadcrumbContainer: document.getElementById('breadcrumbContainer'),
        leftMarginContainer: document.getElementById('leftMargin'),
        searchInput: document.getElementById('searchInput'),
    };
}

function renderBreadcrumbs() {
    const { breadcrumbContainer } = getDOMElements();
    breadcrumbContainer.innerHTML = '';
    if (!breadcrumbTrail || breadcrumbTrail.length === 0) return;
    
    breadcrumbTrail.forEach(path => {
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
                    navigateTo(item.id, item.title);
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
        breadcrumbContainer.appendChild(pathContainer);
    });
}

async function buildAllBreadcrumbPaths(allDocsMap, startDocId) {
    if (!db) return [];
    if (!startDocId || !allDocsMap.has(startDocId)) return [];

    const docNode = allDocsMap.get(startDocId);
    const currentDocInfo = { id: startDocId, title: docNode.data.title };
    const parentIds = docNode.data.parentIds || [];

    if (parentIds.length === 0) {
        return [[{ id: null, title: 'Home' }, currentDocInfo]];
    }

    let allPaths = [];
    for (const parentId of parentIds) {
        const parentPaths = await buildAllBreadcrumbPaths(allDocsMap, parentId);
        for (const path of parentPaths) {
            allPaths.push([...path, currentDocInfo]);
        }
    }
    return allPaths;
}

async function navigateTo(allDocsMap, docId, docTitle) {
    const { viewerMainContent, viewerResults, breadcrumbContainer } = getDOMElements();
    if (!db) return;

    if (docId) {
        breadcrumbTrail = await buildAllBreadcrumbPaths(allDocsMap, docId);
    } else {
        breadcrumbTrail = [[{ id: null, title: 'Home' }]];
    }
    renderBreadcrumbs();

    viewerMainContent.innerHTML = '';
    viewerResults.innerHTML = '<p class="info-text">목록을 불러오는 중...</p>';

    if (docId) {
        const docSnap = await getDoc(doc(db, "helps", docId));
        if (docSnap.exists()) {
            const data = docSnap.data();
            let keywordsHtml = data.keywords?.length > 0 ? `<div class="keyword-tag-container"><h4>관련 키워드</h4>${data.keywords.map(kw => `<span class="keyword-tag">${kw}</span>`).join('')}</div>` : '';
            viewerMainContent.innerHTML = `<h2>${data.title}</h2><div>${data.contents || '내용이 없습니다.'}</div>${keywordsHtml}`;
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
        const childDocs = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })).sort((a, b) => a.data.title.localeCompare(b.data.title, 'ko'));
        childDocs.forEach(child => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            resultItem.innerHTML = `<h3>${child.data.title}</h3>`;
            resultItem.onclick = () => navigateTo(allDocsMap, child.id, child.data.title);
            viewerResults.appendChild(resultItem);
        });
    }
}

async function performSearch() {
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

    const results = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })).sort((a, b) => a.data.title.localeCompare(b.data.title, 'ko'));
    const regex = new RegExp(searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');

    results.forEach(doc => {
        const data = doc.data;
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        const highlightedTitle = data.title.replace(regex, `<mark class="highlight">$&</mark>`);
        const snippet = (data.contents || '').substring(0, 150) + '...';
        const highlightedContents = snippet.replace(regex, `<mark class="highlight">$&</mark>`);
        resultItem.innerHTML = `<h3>${highlightedTitle}</h3><div>${highlightedContents}</div><p style="margin-top: 10px; font-size: 12px; color: #7f8c8d;">매칭 키워드: ${data.keywords.filter(k => k.toLowerCase().includes(searchTermLower)).join(', ')}</p>`;
        resultItem.onclick = () => document.dispatchEvent(new CustomEvent('navigateToDoc', { detail: { id: doc.id, title: data.title } }));
        viewerResults.appendChild(resultItem);
    });
}

async function loadGlobalLeftMargin() {
    const { leftMarginContainer } = getDOMElements();
    if (!db) return;
    try {
        const docSnap = await getDoc(doc(db, "globals", "left_margin"));
        leftMarginContainer.textContent = docSnap.exists() ? docSnap.data().content || '' : '안내문이 없습니다.';
    } catch (error) {
        console.error("안내문 로딩 오류:", error);
        leftMarginContainer.textContent = '안내문을 불러오는 데 실패했습니다.';
    }
}

export { navigateTo, performSearch, loadGlobalLeftMargin };
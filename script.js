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
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const mainContentContainer = document.getElementById('mainContentContainer');
const resultsContainer = document.getElementById('resultsContainer');
const breadcrumbContainer = document.getElementById('breadcrumbContainer');

// -------------------------------------------------------------
// 상태 관리 변수
// -------------------------------------------------------------
let breadcrumbTrail = [];

// -------------------------------------------------------------
// 핵심 기능 함수
// -------------------------------------------------------------

/**
 * 탐색 경로(Breadcrumbs)를 화면에 렌더링하는 함수
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
 * [탐색 모드] 특정 문서를 기준으로 화면 전체를 다시 그리는 함수 (키워드 표시 기능 추가!)
 */
async function navigateTo(docId, docTitle) {
    const existingIndex = breadcrumbTrail.findIndex(item => item.id === docId);
    if (existingIndex !== -1) {
        breadcrumbTrail = breadcrumbTrail.slice(0, existingIndex + 1);
    } else {
        breadcrumbTrail.push({ id: docId, title: docTitle });
    }
    renderBreadcrumbs();

    mainContentContainer.innerHTML = '';
    resultsContainer.innerHTML = '<p class="info-text">목록을 불러오는 중...</p>';

    if (docId) {
        try {
            const docSnap = await db.collection("helps").doc(docId).get();
            
            if (docSnap.exists) {
                const data = docSnap.data();
                
                // --- 여기가 핵심 변경사항 ---
                let keywordsHtml = '';
                if (data.keywords && data.keywords.length > 0) {
                    keywordsHtml = `
                        <div class="keyword-tag-container">
                            <h4>관련 키워드</h4>
                            ${data.keywords.map(kw => `<span class="keyword-tag">${kw}</span>`).join('')}
                        </div>
                    `;
                }

                mainContentContainer.innerHTML = `
                    <h2>${data.title}</h2>
                    <p>${data.contents || '내용이 없습니다.'}</p>
                    ${keywordsHtml}
                `;
            } else {
                 mainContentContainer.innerHTML = '<h4>문서가 존재하지 않습니다.</h4>';
            }
        } catch(error) {
            console.error("메인 컨텐츠 로딩 오류:", error);
            mainContentContainer.innerHTML = '<h4>컨텐츠를 불러오는 데 실패했습니다.</h4>';
        }
    } else {
         mainContentContainer.innerHTML = '<h2>Home</h2><p>최상위 문서 목록입니다.</p>';
    }

    try {
        let query = docId === null
            ? db.collection("helps").where("parentIds", "==", [])
            : db.collection("helps").where("parentIds", "array-contains", docId);
        
        const snapshot = await query.get();
        resultsContainer.innerHTML = '';
        if (snapshot.empty) {
            resultsContainer.innerHTML = '<p class="info-text">하위 항목이 없습니다.</p>';
        } else {
            snapshot.forEach(childDoc => {
                const childData = childDoc.data();
                const resultItem = document.createElement('div');
                resultItem.className = 'result-item';
                resultItem.innerHTML = `<h3>${childData.title}</h3>`;
                resultItem.onclick = () => navigateTo(childDoc.id, childData.title);
                resultsContainer.appendChild(resultItem);
            });
        }
    } catch (error) {
        console.error("하위 목록 탐색 중 오류:", error);
        resultsContainer.innerHTML = '<p class="info-text">하위 목록을 불러오는 데 실패했습니다.</p>';
    }
}

/**
 * [검색 모드] 키워드 검색을 수행하는 함수
 */
async function performSearch() {
    const searchTerm = searchInput.value.trim();
    if (!searchTerm) return;

    mainContentContainer.innerHTML = `<h2>'${searchTerm}' 검색 결과</h2>`;
    breadcrumbContainer.innerHTML = '';
    resultsContainer.innerHTML = '<p class="info-text">검색 중입니다...</p>';

    try {
        const snapshot = await db.collection("helps").where("keywords", "array-contains", searchTerm).get();
        
        resultsContainer.innerHTML = '';
        if (snapshot.empty) {
            resultsContainer.innerHTML = '<p class="info-text">검색 결과가 없습니다.</p>';
        } else {
            const regex = new RegExp(searchTerm, 'gi');

            snapshot.forEach(doc => {
                const data = doc.data();
                const resultItem = document.createElement('div');
                resultItem.className = 'result-item';

                const highlightedTitle = data.title.replace(regex, `<mark class="highlight">$&</mark>`);
                const highlightedContents = (data.contents || '').replace(regex, `<mark class="highlight">$&</mark>`);

                resultItem.innerHTML = `
                    <h3>${highlightedTitle}</h3>
                    <p>${highlightedContents}</p>
                    <p style="margin-top: 10px; font-size: 12px; color: #7f8c8d;">매칭 키워드: ${searchTerm}</p>
                `;
                resultItem.onclick = () => {
                    breadcrumbTrail = [];
                    navigateTo(doc.id, data.title);
                };
                resultsContainer.appendChild(resultItem);
            });
        }
    } catch (error) {
        console.error("검색 중 오류 발생:", error);
        resultsContainer.innerHTML = '<p class="info-text">검색에 실패했습니다.</p>';
    }
}

// -------------------------------------------------------------
// 이벤트 리스너 및 초기화
// -------------------------------------------------------------
searchButton.addEventListener('click', performSearch);
searchInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        performSearch();
    }
});

// 페이지 첫 로드 시 최상위(홈)에서 탐색 시작
navigateTo(null, 'Home');
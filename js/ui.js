function showModal(options) {
    const { content, confirmText, onConfirm, id, modalClass, cancelText, onCancel, confirmId } = options;

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';

    const modalContainer = document.createElement('div');
    modalContainer.className = 'modal-content';
    if (id) modalContainer.id = id;
    if (modalClass) modalContainer.classList.add(modalClass);

    const confirmButtonHtml = confirmText ? `<button id="${confirmId || 'modal-confirm'}">${confirmText}</button>` : '';

    modalContainer.innerHTML = `
        ${content}
        <div class="modal-buttons">
            <button id="modal-cancel">${cancelText || '취소'}</button>
            ${confirmButtonHtml}
        </div>
    `;

    modalOverlay.appendChild(modalContainer);
    document.body.appendChild(modalOverlay);
    modalOverlay.style.display = 'flex';

    if (confirmText) {
        const confirmButton = modalOverlay.querySelector(`#${confirmId || 'modal-confirm'}`);
        confirmButton.onclick = onConfirm || closeModal;
    }

    const cancelButton = modalOverlay.querySelector('#modal-cancel');
    cancelButton.onclick = onCancel || closeModal;
    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) {
            onCancel ? onCancel() : closeModal();
        }
    };
}

function showModalAlert(message) {
    showModal({
        content: `<p style="margin-top:0;">${message}</p>`,
        confirmText: '확인',
        confirmId: 'modal-alert-ok',
        modalClass: 'modal-confirm',
        onConfirm: closeModal
    });
    setTimeout(() => {
        const cancelButton = document.querySelector('.modal-overlay:last-of-type #modal-cancel');
        if (cancelButton) cancelButton.style.display = 'none';
        document.getElementById('modal-alert-ok')?.focus()
    }, 0);
}

function closeModal() {
    const modals = document.querySelectorAll('.modal-overlay');
    if (modals.length > 0) {
        document.body.removeChild(modals[modals.length - 1]);
    }
}

function openHyperlinkModal(onConfirm) {
    showModal({
        content: `
            <h3>하이퍼링크 추가</h3>
            <div class="form-group">
                <label for="link-text-input"><span>내용 (표시될 텍스트)</span></label>
                <input type="text" id="link-text-input" placeholder="예: 구글 홈페이지">
            </div>
            <div class="form-group">
                <label for="link-url-input"><span>경로 (URL)</span></label>
                <input type="text" id="link-url-input" placeholder="예: google.com">
            </div>
        `,
        confirmText: '추가',
        id: 'hyperlink-modal',
        onConfirm: onConfirm
    });
}

function openFilePathModal(onConfirm) {
    showModal({
        content: `
            <h3>공유 폴더/파일 경로 추가</h3>
            <div class="form-group">
                <label for="filepath-input"><span>경로</span></label>
                <input type="text" id="filepath-input" placeholder="예: \\\\Server\\Share\\Folder">
            </div>
        `,
        confirmText: '추가',
        id: 'filepath-modal',
        onConfirm: onConfirm
    });
}

function insertTextIntoTextarea(htmlToInsert) {
    const textarea = document.getElementById('editor-contents-textarea');
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const textBefore = textarea.value.substring(0, start);
    const textAfter = textarea.value.substring(end, textarea.value.length);
    textarea.value = textBefore + htmlToInsert + textAfter;

    textarea.selectionStart = textarea.selectionEnd = start + htmlToInsert.length;
    textarea.focus();
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function setupTagInput(keywords) {
    const container = document.getElementById('tag-container');
    const input = document.getElementById('tag-input');
    if (!container || !input) return;
    
    // 기존 태그 초기화
    container.querySelectorAll('.tag-item').forEach(tag => tag.remove());
    
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
        if (e.target.classList.contains('remove-tag')) {
            e.target.parentElement.remove();
        }
    });
}

function createTag(text) {
    const tag = document.createElement('div');
    tag.className = 'tag-item';
    tag.innerHTML = `<span>${text}</span> <span class="remove-tag" title="삭제">x</span>`;
    return tag;
}


export { showModal, showModalAlert, closeModal, openHyperlinkModal, openFilePathModal, insertTextIntoTextarea, setupTagInput, createTag };
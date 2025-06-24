import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, arrayUnion, arrayRemove, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// --- 여기가 수정된 부분이야! ---
// getAuth 대신 initializeAuth와 해결사(resolver)들을 가져옵니다.
import {
    initializeAuth,
    browserPopupRedirectResolver, // 팝업/리다이렉트 문제 해결사
    browserLocalPersistence,      // 로그인 상태 유지 방식 (권장)
    GoogleAuthProvider,
    signInWithPopup,              // 팝업 방식을 다시 가져옵니다
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCBimrNdCRm88oFQZtk2ZwTOjnhrFt9y8U",
    authDomain: "honey-db.firebaseapp.com",
    projectId: "honey-db",
    storageBucket: "honey-db.appspot.com",
    messagingSenderId: "199052115391",
    appId: "1:199052115391:web:db3bf8bc864a026d2f750a"
};

let app, db, auth;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    
    // --- 여기가 수정된 부분이야! ---
    // getAuth(app) 대신 initializeAuth를 사용하고, 문제 해결 옵션을 추가합니다.
    auth = initializeAuth(app, {
        persistence: browserLocalPersistence,
        popupRedirectResolver: browserPopupRedirectResolver,
    });

} catch (e) {
    console.error("Firebase 초기화 오류:", e);
    document.body.innerHTML = '<div style="padding: 20px; text-align: center; color: red;">Firebase 초기화에 실패했습니다. 페이지를 새로고침하거나 관리자에게 문의하세요.</div>';
}

// export 목록을 팝업 방식에 맞게 정리합니다.
export {
    db,
    auth,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    arrayUnion,
    arrayRemove,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    writeBatch
};
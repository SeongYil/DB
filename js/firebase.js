// Firebase 모듈 가져오기
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyCBimrNdCRm88oFQZtk2ZwTOjnhrFt9y8U",
    authDomain: "honey-db.firebaseapp.com",
    projectId: "honey-db",
    storageBucket: "honey-db.appspot.com",
    messagingSenderId: "199052115391",
    appId: "1:199052115391:web:db3bf8bc864a026d2f750a"
};

// Firebase 앱 초기화
let app, db, auth;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} catch (e) {
    console.error("Firebase 초기화 오류:", e);
    // 앱이 멈추지 않도록 사용자에게 알림
    document.body.innerHTML = '<div style="padding: 20px; text-align: center; color: red;">Firebase 초기화에 실패했습니다. 페이지를 새로고침하거나 관리자에게 문의하세요.</div>';
}

// 다른 파일에서 쓸 수 있도록 db와 auth, 그리고 필요한 함수들을 export
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
    onAuthStateChanged
};
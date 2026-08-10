// Firebase 클라이언트 SDK (브라우저용)
// - 이 config 의 apiKey 등은 "공개돼도 되는" 클라이언트 식별자입니다.
//   (실제 접근 통제는 Firebase 보안 규칙 + 서버 Admin SDK 로 합니다)
import { initializeApp, getApps, getApp } from 'firebase/app'

// 환경변수(.env.local / Vercel) 우선, 없으면 하드코딩 fallback
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? 'AIzaSyCMq3SWCNDXruWPsl0ZaXvjB8MJo9hJK1s',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'chatnovel-e2ccb.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'chatnovel-e2ccb',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'chatnovel-e2ccb.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '397018520065',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '1:397018520065:web:2e0cf5d2dd6b6b8a33fe00',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? 'G-TF0MLPZZSX',
}

// HMR/중복 초기화 방지
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)

// Analytics 는 브라우저에서만 동작 → 지연 로딩
export async function getFirebaseAnalytics() {
  if (typeof window === 'undefined') return null
  const { getAnalytics, isSupported } = await import('firebase/analytics')
  if (!(await isSupported())) return null
  return getAnalytics(firebaseApp)
}

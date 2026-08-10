// Firebase Admin SDK (서버 전용) — 절대 클라이언트 번들로 노출 금지
// 서비스 계정 키는 .env.local 의 FIREBASE_SERVICE_ACCOUNT_KEY (JSON 한 줄) 에서 읽습니다.
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    console.error('FIREBASE_SERVICE_ACCOUNT_KEY 파싱 실패: JSON 형식을 확인하세요.')
    return null
  }
}

let adminApp: App | null = null

export function getAdminApp(): App {
  if (adminApp) return adminApp
  if (getApps().length) {
    adminApp = getApps()[0]
    return adminApp
  }
  const svc = loadServiceAccount()
  if (!svc) {
    throw new Error(
      'Firebase Admin 초기화 실패: .env.local 에 FIREBASE_SERVICE_ACCOUNT_KEY 를 설정하세요.'
    )
  }
  adminApp = initializeApp({ credential: cert(svc) })
  return adminApp
}

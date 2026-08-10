// Firestore 기반 데이터 계층 — Prisma Client 와 (앱이 쓰는 부분만) 동일한 인터페이스를 제공한다.
// 이렇게 하면 기존 API 라우트를 수정하지 않고 SQLite → Firestore 로 전환할 수 있다.
// Vercel(서버리스)에서도 그대로 동작한다. (Firebase 콘솔에서 Firestore 활성화 필요)
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getAdminApp } from './firebase-admin'

let _fs: Firestore | null = null
function fs(): Firestore {
  if (_fs) return _fs
  _fs = getFirestore(getAdminApp())
  try {
    _fs.settings({ ignoreUndefinedProperties: true })
  } catch {
    // 이미 설정됨 — 무시
  }
  return _fs
}

// ---- 모델 → 컬렉션 & 관계 정의 ----
type Relation = { col: string; fk: string; single?: boolean }
type ModelDef = {
  col: string
  relations?: Record<string, Relation>
  cascade?: boolean // project 삭제 시 하위 문서 정리
}

const MODELS: Record<string, ModelDef> = {
  project: {
    col: 'projects',
    cascade: true,
    relations: {
      sessions: { col: 'sessions', fk: 'projectId' },
      nodes: { col: 'nodes', fk: 'projectId' },
      bibles: { col: 'bibles', fk: 'projectId' },
      canonTracker: { col: 'canonTrackers', fk: 'projectId', single: true },
      episodes: { col: 'episodes', fk: 'projectId' },
      metrics: { col: 'metrics', fk: 'projectId' },
    },
  },
  session: {
    col: 'sessions',
    relations: {
      messages: { col: 'messages', fk: 'sessionId' },
      nodes: { col: 'nodes', fk: 'sessionId' },
    },
  },
  message: { col: 'messages' },
  node: { col: 'nodes' },
  nodeLink: { col: 'nodeLinks' },
  bible: { col: 'bibles' },
  canonTracker: { col: 'canonTrackers' },
  episode: {
    col: 'episodes',
    relations: { revisions: { col: 'revisions', fk: 'episodeId' } },
  },
  revision: { col: 'revisions' },
  metric: { col: 'metrics' },
}

// ---- 유틸 ----
type Doc = Record<string, any>

// Firestore Timestamp → ISO 문자열, 그리고 id 포함
function normalize(snap: FirebaseFirestore.DocumentSnapshot): Doc {
  const data = snap.data() || {}
  const out: Doc = { id: snap.id }
  for (const [k, v] of Object.entries(data)) {
    out[k] = v && typeof (v as any).toDate === 'function' ? (v as any).toDate().toISOString() : v
  }
  return out
}

// where 를 { idLookup?, filters[] } 로 분해 (복합키 { projectId_type: {...} } 도 펼침)
function parseWhere(where: Doc = {}): { idLookup?: string; filters: [string, any][] } {
  let idLookup: string | undefined
  const filters: [string, any][] = []
  for (const [k, v] of Object.entries(where)) {
    if (k === 'id') {
      idLookup = v as string
    } else if (v && typeof v === 'object' && !(v instanceof Date)) {
      // 복합 유니크 키: 하위 필드를 개별 equality 로 펼침
      for (const [sk, sv] of Object.entries(v)) filters.push([sk, sv])
    } else {
      filters.push([k, v])
    }
  }
  return { idLookup, filters }
}

// 인덱스 없이 동작하도록: Firestore 에는 첫 equality 만 보내고 나머지 필터/정렬은 메모리에서 처리
async function fetchByFilters(colName: string, filters: [string, any][]): Promise<Doc[]> {
  let q: FirebaseFirestore.Query = fs().collection(colName)
  if (filters.length > 0) q = q.where(filters[0][0], '==', filters[0][1])
  const snap = await q.get()
  let docs = snap.docs.map(normalize)
  for (let i = 1; i < filters.length; i++) {
    docs = docs.filter((d) => d[filters[i][0]] === filters[i][1])
  }
  return docs
}

function makeComparator(orderBy: any) {
  const keys: [string, 'asc' | 'desc'][] = []
  const arr = Array.isArray(orderBy) ? orderBy : [orderBy]
  for (const o of arr) {
    if (!o) continue
    for (const [k, dir] of Object.entries(o)) keys.push([k, dir as 'asc' | 'desc'])
  }
  return (a: Doc, b: Doc) => {
    for (const [k, dir] of keys) {
      const av = a[k]
      const bv = b[k]
      if (av === bv) continue
      const cmp = av < bv ? -1 : 1
      return dir === 'desc' ? -cmp : cmp
    }
    return 0
  }
}

function applySort(docs: Doc[], orderBy: any, take?: number): Doc[] {
  let out = docs
  if (orderBy) out = [...docs].sort(makeComparator(orderBy))
  if (typeof take === 'number') out = out.slice(0, take)
  return out
}

async function applyInclude(def: ModelDef, doc: Doc, include: Doc) {
  for (const [key, cfg] of Object.entries(include)) {
    if (key === '_count') {
      doc._count = {}
      const select = (cfg as any)?.select || {}
      for (const rel of Object.keys(select)) {
        const r = def.relations?.[rel]
        if (!r) {
          doc._count[rel] = 0
          continue
        }
        const kids = await fetchByFilters(r.col, [[r.fk, doc.id]])
        doc._count[rel] = kids.length
      }
      continue
    }
    const r = def.relations?.[key]
    if (!r) continue
    let kids = await fetchByFilters(r.col, [[r.fk, doc.id]])
    const opts = (cfg && typeof cfg === 'object') ? (cfg as Doc) : {}
    kids = applySort(kids, opts.orderBy, opts.take)
    doc[key] = r.single ? kids[0] ?? null : kids
  }
}

// ---- 모델별 CRUD 구현 ----
function model(name: string) {
  const def = MODELS[name]
  const col = () => fs().collection(def.col)

  return {
    async findMany(args: Doc = {}) {
      const { filters } = parseWhere(args.where)
      let docs = await fetchByFilters(def.col, filters)
      docs = applySort(docs, args.orderBy, args.take)
      if (args.include) for (const d of docs) await applyInclude(def, d, args.include)
      return docs
    },

    async findUnique(args: Doc = {}) {
      const { idLookup, filters } = parseWhere(args.where)
      let doc: Doc | null = null
      if (idLookup) {
        const snap = await col().doc(idLookup).get()
        doc = snap.exists ? normalize(snap) : null
      } else {
        const docs = await fetchByFilters(def.col, filters)
        doc = docs[0] ?? null
      }
      if (doc && args.include) await applyInclude(def, doc, args.include)
      return doc
    },

    async findFirst(args: Doc = {}) {
      return this.findMany({ ...args, take: 1 }).then((r: Doc[]) => r[0] ?? null)
    },

    async create(args: Doc) {
      const ref = col().doc()
      const now = new Date()
      const payload = { createdAt: now, updatedAt: now, ...args.data }
      await ref.set(payload)
      const snap = await ref.get()
      return normalize(snap)
    },

    async update(args: Doc) {
      const { idLookup, filters } = parseWhere(args.where)
      let id = idLookup
      if (!id) {
        const docs = await fetchByFilters(def.col, filters)
        if (!docs[0]) throw new Error(`${name}.update: 대상을 찾을 수 없습니다`)
        id = docs[0].id
      }
      const ref = col().doc(id!)
      await ref.set({ ...args.data, updatedAt: new Date() }, { merge: true })
      const snap = await ref.get()
      return normalize(snap)
    },

    async delete(args: Doc) {
      const { idLookup, filters } = parseWhere(args.where)
      let id = idLookup
      if (!id) {
        const docs = await fetchByFilters(def.col, filters)
        if (!docs[0]) throw new Error(`${name}.delete: 대상을 찾을 수 없습니다`)
        id = docs[0].id
      }
      if (def.cascade && name === 'project') await cascadeDeleteProject(id!)
      await col().doc(id!).delete()
      return { id }
    },

    async aggregate(args: Doc = {}) {
      const { filters } = parseWhere(args.where)
      const docs = await fetchByFilters(def.col, filters)
      const result: Doc = {}
      if (args._sum) {
        result._sum = {}
        for (const f of Object.keys(args._sum)) {
          result._sum[f] = docs.reduce((s, d) => s + (Number(d[f]) || 0), 0)
        }
      }
      if (args._count !== undefined) result._count = docs.length
      return result
    },
  }
}

async function deleteAllWhere(colName: string, field: string, value: any): Promise<string[]> {
  const docs = await fetchByFilters(colName, [[field, value]])
  await Promise.all(docs.map((d) => fs().collection(colName).doc(d.id).delete()))
  return docs.map((d) => d.id)
}

// project 삭제 시 하위 문서 정리 (Firestore 는 cascade 가 없으므로 수동)
async function cascadeDeleteProject(projectId: string) {
  const sessionIds = await deleteAllWhere('sessions', 'projectId', projectId)
  for (const sid of sessionIds) await deleteAllWhere('messages', 'sessionId', sid)
  const episodeIds = await deleteAllWhere('episodes', 'projectId', projectId)
  for (const eid of episodeIds) await deleteAllWhere('revisions', 'episodeId', eid)
  await deleteAllWhere('nodes', 'projectId', projectId)
  await deleteAllWhere('bibles', 'projectId', projectId)
  await deleteAllWhere('canonTrackers', 'projectId', projectId)
  await deleteAllWhere('metrics', 'projectId', projectId)
}

// Prisma Client 와 동일한 접근 형태: db.project.findMany(...) 등
export const db = {
  project: model('project'),
  session: model('session'),
  message: model('message'),
  node: model('node'),
  nodeLink: model('nodeLink'),
  bible: model('bible'),
  canonTracker: model('canonTracker'),
  episode: model('episode'),
  revision: model('revision'),
  metric: model('metric'),
}

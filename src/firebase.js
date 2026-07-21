import { initializeApp } from "firebase/app"
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth"
import { getDatabase, ref, set, onValue, get, off, serverTimestamp } from "firebase/database"

const firebaseConfig = {
  apiKey: "AIzaSyB8ukCOCKHc1GRkDJ5BpMlSF_iRyEO4pZk",
  authDomain: "perfil-de-lote.firebaseapp.com",
  projectId: "perfil-de-lote",
  storageBucket: "perfil-de-lote.firebasestorage.app",
  messagingSenderId: "83277777318",
  appId: "1:83277777318:web:9357e7e2a07379fc21a767",
  databaseURL: "https://perfil-de-lote-default-rtdb.firebaseio.com",
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getDatabase(app)

const DATA_PATH = "dados/relatorios"

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function toArray(raw) {
  if (raw == null) return []
  if (Array.isArray(raw)) return raw.filter(Boolean)
  if (typeof raw !== "object") return []
  const keys = Object.keys(raw).filter((k) => /^\d+$/.test(k))
  if (keys.length === 0) return []
  return keys.sort((a, b) => Number(a) - Number(b)).map((k) => raw[k]).filter(Boolean)
}

function normalizeAluno(a) {
  if (!a || typeof a !== "object") return null
  const sexo = ["feminino", "masculino", "outros"].includes(a.sexo) ? a.sexo : "outros"
  return {
    id: a.id || uid(),
    nome: String(a.nome ?? "").trim(),
    sexo,
    dataNascimento: a.dataNascimento || "",
    idade: Number(a.idade) >= 0 ? Number(a.idade) : 0,
    municipio: a.municipio || "",
  }
}

function normalizeTurma(t) {
  if (!t || typeof t !== "object") return null
  return {
    id: t.id || uid(),
    turmaId: String(t.turmaId ?? "").trim(),
    municipio: t.municipio || "",
    tipologia: t.tipologia || "",
    curso: t.curso || "",
    dataInicio: t.dataInicio || "",
    dataFim: t.dataFim || "",
    concludentes: Number(t.concludentes) >= 0 ? Number(t.concludentes) : 0,
    alunos: toArray(t.alunos).map(normalizeAluno).filter(Boolean),
  }
}

function normalizeRelatorio(r) {
  if (!r || typeof r !== "object") return null
  return {
    id: r.id || uid(),
    nome: String(r.nome ?? "Relatório").trim(),
    criadoEm: r.criadoEm || "",
    importadoEm: r.importadoEm || undefined,
    turmas: toArray(r.turmas).map(normalizeTurma).filter(Boolean),
  }
}

export function normalizeRelatorios(raw) {
  if (raw == null) return []
  let list = []
  if (Array.isArray(raw)) list = raw
  else if (typeof raw === "object") {
    if (raw.items != null) list = toArray(raw.items)
    else if (Array.isArray(raw.relatorios)) list = raw.relatorios
    else list = toArray(raw)
  }
  return list.map(normalizeRelatorio).filter(Boolean)
}

export function relatoriosRef() {
  return ref(db, DATA_PATH)
}

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password)
}

export function logout() {
  return signOut(auth)
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback)
}

export function subscribeRelatorios(callback) {
  const r = relatoriosRef()
  onValue(r, (snap) => {
    callback(normalizeRelatorios(snap.val()))
  })
  return () => off(r)
}

export async function saveRelatorios(data) {
  const items = normalizeRelatorios(data)
  await set(relatoriosRef(), { v: 1, items, updatedAt: serverTimestamp() })
}

export async function fetchRelatoriosOnce() {
  const snap = await get(relatoriosRef())
  return normalizeRelatorios(snap.val())
}

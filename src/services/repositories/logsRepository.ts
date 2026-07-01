// Takip Sistemi - Log (Audit Trail) Repository
import { collection, addDoc, getDocs, query, orderBy, limit as fbLimit } from "firebase/firestore";
import { firestore, isFirebaseActive } from "../firebase";
import type { LogEntry, ActorInfo } from "../../types";
import { getLocalData, setLocalData, randomId } from "./localStorageUtils";

export interface LogsRepository {
  add(actor: ActorInfo, action: string, details: string): Promise<void>;
  getRecent(): Promise<LogEntry[]>;
}

const MAX_LOCAL_LOGS = 500;

const firebaseLogsRepository: LogsRepository = {
  async add(actor, action, details) {
    const newLog: Omit<LogEntry, "id"> = {
      userId: actor.currentUserId,
      userName: actor.currentUserName,
      userRole: actor.currentUserRole,
      action,
      details,
      createdAt: new Date().toISOString()
    };
    try {
      await addDoc(collection(firestore!, "logs"), newLog);
    } catch (e) {
      console.error("Log kaydedilemedi:", e);
    }
  },

  async getRecent() {
    const q = query(collection(firestore!, "logs"), orderBy("createdAt", "desc"), fbLimit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LogEntry, "id">) }));
  }
};

const mockLogsRepository: LogsRepository = {
  async add(actor, action, details) {
    const newLog: LogEntry = {
      id: randomId("log"),
      userId: actor.currentUserId,
      userName: actor.currentUserName,
      userRole: actor.currentUserRole,
      action,
      details,
      createdAt: new Date().toISOString()
    };
    const logs = getLocalData<LogEntry>("takip_logs");
    logs.unshift(newLog);
    const trimmed = logs.length > MAX_LOCAL_LOGS ? logs.slice(0, MAX_LOCAL_LOGS) : logs;
    try {
      setLocalData("takip_logs", trimmed);
    } catch (e) {
      console.error("Log kaydedilemedi (kota veya başka hata):", e);
    }
  },

  async getRecent() {
    return getLocalData<LogEntry>("takip_logs").sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
};

export const logsRepository: LogsRepository = isFirebaseActive
  ? firebaseLogsRepository
  : mockLogsRepository;

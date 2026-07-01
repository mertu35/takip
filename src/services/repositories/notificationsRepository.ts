// Takip Sistemi - Bildirim (Notifications) Repository
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as fbLimit,
  updateDoc
} from "firebase/firestore";
import { firestore, isFirebaseActive } from "../firebase";
import type { AppNotification, NotificationType } from "../../types";
import { getLocalData, setLocalData, randomId } from "./localStorageUtils";

export interface NotificationsRepository {
  add(
    userId: string,
    message: string,
    type?: NotificationType,
    meta?: Partial<AppNotification>
  ): Promise<void>;
  getForUser(userId: string): Promise<AppNotification[]>;
  markRead(userId: string): Promise<void>;
}

const firebaseNotificationsRepository: NotificationsRepository = {
  async add(userId, message, type = "info", meta = {}) {
    const notification: Omit<AppNotification, "id"> = {
      userId,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
      ...meta
    };
    try {
      await addDoc(collection(firestore!, "notifications"), notification);
    } catch (e) {
      console.error("Bildirim kaydedilemedi:", e);
    }
  },

  async getForUser(userId) {
    // NOT: Bu sorgu where("userId","==",...) + orderBy("createdAt","desc")
    // kullandığı için Firestore'da composite index gerektirir.
    // Bkz. firestore.indexes.json (notifications: userId ASC + createdAt DESC).
    const q = query(
      collection(firestore!, "notifications"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      fbLimit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, "id">) }));
  },

  async markRead(userId) {
    const q = query(
      collection(firestore!, "notifications"),
      where("userId", "==", userId),
      where("read", "==", false)
    );
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { read: true })));
  }
};

const mockNotificationsRepository: NotificationsRepository = {
  async add(userId, message, type = "info", meta = {}) {
    const notification: AppNotification = {
      id: randomId("notif"),
      userId,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
      ...meta
    };
    const notifications = getLocalData<AppNotification>("takip_notifications");
    notifications.unshift(notification);
    setLocalData("takip_notifications", notifications.slice(0, 200));
  },

  async getForUser(userId) {
    return getLocalData<AppNotification>("takip_notifications")
      .filter((n) => n.userId === userId)
      .slice(0, 50);
  },

  async markRead(userId) {
    const all = getLocalData<AppNotification>("takip_notifications");
    const updated = all.map((n) => (n.userId === userId ? { ...n, read: true } : n));
    setLocalData("takip_notifications", updated);
  }
};

export const notificationsRepository: NotificationsRepository = isFirebaseActive
  ? firebaseNotificationsRepository
  : mockNotificationsRepository;

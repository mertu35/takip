// Takip Sistemi - Duyuru (Announcements) Repository
import { collection, getDocs, addDoc, doc, deleteDoc } from "firebase/firestore";
import { firestore, isFirebaseActive } from "../firebase";
import type { Announcement, ActorInfo } from "../../types";
import { getLocalData, setLocalData, randomId } from "./localStorageUtils";
import { logsRepository } from "./logsRepository";

export interface AnnouncementsRepository {
  getAll(): Promise<Announcement[]>;
  add(text: string, actor: ActorInfo): Promise<Announcement>;
  remove(announcementId: string, actor: ActorInfo): Promise<void>;
}

const firebaseAnnouncementsRepository: AnnouncementsRepository = {
  async getAll() {
    const snap = await getDocs(collection(firestore!, "announcements"));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Announcement, "id">) }));
  },
  async add(text, actor) {
    const newAnn = { text, active: true, createdAt: new Date().toISOString() };
    const docRef = await addDoc(collection(firestore!, "announcements"), newAnn);
    await logsRepository.add(actor, "ADD_ANNOUNCEMENT", `Yeni duyuru yayınlandı: "${text.substring(0, 30)}..."`);
    return { id: docRef.id, ...newAnn };
  },
  async remove(announcementId, actor) {
    await deleteDoc(doc(firestore!, "announcements", announcementId));
    await logsRepository.add(actor, "DELETE_ANNOUNCEMENT", "Duyuru silindi.");
  }
};

const mockAnnouncementsRepository: AnnouncementsRepository = {
  async getAll() {
    return getLocalData<Announcement>("takip_announcements");
  },
  async add(text, actor) {
    const newAnn: Announcement = {
      id: randomId("ann"),
      text,
      active: true,
      createdAt: new Date().toISOString()
    };
    const anns = getLocalData<Announcement>("takip_announcements");
    anns.unshift(newAnn);
    setLocalData("takip_announcements", anns);
    await logsRepository.add(
      actor,
      "ADD_ANNOUNCEMENT",
      `Yeni duyuru yayınlandı (Yerel): "${text.substring(0, 30)}..."`
    );
    return newAnn;
  },
  async remove(announcementId, actor) {
    const anns = getLocalData<Announcement>("takip_announcements");
    setLocalData(
      "takip_announcements",
      anns.filter((a) => a.id !== announcementId)
    );
    await logsRepository.add(actor, "DELETE_ANNOUNCEMENT", "Duyuru silindi (Yerel).");
  }
};

export const announcementsRepository: AnnouncementsRepository = isFirebaseActive
  ? firebaseAnnouncementsRepository
  : mockAnnouncementsRepository;

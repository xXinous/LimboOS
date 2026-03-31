import React, { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import {
  collection,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  query,
  where,
  getDoc,
  writeBatch,
} from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { format } from "date-fns";
import { useModal } from './ConfirmModal';

interface UserData {
  uid: string;
  displayName: string;
  username?: string;
  email: string;
  role: string;
  lastLogin?: any;
  createdAt?: any;
}

interface TapeData {
  tapeId: string;
  unlockedAt?: any;
}

interface PlayCountData {
  tapeId: string;
  count: number;
}

interface AudioData {
  id: string;
  originalName: string;
}

export default function UserRegistry({ isAdmin }: { isAdmin: boolean }) {
  const [users, setUsers] = useState<UserData[]>([]);
  const { showAlert, modal } = useModal();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userTapes, setUserTapes] = useState<Record<string, TapeData[]>>({});
  const [userPlayCounts, setUserPlayCounts] = useState<Record<string, PlayCountData[]>>({});
  const [userTotalPlays, setUserTotalPlays] = useState<Record<string, number>>({});
  const [userStats, setUserStats] = useState<Record<string, any>>({});
  const [userAchievements, setUserAchievements] = useState<Record<string, any[]>>({});
  // Confirm modal state
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);
  const [confirmDeleteTape, setConfirmDeleteTape] = useState<{ uid: string; tapeId: string } | null>(null);

  // Audio library for the add-tape dropdown
  const [availableAudios, setAvailableAudios] = useState<AudioData[]>([]);
  // Add tape modal state
  const [addTapeModal, setAddTapeModal] = useState<string | null>(null); // uid of target user
  const [selectedAudioId, setSelectedAudioId] = useState<string>("");

  // Create user modal state
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserCodinome, setNewUserCodinome] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("member");
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [createUserFeedback, setCreateUserFeedback] = useState<string | null>(null);

  // Transfer data modal state
  const [transferModal, setTransferModal] = useState<string | null>(null); // source uid
  const [transferTargetUid, setTransferTargetUid] = useState<string>("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferFeedback, setTransferFeedback] = useState<string | null>(null);


  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const usersData: UserData[] = [];
        snapshot.forEach((doc) => {
          usersData.push(doc.data() as UserData);
        });
        setUsers(usersData);
      },
      (error) => {
        console.error("Error fetching users:", error);
      },
    );

    return () => unsubscribe();
  }, []);

  // Fetch play events to compute per-user totals
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "playEvents"),
      (snapshot) => {
        const counts: Record<string, number> = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.uid) {
            counts[data.uid] = (counts[data.uid] || 0) + 1;
          }
        });
        setUserTotalPlays(counts);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch available audios for the tape picker
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "audios"), (snapshot) => {
      const audios: AudioData[] = [];
      snapshot.forEach((d) => {
        audios.push({ id: d.id, originalName: d.data().originalName || d.id });
      });
      setAvailableAudios(audios);
    });
    return () => unsubscribe();
  }, []);

  const loadUserTapes = async (uid: string) => {
    try {
      const tapesSnap = await getDocs(collection(db, "users", uid, "tapes"));
      const tapes: TapeData[] = [];
      tapesSnap.forEach((d) => tapes.push({ tapeId: d.id, ...d.data() } as TapeData));
      setUserTapes((prev) => ({ ...prev, [uid]: tapes }));

      // Load play counts from playEvents
      const eventsSnap = await getDocs(
        query(collection(db, "playEvents"), where("uid", "==", uid))
      );
      const tapeCounts: Record<string, number> = {};
      eventsSnap.forEach((d) => {
        const data = d.data();
        if (data.tapeId) {
          tapeCounts[data.tapeId] = (tapeCounts[data.tapeId] || 0) + 1;
        }
      });
      const playCounts: PlayCountData[] = Object.entries(tapeCounts).map(([tapeId, count]) => ({
        tapeId,
        count,
      }));
      setUserPlayCounts((prev) => ({ ...prev, [uid]: playCounts }));

      // Load stats
      const statsSnap = await getDoc(doc(db, "users", uid, "stats", "main"));
      if (statsSnap.exists()) {
        setUserStats((prev) => ({ ...prev, [uid]: statsSnap.data() }));
      }

      // Load achievements
      const achSnap = await getDocs(collection(db, "users", uid, "achievements"));
      const achs: any[] = [];
      achSnap.forEach((d) => achs.push({ achievementId: d.id, ...d.data() }));
      setUserAchievements((prev) => ({ ...prev, [uid]: achs }));
    } catch (error) {
      console.error("Error loading user tapes:", error);
    }
  };

  const toggleExpand = (uid: string) => {
    if (expandedUser === uid) {
      setExpandedUser(null);
    } else {
      setExpandedUser(uid);
      loadUserTapes(uid);
    }
  };

  const handleDelete = (uid: string) => {
    if (!isAdmin) return;
    setConfirmDeleteUid(uid);
  };

  const executeDelete = async (uid: string) => {
    setConfirmDeleteUid(null);
    try {
      // Delete subcollections
      const tapesSnap = await getDocs(collection(db, "users", uid, "tapes"));
      await Promise.all(tapesSnap.docs.map((d) => deleteDoc(d.ref)));

      const achSnap = await getDocs(collection(db, "users", uid, "achievements"));
      await Promise.all(achSnap.docs.map((d) => deleteDoc(d.ref)));

      // Delete user doc
      await deleteDoc(doc(db, "users", uid));
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  const handleBackup = async (user: UserData) => {
    try {
      const tapesSnap = await getDocs(collection(db, "users", user.uid, "tapes"));
      const tapes = tapesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const achSnap = await getDocs(collection(db, "users", user.uid, "achievements"));
      const achievements = achSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const eventsSnap = await getDocs(
        query(collection(db, "playEvents"), where("uid", "==", user.uid))
      );
      const playEvents = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const backup = {
        exportedAt: new Date().toISOString(),
        user: {
          ...user,
          lastLogin: user.lastLogin?.toDate?.()?.toISOString?.() || null,
          createdAt: user.createdAt?.toDate?.()?.toISOString?.() || null,
        },
        tapes,
        achievements,
        playEvents,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${user.displayName || user.username || user.uid}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error creating backup:", error);
      showAlert('Erro de Backup', 'Falha ao criar o backup. Verifique o console.');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !isAdmin) return;
    try {
      await updateDoc(doc(db, "users", editingUser.uid), {
        displayName: editingUser.displayName,
        username: editingUser.displayName,
        role: editingUser.role,
      });
      setEditingUser(null);
    } catch (error) {
      console.error("Error updating user:", error);
      showAlert('Erro ao Atualizar', 'Falha ao atualizar dados do usuário.');
    }
  };

  const handleDeleteTape = (uid: string, tapeId: string) => {
    if (!isAdmin) return;
    setConfirmDeleteTape({ uid, tapeId });
  };

  const executeDeleteTape = async (uid: string, tapeId: string) => {
    setConfirmDeleteTape(null);
    try {
      await deleteDoc(doc(db, "users", uid, "tapes", tapeId));
      loadUserTapes(uid);
    } catch (error) {
      console.error("Error removing tape:", error);
    }
  };

  // ── Add Tape via Modal ─────────────────────────────────────────────────────
  const openAddTapeModal = (uid: string) => {
    setAddTapeModal(uid);
    setSelectedAudioId("");
  };

  const executeAddTape = async () => {
    if (!addTapeModal || !selectedAudioId) return;
    try {
      await setDoc(doc(db, "users", addTapeModal, "tapes", selectedAudioId), {
        tapeId: selectedAudioId,
        unlockedAt: serverTimestamp(),
      });
      loadUserTapes(addTapeModal);
      setAddTapeModal(null);
      setSelectedAudioId("");
    } catch (error) {
      console.error("Error adding tape:", error);
    }
  };

  // ── Create New User ────────────────────────────────────────────────────────
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserCodinome.trim() || !newUserPassword.trim()) return;
    setCreateUserLoading(true);
    setCreateUserFeedback(null);

    try {
      // Create a secondary Firebase app to avoid logging out the current admin
      const secondaryApp = initializeApp(
        {
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: import.meta.env.VITE_FIREBASE_APP_ID,
        },
        "secondaryApp_" + Date.now()
      );
      const secondaryAuth = getAuth(secondaryApp);

      // Build synthetic email
      const slug = newUserCodinome.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_');
      const email = `${slug}@runningman.local`;

      const { user: newUser } = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        newUserPassword
      );

      // Create user document in Firestore
      await setDoc(doc(db, "users", newUser.uid), {
        uid: newUser.uid,
        displayName: newUserCodinome.trim(),
        username: newUserCodinome.trim(),
        email: email,
        role: newUserRole,
        createdAt: serverTimestamp(),
      });

      // Sign out of secondary app and delete it
      await secondaryAuth.signOut();
      await deleteApp(secondaryApp);

      setCreateUserFeedback(`Usuário "${newUserCodinome.trim()}" criado com sucesso! (UID: ${newUser.uid.slice(0, 8)}...)`);
      setNewUserCodinome("");
      setNewUserPassword("");
      setNewUserRole("member");
    } catch (error: any) {
      console.error("Error creating user:", error);
      const code = error?.code || "";
      if (code === "auth/email-already-in-use") {
        setCreateUserFeedback("ERRO: Codinome já existe no sistema.");
      } else if (code === "auth/weak-password") {
        setCreateUserFeedback("ERRO: Senha muito fraca (mínimo 6 caracteres).");
      } else {
        setCreateUserFeedback(`ERRO: ${error.message || "Falha ao criar usuário."}`);
      }
    } finally {
      setCreateUserLoading(false);
    }
  };

  // ── Transfer Data Between Users ────────────────────────────────────────────
  const openTransferModal = (sourceUid: string) => {
    setTransferModal(sourceUid);
    setTransferTargetUid("");
    setTransferFeedback(null);
  };

  const executeTransfer = async () => {
    if (!transferModal || !transferTargetUid || transferModal === transferTargetUid) {
      setTransferFeedback("ERRO: Selecione um usuário destino diferente.");
      return;
    }

    setTransferLoading(true);
    setTransferFeedback(null);

    try {
      const sourceUid = transferModal;
      const targetUid = transferTargetUid;

      // 1. Transfer tapes
      const tapesSnap = await getDocs(collection(db, "users", sourceUid, "tapes"));
      for (const tapeDoc of tapesSnap.docs) {
        await setDoc(doc(db, "users", targetUid, "tapes", tapeDoc.id), tapeDoc.data());
        await deleteDoc(tapeDoc.ref);
      }

      // 2. Transfer achievements
      const achSnap = await getDocs(collection(db, "users", sourceUid, "achievements"));
      for (const achDoc of achSnap.docs) {
        await setDoc(doc(db, "users", targetUid, "achievements", achDoc.id), achDoc.data());
        await deleteDoc(achDoc.ref);
      }

      // 3. Transfer stats
      const statsSnap = await getDoc(doc(db, "users", sourceUid, "stats", "main"));
      if (statsSnap.exists()) {
        await setDoc(doc(db, "users", targetUid, "stats", "main"), statsSnap.data(), { merge: true });
        await deleteDoc(doc(db, "users", sourceUid, "stats", "main"));
      }

      // 4. Re-point playEvents
      const eventsSnap = await getDocs(
        query(collection(db, "playEvents"), where("uid", "==", sourceUid))
      );
      const batch = writeBatch(db);
      eventsSnap.docs.forEach((eventDoc) => {
        batch.update(eventDoc.ref, { uid: targetUid });
      });
      await batch.commit();

      setTransferFeedback(
        `✓ Transferência concluída! ${tapesSnap.size} tapes, ${achSnap.size} achievements e ${eventsSnap.size} play events migrados.`
      );

      // Reload expanded user data if needed
      if (expandedUser === sourceUid) loadUserTapes(sourceUid);
      if (expandedUser === targetUid) loadUserTapes(targetUid);

    } catch (error) {
      console.error("Error transferring data:", error);
      setTransferFeedback("ERRO: Falha ao transferir dados. Verifique o console.");
    } finally {
      setTransferLoading(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const sourceUser = transferModal ? users.find((u) => u.uid === transferModal) : null;

  return (
    <section className="bg-surface border border-zinc-800 relative">
      {modal}
      <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900/30">
        <div className="flex items-center gap-4">
          <div className="w-2 h-6 bg-orange-600"></div>
          <h2 className="font-headline font-bold uppercase tracking-widest text-lg">
            User_Base_Registry
          </h2>
          <span className="text-[10px] font-label text-zinc-500 tracking-wider">{users.length} REGISTERED</span>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button
              onClick={() => {
                setShowCreateUser(true);
                setCreateUserFeedback(null);
                setNewUserCodinome("");
                setNewUserPassword("");
                setNewUserRole("member");
              }}
              className="flex items-center gap-1.5 bg-emerald-900/40 text-emerald-400 px-4 py-2 rounded-sm font-label text-[10px] font-bold tracking-widest hover:bg-emerald-800/40 transition-all machined-edge border border-emerald-700/30"
            >
              <span className="material-symbols-outlined text-xs">person_add</span>
              ADD_USER
            </button>
          )}
          <input
            type="text"
            placeholder="QUERY_NAME..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-surface-container-lowest border-zinc-800 text-[10px] font-label uppercase tracking-widest focus:ring-1 focus:ring-orange-500 focus:border-orange-500 w-64 placeholder:text-zinc-700 text-zinc-300 px-3 py-2"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low border-b border-zinc-800">
              <th className="p-4 font-label text-[10px] uppercase tracking-widest text-zinc-500">
                Character Name
              </th>
              <th className="p-4 font-label text-[10px] uppercase tracking-widest text-zinc-500">
                Email
              </th>
              <th className="p-4 font-label text-[10px] uppercase tracking-widest text-zinc-500">
                Last Login
              </th>
              <th className="p-4 font-label text-[10px] uppercase tracking-widest text-zinc-500">
                Access_Lvl
              </th>
              <th className="p-4 font-label text-[10px] uppercase tracking-widest text-zinc-500">
                Total_Plays
              </th>
              <th className="p-4 font-label text-[10px] uppercase tracking-widest text-zinc-500 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filteredUsers.map((user) => (
              <React.Fragment key={user.uid}>
                <tr className="hover:bg-zinc-900/50 transition-colors group cursor-pointer" onClick={() => toggleExpand(user.uid)}>
                  <td className="p-4 font-headline font-medium text-sm text-primary">
                    {user.displayName || user.username || "UNKNOWN"}
                  </td>
                  <td className="p-4 font-body text-xs text-zinc-400">
                    {user.email}
                  </td>
                  <td className="p-4 font-body text-xs text-zinc-400">
                    {user.lastLogin
                      ? format(user.lastLogin.toDate(), "yyyy.MM.dd // HH:mm")
                      : "NEVER"}
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-0.5 border text-[8px] font-label uppercase ${
                        user.role === "admin"
                          ? "border-error/50 text-error/80"
                          : user.role === "premium"
                            ? "border-orange-500/30 text-orange-500/80"
                            : "border-zinc-700 text-zinc-500"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="p-4 font-headline font-bold text-sm text-tertiary">
                    {userTotalPlays[user.uid] || 0}
                  </td>
                  <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingUser(user)}
                        className="material-symbols-outlined text-sm text-zinc-500 hover:text-orange-400 transition-colors"
                        title="Edit Profile"
                      >
                        edit
                      </button>
                      <button
                        onClick={() => openTransferModal(user.uid)}
                        className="material-symbols-outlined text-sm text-zinc-500 hover:text-purple-400 transition-colors"
                        title="Transfer Data"
                      >
                        sync_alt
                      </button>
                      <button
                        onClick={() => handleBackup(user)}
                        className="material-symbols-outlined text-sm text-zinc-500 hover:text-blue-400 transition-colors"
                        title="Backup User"
                      >
                        download
                      </button>
                      <button
                        onClick={() => toggleExpand(user.uid)}
                        className="material-symbols-outlined text-sm text-zinc-500 hover:text-tertiary transition-colors"
                        title="View Tapes"
                      >
                        {expandedUser === user.uid ? 'expand_less' : 'expand_more'}
                      </button>
                      <button
                        onClick={() => handleDelete(user.uid)}
                        className="material-symbols-outlined text-sm text-zinc-500 hover:text-error transition-colors"
                        title="Delete Profile"
                      >
                        delete
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Expanded row: user tapes & play counts */}
                {expandedUser === user.uid && (
                  <tr>
                    <td colSpan={6} className="bg-zinc-900/50 border-l-4 border-orange-500/30">
                      <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-orange-500 text-sm">album</span>
                            <h4 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">
                              Unlocked_Tapes ({userTapes[user.uid]?.length || 0})
                            </h4>
                          </div>
                          <button
                            onClick={() => openAddTapeModal(user.uid)}
                            className="flex items-center gap-1 text-[10px] font-label uppercase tracking-wider text-orange-500 hover:text-orange-400 transition-colors"
                          >
                            <span className="material-symbols-outlined text-xs">add</span>
                            ADD_TAPE
                          </button>
                        </div>

                        {userTapes[user.uid]?.length ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {userTapes[user.uid].map((tape) => {
                              const playCount = userPlayCounts[user.uid]?.find(
                                (p) => p.tapeId === tape.tapeId
                              )?.count || 0;
                              // Find audio name from available audios
                              const audioInfo = availableAudios.find((a) => a.id === tape.tapeId);
                              return (
                                <div
                                  key={tape.tapeId}
                                  className="bg-surface-container-lowest border border-zinc-800 p-3 flex items-center justify-between"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="font-headline text-xs font-bold text-zinc-200 truncate">
                                      {audioInfo?.originalName || tape.tapeId}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1">
                                      <span className="text-[9px] font-label text-zinc-500">
                                        <span className="material-symbols-outlined text-[10px] align-middle mr-0.5">play_circle</span>
                                        {playCount} plays
                                      </span>
                                      {tape.unlockedAt && (
                                        <span className="text-[9px] font-label text-zinc-600">
                                          {tape.unlockedAt?.toDate
                                            ? format(tape.unlockedAt.toDate(), "dd/MM/yy")
                                            : ""}
                                        </span>
                                      )}
                                    </div>
                                    {audioInfo && (
                                      <p className="text-[8px] font-label text-zinc-700 mt-0.5 truncate">
                                        ID: {tape.tapeId}
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleDeleteTape(user.uid, tape.tapeId)}
                                    className="material-symbols-outlined text-sm text-zinc-600 hover:text-error transition-colors ml-2"
                                    title="Remove tape"
                                  >
                                    close
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-zinc-600 text-xs font-label tracking-widest">NO_TAPES_UNLOCKED</p>
                        )}

                        {/* Behavioral Stats Section */}
                        <div className="pt-4 border-t border-zinc-800/50">
                          <div className="flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined text-tertiary text-sm">explore</span>
                            <h4 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">
                              Behavioral_Stats
                            </h4>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <StatBox label="Time Listened" value={formatSecs(userStats[user.uid]?.totalListenTime || 0)} />
                            <StatBox label="Max Vol Time" value={formatSecs(userStats[user.uid]?.maxVolumeTime || 0)} />
                            <StatBox label="Muted Time" value={formatSecs(userStats[user.uid]?.zeroVolumeTime || 0)} />
                            <StatBox label="Screws Tampered" value={userStats[user.uid]?.screwClicks || 0} />
                            <StatBox label="Anxious Ejects" value={userStats[user.uid]?.ejectWithoutPlay || 0} />
                          </div>
                        </div>

                        {/* Achievements Section */}
                        <div className="pt-4 border-t border-zinc-800/50">
                          <div className="flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined text-secondary text-sm">stars</span>
                            <h4 className="font-label text-[10px] uppercase tracking-widest text-zinc-400">
                              Unlocked_Achievements ({userAchievements[user.uid]?.length || 0})
                            </h4>
                          </div>
                          {userAchievements[user.uid]?.length ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                              {userAchievements[user.uid].map((ach) => (
                                <div key={ach.achievementId} className="bg-surface-container-lowest border border-zinc-800 p-3 flex items-center gap-3">
                                  <div className="text-secondary text-lg">★</div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-headline text-xs font-bold text-zinc-200 truncate">
                                      {ach.achievementId}
                                    </p>
                                    {ach.unlockedAt && (
                                      <span className="text-[9px] font-label text-zinc-600 truncate block mt-0.5">
                                        ACQUIRED: {ach.unlockedAt?.toDate ? format(ach.unlockedAt.toDate(), "dd/MM/yy HH:mm") : ""}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-zinc-600 text-xs font-label tracking-widest">NO_ACHIEVEMENTS_UNLOCKED</p>
                          )}
                        </div>

                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-8 text-center text-zinc-500 font-label text-xs tracking-widest"
                >
                  NO_RECORDS_FOUND
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-container-low border border-zinc-700 p-6 w-full max-w-md machined-edge">
            <h3 className="font-headline text-lg text-primary mb-4">
              EDIT_USER_PROFILE
            </h3>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block font-label text-[10px] text-zinc-400 mb-1">
                  CODENAME / DISPLAY_NAME
                </label>
                <input
                  type="text"
                  value={editingUser.displayName}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      displayName: e.target.value,
                    })
                  }
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-3 py-2 text-sm focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block font-label text-[10px] text-zinc-400 mb-1">
                  ACCESS_LEVEL
                </label>
                <select
                  value={editingUser.role}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, role: e.target.value })
                  }
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-3 py-2 text-sm focus:border-orange-500 outline-none"
                >
                  <option value="member">MEMBER</option>
                  <option value="premium">PREMIUM</option>
                  <option value="admin">ADMIN</option>
                </select>
              </div>
              <div>
                <label className="block font-label text-[10px] text-zinc-400 mb-1">
                  UID (read-only)
                </label>
                <input
                  type="text"
                  value={editingUser.uid}
                  readOnly
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-600 px-3 py-2 text-xs cursor-not-allowed"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-label text-zinc-400 hover:text-white"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-label bg-primary-container text-on-primary font-bold tracking-wider hover:brightness-110"
                >
                  SAVE_CHANGES
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete User Modal */}
      {confirmDeleteUid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-container-low border border-error/40 p-6 w-full max-w-md machined-edge">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-error text-xl">warning</span>
              <h3 className="font-headline text-lg text-error">DELETE_USER_PROFILE</h3>
            </div>
            <p className="font-body text-sm text-zinc-300 mb-2">
              Isso irá deletar permanentemente o perfil do usuário e todos os dados associados:
            </p>
            <ul className="text-xs font-label text-zinc-500 list-disc list-inside mb-6 space-y-1">
              <li>Tapes desbloqueadas</li>
              <li>Achievements</li>
              <li>Play events</li>
            </ul>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteUid(null)}
                className="px-4 py-2 text-xs font-label text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 transition-colors"
              >
                CANCELAR
              </button>
              <button
                onClick={() => executeDelete(confirmDeleteUid)}
                className="px-4 py-2 text-xs font-label bg-error text-white font-bold tracking-wider hover:brightness-110 transition-all"
              >
                CONFIRMAR_DELETE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Tape Modal */}
      {confirmDeleteTape && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-container-low border border-zinc-700 p-6 w-full max-w-sm machined-edge">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-orange-400 text-xl">album</span>
              <h3 className="font-headline text-base text-zinc-200">REMOVER_TAPE</h3>
            </div>
            <p className="font-body text-sm text-zinc-400 mb-6">
              Remover tape{" "}
              <span className="text-orange-400 font-bold">{confirmDeleteTape.tapeId}</span>{" "}
              do usuário?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteTape(null)}
                className="px-4 py-2 text-xs font-label text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 transition-colors"
              >
                CANCELAR
              </button>
              <button
                onClick={() => executeDeleteTape(confirmDeleteTape.uid, confirmDeleteTape.tapeId)}
                className="px-4 py-2 text-xs font-label bg-orange-600 text-white font-bold tracking-wider hover:brightness-110 transition-all"
              >
                CONFIRMAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Tape Modal (with dropdown) */}
      {addTapeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-container-low border border-orange-500/30 p-6 w-full max-w-md machined-edge">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-orange-500 text-xl">album</span>
              <h3 className="font-headline text-lg text-zinc-200">ADICIONAR_TAPE</h3>
            </div>
            <p className="font-body text-xs text-zinc-500 mb-4">
              Selecione um áudio da biblioteca para adicionar ao jogador:
            </p>
            <select
              value={selectedAudioId}
              onChange={(e) => setSelectedAudioId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-3 py-3 text-sm focus:border-orange-500 outline-none mb-4"
            >
              <option value="">-- SELECIONAR_AUDIO --</option>
              {availableAudios.map((audio) => (
                <option key={audio.id} value={audio.id}>
                  {audio.originalName}
                </option>
              ))}
            </select>
            {selectedAudioId && (
              <p className="text-[9px] font-label text-zinc-600 mb-4 break-all">
                ID: {selectedAudioId}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setAddTapeModal(null)}
                className="px-4 py-2 text-xs font-label text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 transition-colors"
              >
                CANCELAR
              </button>
              <button
                onClick={executeAddTape}
                disabled={!selectedAudioId}
                className="px-4 py-2 text-xs font-label bg-orange-600 text-white font-bold tracking-wider hover:brightness-110 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ADICIONAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New User Modal */}
      {showCreateUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-container-low border border-emerald-500/30 p-6 w-full max-w-md machined-edge">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-emerald-400 text-xl">person_add</span>
              <h3 className="font-headline text-lg text-zinc-200">CRIAR_NOVO_USUARIO</h3>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block font-label text-[10px] text-zinc-400 mb-1">
                  CODINOME (será usado como login)
                </label>
                <input
                  type="text"
                  value={newUserCodinome}
                  onChange={(e) => setNewUserCodinome(e.target.value)}
                  placeholder="ex: agente_silva"
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-3 py-2 text-sm focus:border-emerald-500 outline-none placeholder:text-zinc-700"
                  required
                />
              </div>
              <div>
                <label className="block font-label text-[10px] text-zinc-400 mb-1">
                  SENHA (mínimo 6 caracteres)
                </label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-3 py-2 text-sm focus:border-emerald-500 outline-none placeholder:text-zinc-700"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block font-label text-[10px] text-zinc-400 mb-1">
                  ACCESS_LEVEL
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-3 py-2 text-sm focus:border-emerald-500 outline-none"
                >
                  <option value="member">MEMBER</option>
                  <option value="premium">PREMIUM</option>
                  <option value="admin">ADMIN</option>
                </select>
              </div>

              {createUserFeedback && (
                <p className={`text-[10px] font-label tracking-wider ${createUserFeedback.startsWith('ERRO') ? 'text-red-400' : 'text-emerald-400'}`}>
                  {createUserFeedback}
                </p>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateUser(false)}
                  className="px-4 py-2 text-xs font-label text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 transition-colors"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={createUserLoading}
                  className="px-4 py-2 text-xs font-label bg-emerald-700 text-white font-bold tracking-wider hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {createUserLoading ? 'CRIANDO...' : 'CRIAR_USUARIO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Data Modal */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-container-low border border-purple-500/30 p-6 w-full max-w-lg machined-edge">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-purple-400 text-xl">sync_alt</span>
              <h3 className="font-headline text-lg text-zinc-200">TRANSFERIR_DADOS</h3>
            </div>

            <p className="font-body text-xs text-zinc-500 mb-5">
              Migrar todas as tapes, achievements, stats e play events de um jogador para outro.
            </p>

            {/* Source */}
            <div className="mb-4">
              <label className="block font-label text-[10px] text-zinc-400 mb-1">ORIGEM</label>
              <div className="bg-zinc-900 border border-purple-500/20 p-3 flex items-center gap-3">
                <span className="material-symbols-outlined text-purple-400 text-sm">person</span>
                <div>
                  <p className="font-headline text-sm font-bold text-zinc-200">
                    {sourceUser?.displayName || sourceUser?.username || 'UNKNOWN'}
                  </p>
                  <p className="text-[9px] font-label text-zinc-600">{sourceUser?.email} • {transferModal}</p>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center mb-4">
              <span className="material-symbols-outlined text-purple-500 text-2xl">arrow_downward</span>
            </div>

            {/* Target */}
            <div className="mb-4">
              <label className="block font-label text-[10px] text-zinc-400 mb-1">DESTINO</label>
              <select
                value={transferTargetUid}
                onChange={(e) => setTransferTargetUid(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-3 py-3 text-sm focus:border-purple-500 outline-none"
              >
                <option value="">-- SELECIONAR_DESTINO --</option>
                {users
                  .filter((u) => u.uid !== transferModal)
                  .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
                  .map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName || u.username || 'UNKNOWN'} ({u.email})
                    </option>
                  ))}
              </select>
            </div>

            {/* Warning */}
            <div className="bg-yellow-900/20 border border-yellow-700/30 p-3 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-yellow-500 text-sm">warning</span>
                <span className="font-label text-[10px] text-yellow-500 uppercase tracking-wider">ATENÇÃO</span>
              </div>
              <p className="text-[10px] font-body text-yellow-600">
                Esta ação irá mover TODOS os dados do jogador de origem para o destino.
                Os dados de origem serão removidos. Esta operação não pode ser desfeita facilmente.
                Recomendamos fazer um backup antes.
              </p>
            </div>

            {transferFeedback && (
              <p className={`text-[10px] font-label tracking-wider mb-3 ${transferFeedback.startsWith('ERRO') ? 'text-red-400' : 'text-emerald-400'}`}>
                {transferFeedback}
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setTransferModal(null)}
                className="px-4 py-2 text-xs font-label text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 transition-colors"
              >
                CANCELAR
              </button>
              <button
                onClick={executeTransfer}
                disabled={!transferTargetUid || transferLoading}
                className="px-4 py-2 text-xs font-label bg-purple-700 text-white font-bold tracking-wider hover:brightness-110 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {transferLoading ? 'TRANSFERINDO...' : 'EXECUTAR_TRANSFER'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface-container-lowest border border-zinc-800 p-3 flex flex-col justify-center">
      <span className="font-label text-[9px] uppercase tracking-widest text-zinc-500 mb-1">{label}</span>
      <span className="font-headline font-bold text-sm text-zinc-200">{value}</span>
    </div>
  );
}

function formatSecs(secs: number) {
  if (!secs) return '0s';
  if (secs < 60) return `${Math.floor(secs)}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${(mins / 60).toFixed(1)}h`;
}

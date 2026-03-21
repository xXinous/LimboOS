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
} from "firebase/firestore";
import { format } from "date-fns";

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

export default function UserRegistry({ isAdmin }: { isAdmin: boolean }) {
  const [users, setUsers] = useState<UserData[]>([]);
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
      alert("Failed to create backup.");
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
      alert("Failed to update user.");
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

  const handleAddTape = async (uid: string) => {
    const tapeId = prompt("ID da tape para adicionar:");
    if (!tapeId) return;
    try {
      await setDoc(doc(db, "users", uid, "tapes", tapeId.trim()), {
        tapeId: tapeId.trim(),
        unlockedAt: serverTimestamp(),
      });
      loadUserTapes(uid);
    } catch (error) {
      console.error("Error adding tape:", error);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <section className="bg-surface border border-zinc-800 relative">
      <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900/30">
        <div className="flex items-center gap-4">
          <div className="w-2 h-6 bg-orange-600"></div>
          <h2 className="font-headline font-bold uppercase tracking-widest text-lg">
            User_Base_Registry
          </h2>
          <span className="text-[10px] font-label text-zinc-500 tracking-wider">{users.length} REGISTERED</span>
        </div>
        <div className="flex gap-2">
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
                            onClick={() => handleAddTape(user.uid)}
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
                              return (
                                <div
                                  key={tape.tapeId}
                                  className="bg-surface-container-lowest border border-zinc-800 p-3 flex items-center justify-between"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="font-headline text-xs font-bold text-zinc-200 truncate">
                                      {tape.tapeId}
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

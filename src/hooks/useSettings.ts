import { useState, useCallback, useEffect, useRef } from 'react';
import type { User } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Settings, Memory, McpServer } from '../types';

const MAX_MEMORIES = 20;
const MAX_MEMORY_LENGTH = 500;
// Kept small: every configured server is contacted again on every chat turn
// (api/chat.js has no way to cache discovery across requests), so this also
// bounds how much per-turn latency a user's own settings can add.
const MAX_MCP_SERVERS = 5;

const userDoc = (uid: string) => doc(db, 'users', uid);
const makeId = () => crypto.randomUUID();

const DEFAULT_SETTINGS: Settings = { defaultMode: 'standard', temperature: 0.7, memoryEnabled: true };

// Firestore arrays are always overwritten wholesale, never merged element by
// element (true for both setDoc-merge and updateDoc) -- every mutation here
// computes the full next array client-side and writes that, rather than
// relying on any partial-update behaviour.
export const useSettings = (user: User | null) => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  // Synced in an effect, not assigned directly during render, so callbacks
  // below can stay referentially stable ([] deps) while still reading the
  // latest value -- matches the pattern useChat.ts uses for the same reason.
  const userRef = useRef(user);
  const memoriesRef = useRef(memories);
  const mcpServersRef = useRef(mcpServers);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { memoriesRef.current = memories; }, [memories]);
  useEffect(() => { mcpServersRef.current = mcpServers; }, [mcpServers]);

  // "Adjusting state when a prop changes" (react.dev) rather than an effect:
  // switching account (or logging out to guest) must drop the previous
  // account's settings/memories immediately, not one paint later, otherwise
  // the next guest briefly sees the previous user's data.
  const [trackedUid, setTrackedUid] = useState<string | null>(user?.uid ?? null);
  if ((user?.uid ?? null) !== trackedUid) {
    setTrackedUid(user?.uid ?? null);
    setSettings(DEFAULT_SETTINGS);
    setMemories([]);
    setMcpServers([]);
  }

  useEffect(() => {
    if (!user) return;
    return onSnapshot(userDoc(user.uid), snapshot => {
      const data = snapshot.data();
      setSettings({ ...DEFAULT_SETTINGS, ...(data?.settings as Partial<Settings> | undefined) });
      setMemories((data?.memories as Memory[] | undefined) ?? []);
      setMcpServers((data?.mcpServers as McpServer[] | undefined) ?? []);
    });
  }, [user]);

  // Applies locally even without an account -- guest mode just never
  // persists it, same as guest chats never persisting (see Sidebar).
  const updateSettings = useCallback((partial: Partial<Settings>) => {
    const uid = userRef.current?.uid;
    setSettings(previous => {
      const next = { ...previous, ...partial };
      if (uid) void setDoc(userDoc(uid), { settings: next }, { merge: true });
      return next;
    });
  }, []);

  const addMemory = useCallback((text: string) => {
    const uid = userRef.current?.uid;
    if (!uid) return false;
    const trimmed = text.trim().slice(0, MAX_MEMORY_LENGTH);
    if (!trimmed) return false;
    const next = [...memoriesRef.current, { id: makeId(), text: trimmed, createdAt: Date.now() }].slice(-MAX_MEMORIES);
    setMemories(next);
    void setDoc(userDoc(uid), { memories: next }, { merge: true });
    return true;
  }, []);

  const deleteMemory = useCallback((id: string) => {
    const uid = userRef.current?.uid;
    if (!uid) return;
    const next = memoriesRef.current.filter(memory => memory.id !== id);
    setMemories(next);
    void setDoc(userDoc(uid), { memories: next }, { merge: true });
  }, []);

  const addMcpServer = useCallback((name: string, url: string) => {
    const uid = userRef.current?.uid;
    if (!uid || mcpServersRef.current.length >= MAX_MCP_SERVERS) return false;
    const trimmedUrl = url.trim();
    if (!/^https?:\/\//i.test(trimmedUrl)) return false;
    const next = [...mcpServersRef.current, { id: makeId(), name: name.trim().slice(0, 100) || trimmedUrl, url: trimmedUrl.slice(0, 500) }];
    setMcpServers(next);
    void setDoc(userDoc(uid), { mcpServers: next }, { merge: true });
    return true;
  }, []);

  const deleteMcpServer = useCallback((id: string) => {
    const uid = userRef.current?.uid;
    if (!uid) return;
    const next = mcpServersRef.current.filter(server => server.id !== id);
    setMcpServers(next);
    void setDoc(userDoc(uid), { mcpServers: next }, { merge: true });
  }, []);

  return { settings, memories, mcpServers, updateSettings, addMemory, deleteMemory, addMcpServer, deleteMcpServer, maxMemories: MAX_MEMORIES, maxMcpServers: MAX_MCP_SERVERS };
};

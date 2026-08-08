import { useState, useCallback, useRef } from 'react';
import type { User } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, setDoc, doc, serverTimestamp, getDocs, deleteDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { LogMessage, Chat, Attachment, SearchSource, GeneratedFile } from '../types';

const MAX_HISTORY = 30;
const userDoc = (uid: string) => doc(db, 'users', uid);
const chatsCol = (uid: string) => collection(db, 'users', uid, 'chats');
const chatDoc = (uid: string, chatId: string) => doc(db, 'users', uid, 'chats', chatId);
const messagesCol = (uid: string, chatId: string) => collection(db, 'users', uid, 'chats', chatId, 'messages');

const makeId = () => crypto.randomUUID();
const makeTimestamp = () => new Date().toLocaleTimeString('pt-PT', { hour12: false });
const makeMessage = (source: LogMessage['source'], text: string): LogMessage => ({ id: makeId(), source, text, timestamp: makeTimestamp() });
const normaliseMessage = (data: Record<string, unknown>): LogMessage => ({
  id: (data.id as string) ?? makeId(),
  source: data.source === 'HELIOS' || data.source === 'VIMO' ? 'VUXIO' : (data.source as LogMessage['source']) ?? 'ERROR',
  text: (data.text as string) ?? '',
  timestamp: (data.timestamp as string) ?? '',
  sources: data.sources as SearchSource[] | undefined,
  file: data.file as GeneratedFile | undefined,
});

// Triggers a real browser download via a throwaway object URL -- revoked
// right after the click, since the anchor never needs it again once the
// download has started.
export function downloadFile(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function streamReply(
  payload: Record<string, unknown>,
  onChunk: (text: string) => void,
  onSources: (sources: SearchSource[]) => void,
  onFile: (file: GeneratedFile) => void,
): Promise<{ text: string; sources?: SearchSource[]; file?: GeneratedFile }> {
  const response = await fetch('/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  if (!response.ok || !response.body) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || 'Não foi possível contactar o VUXIO.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let sources: SearchSource[] | undefined;
  let file: GeneratedFile | undefined;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const event of events) {
      const type = event.match(/^event: (.+)$/m)?.[1];
      const raw = event.match(/^data: (.+)$/m)?.[1];
      if (!type || raw === undefined) continue;
      const data = JSON.parse(raw);
      if (type === 'chunk') { full += data as string; onChunk(full); }
      if (type === 'sources') { sources = data as SearchSource[]; onSources(sources); }
      if (type === 'file') { file = data as GeneratedFile; onFile(file); }
      if (type === 'error') throw new Error(data as string);
    }
  }
  return { text: full, sources, file };
}

export const useChat = (user: User | null, onReply: (text: string) => void, codeMode = false, webMode = false) => {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [chatList, setChatList] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const userRef = useRef(user);
  const logsRef = useRef(logs);
  const chatIdRef = useRef(currentChatId);
  const codeModeRef = useRef(codeMode);
  const webModeRef = useRef(webMode);
  userRef.current = user;
  logsRef.current = logs;
  chatIdRef.current = currentChatId;
  codeModeRef.current = codeMode;
  webModeRef.current = webMode;

  const subscribeToChats = useCallback((uid: string) => {
    void setDoc(userDoc(uid), { email: userRef.current?.email ?? '', displayName: userRef.current?.displayName ?? '', lastSeen: serverTimestamp() }, { merge: true });
    return onSnapshot(query(chatsCol(uid), orderBy('updatedAt', 'desc')), snapshot => {
      setChatList(snapshot.docs.map(item => ({ id: item.id, title: (item.data().title as string) ?? 'Sem título', isCodeMode: (item.data().isCodeMode as boolean) ?? false })));
    });
  }, []);

  const loadChat = useCallback(async (chatId: string) => {
    const uid = userRef.current?.uid;
    if (!uid) return;
    setLogs([]);
    setCurrentChatId(chatId);
    const snapshot = await getDocs(query(messagesCol(uid, chatId), orderBy('createdAt', 'asc')));
    setLogs(snapshot.docs.map(item => normaliseMessage(item.data() as Record<string, unknown>)));
  }, []);

  const newChat = useCallback(() => { setCurrentChatId(null); setLogs([]); }, []);

  const deleteChat = useCallback(async (chatId: string) => {
    const uid = userRef.current?.uid;
    if (!uid) return;
    const messages = await getDocs(messagesCol(uid, chatId));
    await Promise.all(messages.docs.map(message => deleteDoc(message.ref)));
    await deleteDoc(chatDoc(uid, chatId));
    if (chatIdRef.current === chatId) newChat();
  }, [newChat]);

  const persist = useCallback(async (userMessage: LogMessage, reply: LogMessage, isCodeMode: boolean) => {
    const uid = userRef.current?.uid;
    if (!uid) return;
    let chatId = chatIdRef.current;
    if (!chatId) {
      const reference = await addDoc(chatsCol(uid), { title: userMessage.text.slice(0, 45) || 'Nova conversa', isCodeMode, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      chatId = reference.id;
      setCurrentChatId(chatId);
    } else {
      await updateDoc(chatDoc(uid, chatId), { updatedAt: serverTimestamp() });
    }
    await Promise.all([
      addDoc(messagesCol(uid, chatId), { ...userMessage, createdAt: serverTimestamp() }),
      addDoc(messagesCol(uid, chatId), { ...reply, createdAt: serverTimestamp() }),
    ]);
  }, []);

  const requestReply = useCallback(async (history: LogMessage[], userMessage: LogMessage, attachment: Attachment | null, userName: string, replaceId: string) => {
    const mode = codeModeRef.current ? 'code' : 'standard';
    if (webModeRef.current) setIsSearching(true);
    try {
      return await streamReply({
        mode, webMode: webModeRef.current, userName,
        messages: [...history.slice(-MAX_HISTORY), userMessage].filter(message => message.source !== 'SYSTEM' && message.source !== 'ERROR').map(message => ({ role: message.source === 'VUXIO' ? 'assistant' : 'user', content: message.text })),
        attachment: attachment ? { base64: attachment.base64, mimeType: attachment.file.type, name: attachment.file.name } : undefined,
      }, partial => {
        setIsSearching(false);
        setIsStreaming(true);
        setLogs(previous => previous.map(message => message.id === replaceId ? { ...message, text: partial } : message));
      }, sources => setLogs(previous => previous.map(message => message.id === replaceId ? { ...message, sources } : message)),
      file => setLogs(previous => previous.map(message => message.id === replaceId ? { ...message, file } : message)));
    } finally {
      setIsSearching(false);
    }
  }, []);

  const sendMessage = useCallback(async (text: string, attachment: Attachment | null, userName: string) => {
    if (isLoading) return;
    const history = logsRef.current;
    const userMessage = makeMessage('USER', text || `📎 ${attachment?.file.name}`);
    const placeholder: LogMessage = { id: makeId(), source: 'VUXIO', text: '', timestamp: makeTimestamp() };
    setLogs([...history, userMessage, placeholder]);
    setIsLoading(true);
    try {
      const response = await requestReply(history, userMessage, attachment, userName, placeholder.id);
      const reply = { ...placeholder, text: response.text, ...(response.sources ? { sources: response.sources } : {}), ...(response.file ? { file: response.file } : {}) };
      await persist(userMessage, reply, codeModeRef.current);
      onReply(response.text);
    } catch (error) {
      setLogs(previous => previous.map(message => message.id === placeholder.id ? { ...message, source: 'ERROR', text: error instanceof Error ? error.message : 'Ocorreu um erro inesperado.' } : message));
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, [isLoading, onReply, persist, requestReply]);

  const regenerate = useCallback(async (userName: string) => {
    if (isLoading) return;
    const current = logsRef.current;
    const index = current.map(message => message.source).lastIndexOf('USER');
    if (index < 0) return;
    const userMessage = current[index];
    const previousReply = current[index + 1]?.source === 'VUXIO' ? current[index + 1] : null;
    const history = current.slice(0, index);
    const placeholder: LogMessage = { id: makeId(), source: 'VUXIO', text: '', timestamp: makeTimestamp() };
    setLogs([...current.slice(0, index + 1), placeholder]);
    setIsLoading(true);
    setIsStreaming(true);
    try {
      const response = await requestReply(history, userMessage, null, userName, placeholder.id);
      const reply = { ...placeholder, text: response.text, ...(response.sources ? { sources: response.sources } : {}), ...(response.file ? { file: response.file } : {}) };
      const uid = userRef.current?.uid;
      const chatId = chatIdRef.current;
      if (uid && chatId) {
        const previousReplies = previousReply
          ? await getDocs(query(messagesCol(uid, chatId), where('id', '==', previousReply.id)))
          : null;
        await Promise.all([
          ...(previousReplies?.docs.map(message => deleteDoc(message.ref)) ?? []),
          addDoc(messagesCol(uid, chatId), { ...reply, createdAt: serverTimestamp() }),
          updateDoc(chatDoc(uid, chatId), { updatedAt: serverTimestamp() }),
        ]);
      }
      onReply(response.text);
    } catch (error) {
      setLogs(current);
      console.error('[VUXIO regenerate]', error);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, [isLoading, onReply, requestReply]);

  return { logs, chatList, currentChatId, isLoading, isStreaming, isSearching, sendMessage, regenerate, newChat, loadChat, deleteChat, subscribeToChats };
};

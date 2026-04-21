import { useState, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp, getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { LogMessage, Chat, Attachment } from '../types';

const TEXT_MODEL = 'llama-3.3-70b-versatile';
const VISION_MODEL = 'llama-3.2-11b-vision-preview';
const GROQ_API_KEY = (import.meta as any).env.VITE_GROQ_API_KEY;

export const useChat = (user: User | null, onReply: (text: string) => void) => {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [chatList, setChatList] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const makeId = () => Math.random().toString(36).substring(2, 9);
  const makeTimestamp = () =>
    new Date().toLocaleTimeString('pt-PT', { hour12: false });

  const addLog = useCallback((source: LogMessage['source'], text: string) => {
    const msg: LogMessage = { id: makeId(), source, text, timestamp: makeTimestamp() };
    setLogs(prev => [...prev, msg]);
    return msg;
  }, []);

  // Carregar lista de chats (só para utilizadores autenticados)
  const subscribeToChats = useCallback((userId: string) => {
    const q = query(
      collection(db, 'chats'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );
    return onSnapshot(q, snapshot => {
      setChatList(snapshot.docs.map(d => ({ id: d.id, title: d.data().title })));
    });
  }, []);

  const loadChat = useCallback(async (id: string) => {
    setCurrentChatId(id);
    const chatDoc = await getDoc(doc(db, 'chats', id));
    if (chatDoc.exists()) {
      setLogs(chatDoc.data().messages || []);
      addLog('SYSTEM', 'Histórico carregado.');
    }
  }, [addLog]);

  const newChat = useCallback(() => {
    setCurrentChatId(null);
    setLogs([]);
  }, []);

  const sendMessage = useCallback(async (
    text: string,
    attachment: Attachment | null,
    userName: string
  ) => {
    if (isLoading) return;

    const userMsg: LogMessage = {
      id: makeId(),
      source: 'USER',
      text: text || `📎 ${attachment?.file.name}`,
      timestamp: makeTimestamp(),
    };

    const currentLogs = [...logs, userMsg];
    setLogs(currentLogs);
    setIsLoading(true);

    try {
      // Construir histórico para a API
      const apiMessages: any[] = [
        {
          role: 'system',
          content: `Tu és o Vimo AI, uma Inteligência Artificial avançada e elegante criada pelo Simão. Estás a falar com ${userName}. Responde sempre em Português de Portugal (PT-PT), com um tom profissional mas acessível. Quando apresentares código, usa blocos de código com a linguagem indicada.`,
        },
      ];

      // Histórico anterior (apenas texto)
      logs.forEach(l => {
        if (l.source === 'USER') apiMessages.push({ role: 'user', content: l.text });
        if (l.source === 'HELIOS') apiMessages.push({ role: 'assistant', content: l.text });
      });

      // Nova mensagem
      if (attachment) {
        apiMessages.push({
          role: 'user',
          content: [
            { type: 'text', text: text || 'Analisa este ficheiro detalhadamente.' },
            { type: 'image_url', image_url: { url: `data:${attachment.file.type};base64,${attachment.base64}` } },
          ],
        });
      } else {
        apiMessages.push({ role: 'user', content: text });
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: attachment ? VISION_MODEL : TEXT_MODEL,
          messages: apiMessages,
          temperature: 0.7,
        }),
      });

      if (!response.ok) throw new Error(`Groq API: ${response.statusText}`);

      const data = await response.json();
      const replyText = data.choices[0]?.message?.content || 'Sem resposta.';

      const vimoMsg: LogMessage = {
        id: makeId(),
        source: 'HELIOS',
        text: replyText,
        timestamp: makeTimestamp(),
      };

      const updatedLogs = [...currentLogs, vimoMsg];
      setLogs(updatedLogs);
      onReply(replyText);

      // Guardar no Firebase (só para utilizadores autenticados)
      if (user) {
        if (!currentChatId) {
          const docRef = await addDoc(collection(db, 'chats'), {
            userId: user.uid,
            title: text.substring(0, 35) || 'Nova Conversa',
            updatedAt: serverTimestamp(),
            messages: updatedLogs,
          });
          setCurrentChatId(docRef.id);
        } else {
          await updateDoc(doc(db, 'chats', currentChatId), {
            updatedAt: serverTimestamp(),
            messages: updatedLogs,
          });
        }
      }
    } catch (e: any) {
      console.error(e);
      addLog('ERROR', 'Falha na comunicação com o servidor. Tenta novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [logs, isLoading, currentChatId, user, onReply, addLog]);

  return {
    logs, chatList, currentChatId, isLoading,
    addLog, sendMessage, newChat, loadChat, subscribeToChats,
  };
};

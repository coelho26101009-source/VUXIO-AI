import { useState, useCallback, useRef } from 'react';
import type { User } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { Project } from '../types';

// Sibling collection to users/{uid}/chats -- same shape of concern (a named,
// timestamped, per-user list), no relation to chats wired up yet. A chat
// does not currently carry a projectId; this hook only owns the project
// list itself; associating chats with a project is a separate change.
const projectsCol = (uid: string) => collection(db, 'users', uid, 'projects');

export const useProjects = (user: User | null) => {
  const [projectList, setProjectList] = useState<Project[]>([]);
  const userRef = useRef(user);
  userRef.current = user;

  const subscribeToProjects = useCallback((uid: string) => {
    return onSnapshot(query(projectsCol(uid), orderBy('updatedAt', 'desc')), snapshot => {
      setProjectList(snapshot.docs.map(item => {
        const data = item.data();
        return {
          id: item.id,
          name: (data.name as string) ?? '',
          description: (data.description as string) ?? '',
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : undefined,
        };
      }));
    });
  }, []);

  const createProject = useCallback(async (name: string, description: string) => {
    const uid = userRef.current?.uid;
    if (!uid || !name.trim()) return;
    await addDoc(projectsCol(uid), { name: name.trim(), description: description.trim(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    const uid = userRef.current?.uid;
    if (!uid) return;
    await deleteDoc(doc(db, 'users', uid, 'projects', id));
  }, []);

  return { projectList, subscribeToProjects, createProject, deleteProject };
};

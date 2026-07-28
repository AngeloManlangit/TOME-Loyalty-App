import { getApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';


let firestore: Firestore | null = null;

export function db(): Firestore {
  if (firestore) return firestore;

  try {
    getApp(); // throws when no DEFAULT app is registered
  } catch {
    initializeApp();
  }

  firestore = getFirestore();
  return firestore;
}

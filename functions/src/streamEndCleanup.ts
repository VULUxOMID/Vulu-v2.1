/**
 * Stream End Cleanup Cloud Function
 * Ends a stream and clears participants' activeStream records server-side.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const endStreamAndCleanup = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { streamId } = data || {};
    if (!streamId || typeof streamId !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'streamId is required');
    }

    // Fetch stream
    const streamRef = db.collection('streams').doc(streamId);
    const streamSnap = await streamRef.get();
    if (!streamSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Stream not found');
    }

    const streamData = streamSnap.data() as any;

    // Authorization: only host can end/cleanup
    if (streamData.hostId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Only host can end the stream');
    }

    const participants: Array<{ id: string }> = Array.isArray(streamData.participants)
      ? streamData.participants
      : [];

    // Perform cleanup in a batch
    const batch = db.batch();

    // Mark stream as ended
    batch.update(streamRef, {
      isActive: false,
      endedAt: admin.firestore.FieldValue.serverTimestamp(),
      endReason: 'host_end',
      participants: [],
      viewerCount: 0,
      lastActivity: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Clear each participant's activeStream/current
    for (const p of participants) {
      if (!p?.id) continue;
      const activeRef = db.collection('users').doc(p.id).collection('activeStream').doc('current');
      batch.delete(activeRef);
    }

    await batch.commit();

    return { ok: true, cleared: participants.length };
  } catch (error: any) {
    console.error('endStreamAndCleanup error:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error?.message || 'Unknown error');
  }
});


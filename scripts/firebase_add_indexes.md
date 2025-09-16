# Firestore Indexes to add

Add the following composite indexes to support DM read receipt and message list queries without runtime prompts:

1) Conversation messages (read receipt updates)
- Scope: Collection group on conversations/{conversationId}/messages
- Fields:
  - recipientId ASCENDING (query equality)
  - status ASCENDING (query IN on ['sent', 'delivered'])
  - __name__ ASCENDING (tie-breaker)

2) Conversation messages (list, optimized)
- Scope: Collection group on conversations/{conversationId}/messages
- Fields:
  - isDeleted ASCENDING (query equality)
  - timestamp DESCENDING

Note: You can create these in the Firebase Console or by using Firebase CLI. If you want, I can add them to firestore.indexes.json once we confirm the exact field names used in queries across the app.


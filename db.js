import Dexie from 'dexie';

export const db = new Dexie('SalesMeetingDB');
db.version(1).stores({
  meetings: '++id, staffName, month, meetingDate, createdAt, updatedAt',
});

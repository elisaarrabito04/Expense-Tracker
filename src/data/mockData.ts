import type { AppUser, Tag, Transaction } from '../types' // TypeScript risolve automaticamente la cartella tramite index.ts

// USERS

export const currentUserMock: AppUser = {
  id: 'BbX2cgChEterh3JSbiaUtqhG7aN2',
  displayName: 'Alice',
  email: 'alice@gmail.com',
}

export const usersMock: AppUser[] = [
  currentUserMock,
  {
    id: 'u2',
    displayName: 'Marco',
    email: 'marco@example.com',
  },
  {
    id: 'u3',
    displayName: 'Giulia',
    email: 'giulia@example.com',
  },
  {
    id: 'u4',
    displayName: 'Luca',
    email: 'luca@example.com',
  },
]



// ------------------------------------------
// TAG

export const tagsMock: Tag[] = [
  {
    id: 't1',
    label: 'Casa',
    canonicalLabel: 'casa',
  },
  {
    id: 't2',
    label: 'Spesa settimanale',
    canonicalLabel: 'spesa-settimanale',
  },
  {
    id: 't3',
    label: 'Londra2024',
    canonicalLabel: 'londra2024',
  },
  {
    id: 't4',
    label: 'Cena',
    canonicalLabel: 'cena',
  },
]


// ------------------------------------------
// TRANSACTIONS

export const transactionsMock: Transaction[] = [
  {
    id: 'tr1',
    type: 'expense',
    description: 'Spesa supermercato',
    amount: 48,
    date: '2026-05-20',
    createdByUserId: 'BbX2cgChEterh3JSbiaUtqhG7aN2',
    payerId: 'BbX2cgChEterh3JSbiaUtqhG7aN2',
    splitType: 'equal',
    participantIds: ['BbX2cgChEterh3JSbiaUtqhG7aN2', 'u2'],
    tags: [tagsMock[0]],
    shares: [
      { userId: 'BbX2cgChEterh3JSbiaUtqhG7aN2', amount: 24 },
      { userId: 'u2', amount: 24 }, // marco
    ],
    note: 'Spesa condivisa per la casa',
  },
  {
    id: 'tr2',
    type: 'expense',
    description: 'Cena pizzeria',
    amount: 75,
    date: '2026-05-18',
    createdByUserId: 'u3', // giulia
    payerId: 'u3',
    splitType: 'equal',
    participantIds: ['BbX2cgChEterh3JSbiaUtqhG7aN2', 'u3', 'u4'],
    tags: [tagsMock[3]],
    shares: [
      { userId: 'BbX2cgChEterh3JSbiaUtqhG7aN2', amount: 25 },
      { userId: 'u3', amount: 25 },
      { userId: 'u4', amount: 25 }, // luca
    ],
    note: 'Cena del venerdì sera',
  },
  {
    id: 'tr3',
    type: 'expense',
    description: 'Biglietti metro',
    amount: 36,
    date: '2026-05-15',
    createdByUserId: 'BbX2cgChEterh3JSbiaUtqhG7aN2',
    payerId: 'BbX2cgChEterh3JSbiaUtqhG7aN2',
    splitType: 'equal',
    participantIds: ['BbX2cgChEterh3JSbiaUtqhG7aN2', 'u2', 'u3'],
    tags: [tagsMock[2]],
    shares: [
      { userId: 'BbX2cgChEterh3JSbiaUtqhG7aN2', amount: 12 },
      { userId: 'u2', amount: 12 },
      { userId: 'u3', amount: 12 },
    ],
  },


  // transazione SENZA Alice
  {
    id: 'tr4',
    type: 'expense',
    description: 'Spesa SENZA ALICE',
    amount: 48,
    date: '2026-05-20',
    createdByUserId: 'u2', // marco
    payerId: 'u2',
    splitType: 'equal',
    participantIds: ['u2', 'u3'],
    tags: [tagsMock[1]],
    shares: [
      { userId: 'u2', amount: 24 },
      { userId: 'u3', amount: 24 }, // giulia
    ],
  },


  {
    id: 'tr5',
    type: 'expense',
    description: 'Spesa',
    amount: 34,
    date: '2026-05-18',
    createdByUserId: 'u3', // giulia
    payerId: 'u3',
    splitType: 'equal',
    participantIds: ['BbX2cgChEterh3JSbiaUtqhG7aN2', 'u3'],
    tags: [tagsMock[3]],
    shares: [
      { userId: 'BbX2cgChEterh3JSbiaUtqhG7aN2', amount: 17 },
      { userId: 'u3', amount: 17 },
    ],
  },


  // rimborso
  {
    id: 'tr6',
    type: 'settlement',
    description: 'Saldo cena pizzeria',
    amount: 25,
    date: '2026-05-19',
    createdByUserId: 'BbX2cgChEterh3JSbiaUtqhG7aN2',
    fromUserId: 'BbX2cgChEterh3JSbiaUtqhG7aN2',
    toUserId: 'u3',
    participantIds: ['BbX2cgChEterh3JSbiaUtqhG7aN2', 'u3'],
    note: 'Rimborso della mia quota della cena',
  },
]
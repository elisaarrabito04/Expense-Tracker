import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { subscribeToTransactionsForUser } from '../services/transactionsService';
import { getAllInvolvedTagIds, getAllInvolvedUserIds } from '../utils/transactions';
import { getTagsByIds } from '../services/tagsService';
import { getUsersByIds } from '../services/usersService';
import type { Transaction, Tag, AppUser } from '../types/types';


// 1. Definiamo la "forma" dei dati che il nostro Context fornirà.
// Qualsiasi componente che userà questo context, riceverà un oggetto con queste proprietà.
type TransactionContextType = {
    userTransactions: Transaction[];
    knownTags: Tag[];
    knownParticipants: AppUser[];
    isLoading: boolean;
    error: string | null;
}


const TransactionsContext = createContext<TransactionContextType | null>(null);

// Componente che contiene tutta la logica
export function TransactionProvider({ children }: { children: React.ReactNode }) {
    const {currentUser} = useAuth(); 

    // stati per conservare i dati
    const [userTransactions, setTransactions] = useState<Transaction[]>([]);
    const [knownTags, setKnownTags] = useState<Tag[]>([]);
    const [knownParticipants, setKnownParticipants] = useState<AppUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect( () => {
       // Se non c'è un utente loggato, resettiamo tutto e interrompiamo.
        if (!currentUser) {
            setTransactions([]);
            setKnownTags([]);
            setKnownParticipants([]);
            setIsLoading(false);
            return;
        } 
        // avvio caricamento dati
        setIsLoading(true);

        // UNICO LISTENER GLOBALE!
        const unsubscribe = subscribeToTransactionsForUser(
            currentUser.id,
            // funzione chiamata una volta ottenute le transazioni
            async (fetchedTransactions) => {
                setTransactions(fetchedTransactions);
                
                try {
                    const tagIds = getAllInvolvedTagIds(fetchedTransactions); // senza filtrare per quelle active
                    const userIds = getAllInvolvedUserIds(fetchedTransactions); // senza filtrare per quelle active

                    const [tags, participants] = await Promise.all([
                        getTagsByIds(tagIds),
                        getUsersByIds(userIds.filter(id => id !== currentUser.id))
                    ]);

                    setKnownTags(tags);
                    setKnownParticipants(participants);
                } catch (err) {
                    console.error("Errore nel recupero dati derivati", err);
                    setError("Errore nel caricamento dei dati collegati");
                } finally {
                    setIsLoading(false);
                }
            },
            /*
            (err) => {
                setError("Errore Firestore");
                setIsLoading(false);
            }
            */
        );


        // cleanup dello useeffect
        return () => unsubscribe();
    }, [currentUser]);


    return (
        <TransactionsContext.Provider value={{ userTransactions, knownTags, knownParticipants, isLoading, error }}>
        {children}
        </TransactionsContext.Provider>
    );
}


// custom hook per comodità
export function useTransactions() {
  const context = useContext(TransactionsContext);
  if (!context) throw new Error("useTransactions deve essere usato dentro un TransactionsProvider");
  return context;
}

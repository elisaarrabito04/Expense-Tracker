import { useState, useMemo, useRef } from 'react'
import type { AppUser } from '../../types/types'
import { searchUsers } from '../../services/usersService'
import { useClickOutside } from '../../hooks/useClickOutside'
import { useNetworkStatus } from '../../hooks/useNetworkStatus'
import './Selector.css' // Riutilizziamo lo stesso CSS per sfruttare la tendina e il bottom sheet!

type ParticipantSelectorProps = {
  knownParticipants: AppUser[]
  selectedParticipants: AppUser[]
  onToggleParticipant: (user: AppUser) => void
  currentAppUser: AppUser
}

export default function ParticipantSelector({
  knownParticipants,
  selectedParticipants,
  onToggleParticipant,
  currentAppUser,
}: ParticipantSelectorProps) {
  // --- STATI RICERCA LOCALE ---
  const [localQuery, setLocalQuery] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // --- STATI RICERCA GLOBALE ---
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false)
  const [globalQuery, setGlobalQuery] = useState('')
  const [globalResults, setGlobalResults] = useState<AppUser[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // --- STATO RETE ---
  const isOnline = useNetworkStatus()
  const isOffline = !isOnline

  // Chiusura tendina locale su click esterno
  const containerRef = useRef<HTMLDivElement | null>(null)
  useClickOutside(containerRef, () => setIsDropdownOpen(false), isDropdownOpen)

  // 1) Assicuriamoci che l'utente corrente sia SEMPRE tra i "conosciuti" per permettergli di includersi/escludersi
  const allKnown = useMemo(() => {
    const list = [...knownParticipants]
    if (!list.some((u) => u.id === currentAppUser.id)) {
      list.unshift(currentAppUser)
    }
    return list
  }, [knownParticipants, currentAppUser])

  // 2) Filtro sui partecipanti locali
  const filteredKnown = useMemo(() => {
    const normalized = localQuery.trim().toLowerCase()
    if (!normalized) return allKnown
    return allKnown.filter(
      (u) =>
        u.displayNameLowercase?.includes(normalized) ||
        u.displayName.toLowerCase().includes(normalized)
    )
  }, [allKnown, localQuery])

  // 3) Ricerca Globale PWA (Bottom Sheet)
  const handleGlobalSearch = async () => {
    if (globalQuery.trim() === '') {
      setGlobalResults([])
      setHasSearched(false)
      return
    }

    setIsSearching(true)
    setHasSearched(false)
    try {
      // Cerchiamo globalmente senza escludere nessuno
      const results = await searchUsers({ queryText: globalQuery })
      setGlobalResults(results)
    } catch (error) {
      console.error('Errore nella ricerca globale degli utenti:', error)
    } finally {
      setIsSearching(false)
      setHasSearched(true)
    }
  }

  // Helper per controllare rapidamente se un utente è già selezionato
  const isSelected = (userId: string) => selectedParticipants.some((p) => p.id === userId)

  return (
    <div className="form-group tag-selector-group" ref={containerRef}>
      <label>Partecipanti</label>

      {/* LISTA DEI SELEZIONATI (CHIPS / PILLS) */}
      {selectedParticipants.length > 0 && (
        <div className="transaction-pill-grid participant-list-container">
          {selectedParticipants.map((user) => (
            <button
              key={user.id}
              type="button"
              className="participant-pill participant-pill--selected"
              onClick={() => onToggleParticipant(user)}
              aria-label={`Rimuovi ${user.displayName}`}
            >
              <span className="participant-pill__avatar">
                {user.displayName.slice(0, 1).toUpperCase()}
              </span>
              <span className="participant-pill__text">
                  {user.id === currentAppUser.id ? `${user.displayName} (Tu)` : `${user.displayName} ${user.nickname ? `(@${user.nickname})` : ''}`} 
              </span>
              {!allKnown.some(k => k.id === user.id) && user.id !== currentAppUser.id && (
                <span style={{ fontSize: '0.7em', backgroundColor: '#ffd43b', color: '#000', padding: '2px 6px', borderRadius: '10px', marginLeft: '4px' }}>Nuovo</span>
              )}
              <span className="participant-pill-remove">✕</span>
            </button>
          ))}
        </div>
      )}

      {/* TENDINA DI RICERCA LOCALE */}
      <div className="input-with-dropdown">
        <input
          className="local-tag-input"
          type="text"
          placeholder="Cerca tra le persone che conosci..."
          value={localQuery}
          onChange={(e) => {
            setLocalQuery(e.target.value)
            setIsDropdownOpen(true)
          }}
          onFocus={() => setIsDropdownOpen(true)}
        />

        {isDropdownOpen && (
          <div className="filter-dropdown">
            {filteredKnown.length === 0 && (
              <p className="filter-dropdown__empty">Nessuna persona trovata.</p>
            )}
            {filteredKnown.map((user) => {
              const selected = isSelected(user.id)
              return (
                <div
                  key={user.id}
                  className="filter-dropdown__item filter-dropdown__item--actionable"
                >
                  <span>
                    {user.id === currentAppUser.id ? `${user.displayName} (Tu)` : user.displayName}
                    {user.nickname && user.id !== currentAppUser.id && (
                      <span style={{ fontSize: '0.85em', color: '#868e96', marginLeft: '6px' }}>@{user.nickname}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="add-participant-btn"
                    onClick={() => onToggleParticipant(user)} // Non chiudiamo la tendina per favorire scelte multiple!
                    disabled={selected}
                  >
                    {selected ? 'Aggiunto' : 'Aggiungi'}
                  </button>
                </div>
              )
            })}
            <hr className="dropdown-divider" />
            <button
              type="button"
              className="global-search-btn"
              onClick={() => {
                setIsDropdownOpen(false)
                setGlobalQuery('')
                setGlobalResults([])
                setHasSearched(false)
                setIsBottomSheetOpen(true)
              }}
              disabled={isOffline}
            >
              {isOffline ? '❌ Ricerca globale disabilitata offline' : "🔍 Cerca altre persone nell'app..."}
            </button>
          </div>
        )}
      </div>

      {/* BOTTOM SHEET (RICERCA GLOBALE) */}
      {isBottomSheetOpen && (
        <div className="bottom-sheet-overlay">
          <div className="bottom-sheet-content">
            <div className="bottom-sheet-header">
              <h3>Cerca nuovi partecipanti</h3>
              <button type="button" className="close-btn" onClick={() => { setIsBottomSheetOpen(false); setGlobalQuery(''); setGlobalResults([]); setHasSearched(false); }}>✕ Chiudi</button>
            </div>

             {isOffline && <p style={{ color: '#d9534f', fontSize: '0.9rem', marginBottom: '10px' }}>Sei offline. Riconnettiti per cercare nuove persone.</p>}

            <div className="bottom-sheet-search-container" style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
              <input 
                type="text" 
                className="local-tag-input bottom-sheet-search-input" 
                placeholder="Digita il nickname esatto..." 
                value={globalQuery} 
                onChange={(e) => {
                  setGlobalQuery(e.target.value)
                  setHasSearched(false)
                }}
                onKeyDown={(e) => e.key === 'Enter' && !isOffline && handleGlobalSearch()}
                style={{ marginBottom: 0 }}
                disabled={isOffline}
              />
              <button 
                type="button" 
                className="submit-btn" 
                onClick={handleGlobalSearch}
                disabled={isSearching || globalQuery.trim() === '' || isOffline}
                style={{ width: 'auto', padding: '0 16px', margin: 0 }}
              >
                Cerca
              </button>
            </div>
            
            {isSearching && <p>Ricerca in corso...</p>}
            {hasSearched && globalResults.length === 0 && <p>Nessun utente trovato.</p>}

            <div className="global-results">
              {globalResults.map((user) => {
                const selected = isSelected(user.id)
                return (
                  <div key={user.id} className="filter-dropdown__item global-result-item filter-dropdown__item--actionable">
                    <span>
                      {user.id === currentAppUser.id ? `${user.displayName} (Tu)` : `${user.displayName}`}
                      {user.nickname && user.id !== currentAppUser.id && (
                        <span style={{ fontSize: '0.85em', color: '#868e96', marginLeft: '6px' }}>@{user.nickname}</span>
                      )}
                    </span>
                    <button type="button" className="add-participant-btn" onClick={() => onToggleParticipant(user)} disabled={selected}>
                      {selected ? 'Aggiunto' : 'Aggiungi'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

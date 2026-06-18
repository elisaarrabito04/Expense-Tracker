import { useState, useMemo, useRef } from 'react'
import type { AppUser } from '../../types/types'
import { searchUsers } from '../../services/usersService'
import { useClickOutside } from '../../hooks/useClickOutside'
import { useNetworkStatus } from '../../hooks/useNetworkStatus'
import './Selector.css' // Riutilizziamo lo stesso CSS

type SingleUserSelectorProps = {
  label: string
  knownUsers: AppUser[]
  selectedUser: AppUser | null
  onSelectUser: (user: AppUser | null) => void
  currentAppUser: AppUser
  excludeCurrentUser?: boolean
}

export default function SingleUserSelector({
  label,
  knownUsers,
  selectedUser,
  onSelectUser,
  currentAppUser,
  excludeCurrentUser = false,
}: SingleUserSelectorProps) {
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

  const containerRef = useRef<HTMLDivElement | null>(null)
  useClickOutside(containerRef, () => setIsDropdownOpen(false), isDropdownOpen)

  // 1) Filtro partecipanti locali: applichiamo la query ed escludiamo o meno l'utente corrente
  const filteredKnown = useMemo(() => {
    let baseList = [...knownUsers]
    
    if (excludeCurrentUser) {
      baseList = baseList.filter((u) => u.id !== currentAppUser.id)
    } else {
      // Se non escludiamo, ci assicuriamo che l'utente corrente ci sia
      if (!baseList.some((u) => u.id === currentAppUser.id)) {
        baseList.unshift(currentAppUser)
      }
    }

    const normalized = localQuery.trim().toLowerCase()
    if (!normalized) return baseList
    
    return baseList.filter((u) => u.displayName.toLowerCase().includes(normalized))
  }, [knownUsers, currentAppUser, localQuery, excludeCurrentUser])

  // 2) Ricerca Globale (Bottom Sheet)
  const handleGlobalSearch = async () => {
    if (globalQuery.trim() === '') {
      setGlobalResults([])
      setHasSearched(false)
      return
    }

    setIsSearching(true)
    setHasSearched(false)
    try {
      const excludeIds = excludeCurrentUser ? [currentAppUser.id] : []
      const results = await searchUsers({ 
        queryText: globalQuery,
        excludeIds 
      })
      setGlobalResults(results)
    } catch (error) {
      console.error('Errore nella ricerca globale degli utenti:', error)
    } finally {
      setIsSearching(false)
      setHasSearched(true)
    }
  }

  // Gestore unificato per la selezione
  const handleSelect = (user: AppUser) => {
    onSelectUser(user)
    setIsDropdownOpen(false)
    setIsBottomSheetOpen(false)
    setLocalQuery('')
    setGlobalQuery('')
    setHasSearched(false)
  }

  // Se abbiamo già selezionato un utente, mostriamo solo la pillola
  if (selectedUser) {
    return (
      <div className="form-group tag-selector-group">
        <label>{label}</label>
        <div className="selected-tag-chip">
          <span className="single-user-avatar">
            {selectedUser.displayName.slice(0, 1).toUpperCase()}
          </span>
          <span>
            {selectedUser.id === currentAppUser.id ? `${selectedUser.displayName} (Tu)` : selectedUser.displayName}
            {selectedUser.nickname && selectedUser.id !== currentAppUser.id && ` (@${selectedUser.nickname})`}
          </span>
          {!knownUsers.some(k => k.id === selectedUser.id) && selectedUser.id !== currentAppUser.id && (
            <span style={{ fontSize: '0.7em', backgroundColor: '#ffd43b', color: '#000', padding: '2px 6px', borderRadius: '10px', marginLeft: '4px' }}>Nuovo</span>
          )}
          <button type="button" onClick={() => onSelectUser(null)} aria-label="Rimuovi utente" className="remove-tag-btn single-user-remove">
            ✕
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="form-group tag-selector-group" ref={containerRef}>
      <label>{label}</label>

      <div className="input-with-dropdown">
        <input
          className="local-tag-input"
          type="text"
          placeholder="Cerca una persona..."
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
            {filteredKnown.map((user) => (
              <button
                key={user.id}
                type="button"
                className="filter-dropdown__item"
                onClick={() => handleSelect(user)}
              >
                {user.id === currentAppUser.id ? `${user.displayName} (Tu)` : user.displayName}
                {user.nickname && user.id !== currentAppUser.id && (
                  <span style={{ fontSize: '0.85em', color: '#868e96', marginLeft: '6px' }}>@{user.nickname}</span>
                )}
              </button>
            ))}
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

      {/* BOTTOM SHEET */}
      {isBottomSheetOpen && (
        <div className="bottom-sheet-overlay">
          <div className="bottom-sheet-content">
            <div className="bottom-sheet-header">
              <h3>Cerca persona</h3>
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
              {globalResults.map((user) => (
                <button key={user.id} className="filter-dropdown__item global-result-item" type="button" onClick={() => handleSelect(user)}>
                  {user.id === currentAppUser.id ? `${user.displayName} (Tu)` : `${user.displayName}`}
                  {user.nickname && user.id !== currentAppUser.id && (
                    <span style={{ fontSize: '0.85em', color: '#868e96', marginLeft: '6px' }}>@{user.nickname}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
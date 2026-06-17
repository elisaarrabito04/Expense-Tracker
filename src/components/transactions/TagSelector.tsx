import { useState, useMemo, useEffect, useRef } from 'react'
import type { Tag } from '../../types/types'
import { searchTags, getOrCreateTag } from '../../services/tagsService'
import { useClickOutside } from '../../hooks/useClickOutside'
import { useNetworkStatus } from '../../hooks/useNetworkStatus'
import './Selector.css' // css in comune con PartecipanSelector per tendina e bottomsheet

type TagSelectorProps = {
  knownTags: Tag[]
  selectedTag: Tag | null
  onSelectTag: (tag: Tag | null) => void
  currentUserId: string
}

export default function TagSelector({
  knownTags,
  selectedTag,
  onSelectTag,
  currentUserId,
}: TagSelectorProps) {
  // --- STATI PER LA RICERCA LOCALE ---
  const [localQuery, setLocalQuery] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  
  // --- STATI PER IL BOTTOM SHEET (RICERCA GLOBALE) ---
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false)
  const [globalQuery, setGlobalQuery] = useState('')
  const [globalResults, setGlobalResults] = useState<Tag[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // --- STATO RETE ---
  const isOnline = useNetworkStatus()
  const isOffline = !isOnline

  // Ref per chiudere il dropdown locale quando si clicca fuori
  const containerRef = useRef<HTMLDivElement | null>(null)
  useClickOutside(containerRef, () => setIsDropdownOpen(false), isDropdownOpen)

  // --- LOGICA LOCALE (KNOWN TAGS) ---
  const filteredKnownTags = useMemo(() => {
    const normalized = localQuery.trim().toLowerCase()
    if (!normalized) return knownTags
    return knownTags.filter(
      (tag) =>
        tag.label.toLowerCase().startsWith(normalized) ||
        tag.id.toLowerCase().startsWith(normalized)
    )
  }, [knownTags, localQuery])

  // --- LOGICA GLOBALE (BOTTOM SHEET) ---
  useEffect(() => {
    // Blocchiamo preventivamente la chiamata se l'utente è offline
    if (!isBottomSheetOpen || isOffline) return
    if (globalQuery.trim() === '') {
      setGlobalResults([])
      return
    }

    // Debounce per non bombardare Firestore ad ogni lettera digitata
    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await searchTags({ queryText: globalQuery })
        setGlobalResults(results)
      } catch (error) {
        console.error('Errore nella ricerca globale dei tag:', error)
      } finally {
        setIsSearching(false)
      }
    }, 300) // Aspetta 300ms prima di cercare

    return () => clearTimeout(timer)
  }, [globalQuery, isBottomSheetOpen, isOffline])

  // Controllo per la creazione: disabilita se la input è vuota o se l'id canonico esiste già
  // Nota: usiamo una normalizzazione locale basilare equivalente a quella del server per la comparazione veloce
  const normalizedInputForCheck = globalQuery.trim().replace(/\s+/g, ' ').toLowerCase()
  const exactMatchExists = globalResults.some((tag) => tag.id === normalizedInputForCheck)
  const canCreate = normalizedInputForCheck.length > 0 && !exactMatchExists

  const handleCreateNewTag = async () => {
    if (!canCreate) return
    setIsCreating(true)
    try {
      // getOrCreateTag salverà il tag nel DB (o in cache offline se disconnessi)
      const newTag = await getOrCreateTag({
        label: globalQuery,
        createdByUserId: currentUserId,
      })
      onSelectTag(newTag)
      setIsBottomSheetOpen(false)
      setGlobalQuery('')
    } catch (error) {
      console.error('Errore durante la creazione del tag', error)
    } finally {
      setIsCreating(false)
    }
  }

  // Se un tag è già stato selezionato, mostriamo solo la pillola/chip selezionata
  if (selectedTag) {
    return (
      <div className="form-group tag-selector-group">
        <label>Tag di contesto</label>
        <div className="selected-tag-chip">
          <span>#{selectedTag.label}</span>
          <button type="button" onClick={() => onSelectTag(null)} aria-label="Rimuovi tag" className="remove-tag-btn">
            ✕
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="form-group tag-selector-group" ref={containerRef}>
      <label htmlFor="local-tag-search">Tag di contesto</label>
      
      <div className="input-with-dropdown">
        <input
          id="local-tag-search"
          className="local-tag-input"
          type="text"
          placeholder="Cerca tra i tuoi tag..."
          value={localQuery}
          onChange={(e) => {
            setLocalQuery(e.target.value)
            setIsDropdownOpen(true)
          }}
          onFocus={() => setIsDropdownOpen(true)}
        />

        {isDropdownOpen && (
          <div className="filter-dropdown">
            {filteredKnownTags.length === 0 && <p className="filter-dropdown__empty">Nessun tag trovato.</p>}
            {filteredKnownTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="filter-dropdown__item"
                onClick={() => {
                  onSelectTag(tag)
                  setIsDropdownOpen(false)
                  setLocalQuery('')
                }}
              >
                #{tag.label}
              </button>
            ))}
            <hr className="dropdown-divider" />
            {/* Tasto per aprire il bottom sheet per la ricerca globale */}
            <button
              type="button"
              className="global-search-btn"
              onClick={() => {
                setIsDropdownOpen(false)
                setIsBottomSheetOpen(true)
              }}
              disabled={isOffline}
            >
               {isOffline ? '❌ Ricerca globale disabilitata offline' : '🔍 Cerca altri tag o creane uno nuovo...'}
            </button>
          </div>
        )}
      </div>

      {/* BOTTOM SHEET */}
      {isBottomSheetOpen && (
        <div className="bottom-sheet-overlay">
          <div className="bottom-sheet-content">
            <div className="bottom-sheet-header">
              <h3>Cerca o crea Tag</h3>
              <button type="button" className="close-btn" onClick={() => setIsBottomSheetOpen(false)}>✕ Chiudi</button>
            </div>
            
            <input 
              type="text" 
              className="local-tag-input" 
              placeholder="Digita per cercare globalmente..." 
              value={globalQuery} 
              onChange={(e) => setGlobalQuery(e.target.value)} 
              disabled={isOffline}
            />
            
            {isSearching && <p>Ricerca in corso...</p>}
            
            <div className="global-results">
              {globalResults.map((tag) => (
                <button key={tag.id} className="filter-dropdown__item global-result-item" type="button" onClick={() => { onSelectTag(tag); setIsBottomSheetOpen(false); }}>
                  #{tag.label}
                </button>
              ))}
            </div>

            {/* Mostra il pulsante di creazione SOLO se il tag non esiste ed è valido */}
            <button
              type="button"
              className="submit-btn create-tag-btn"
              onClick={handleCreateNewTag}
              disabled={!canCreate || isCreating || isOffline}
            >
              {isOffline 
                ? 'Connessione assente' 
                : isCreating 
                  ? 'Creazione...' 
                  : (canCreate ? `Crea nuovo tag "#${globalQuery.trim()}"` : 'Inserisci un tag non esistente')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
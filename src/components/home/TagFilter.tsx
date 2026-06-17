import { useMemo, useState, useEffect, useRef } from 'react'
import type { Tag } from '../../types/types'
import { useClickOutside } from '../../hooks/useClickOutside'

type TagFilterProps = {
  availableTags: Tag[] // da mostrare tra i suggerimenti
  selectedTag?: string // id del tag attualmente selezionato (es: 'all' se nessuno)
  onTagChange: (value: string) => void
  disabled: boolean
}

export default function TagFilter({
  availableTags, // da Home
  selectedTag, // da HomeFilters
  onTagChange, // da Home
  disabled, // da HomeFilters
}: TagFilterProps) {
    const [query, setQuery] = useState('') // barra di input (non per forza coincide con il valore del selectedTag)
    const [isOpen, setIsOpen] = useState(false) // per decidere se mostrare o no la tendina, all'inizio chiusa

    // Questo ref punta al contenitore completo del filtro
    const containerRef = useRef<HTMLDivElement | null>(null)

    useClickOutside(
        containerRef,
        () => {
            setIsOpen(false)
            
            // Se chiudiamo la tendina senza aver terminato un inserimento, 
            // ripristiniamo la visualizzazione del tag attualmente selezionato o svuotiamo
            if (selectedTag && selectedTag !== 'all') {
                const tag = availableTags.find(t => t.id === selectedTag)
                if (tag) setQuery(tag.label)
            } else {
                setQuery('')
            }
        },
        isOpen
    )

    // Sincronizziamo la search bar se il tag selezionato viene modificato 
    // esternamente (ad esempio, cliccando sulla "X" del chip) o rimosso con i filtri
    useEffect(() => {
        if (!selectedTag || selectedTag === 'all') {
            setQuery('')
        } else {
            const tag = availableTags.find((t) => t.id === selectedTag)
            if (tag) {
                setQuery(tag.label)
            }
        }
    }, [selectedTag, availableTags])
    

    // TENDINA FILTRATA (dipende da isOpen )
    // E' un dato DERIVATO, può essere utile memorizzarlo
    // lo ricalcoliamo a partire da availableTags e query
    const filteredTags = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase()
        if (!normalizedQuery) { // se l'utente non ha scritto nulla
            return availableTags
        }
        // se l'utente ha scritto qualcosa mostro quelli con cui c'è corrispondenza
        return availableTags.filter((tag) =>
                // per maggiore flessibilità sia label sia canonical
                tag.label.toLowerCase().startsWith(normalizedQuery) || // Cerca nella label leggibile
                tag.id.toLowerCase().startsWith(normalizedQuery) // Cerca anche nell'id (che è la forma canonica)
            )
    }, [availableTags, query])

    //----------------------------------
    // gestione selezione nel dropdown
    function handleSelectTag(tag: Tag) {
      if (disabled) {
        return
      }
      onTagChange(tag.id) // proveniente da Home, passiamo l'id (la forma canonica)
      setQuery(tag.label) // mostra l'etichetta nella search bar
      setIsOpen(false) // chiudo la tendina
    }

  

    return (
    <div className="filter-field" ref={containerRef}>
      {/* Barra di ricerca vera e propria */}
      <div className={`filter-search ${disabled ? 'filter-search--disabled' : ''}`}>
        <span className="filter-search__icon" aria-hidden="true">
          #
        </span>

        <input
          type="text"
          value={query}
          placeholder="Tags"
          onFocus={() => {
            // Quando entro nell'input, apro il dropdown
            setIsOpen(true)
          }}
          onChange={(e) => {
            // Quando digito:
            // - aggiorno la query
            // - apro il dropdown per mostrare i risultati filtrati
            setQuery(e.target.value)
            setIsOpen(true)
            
            // Se svuoto la barra di ricerca, rimuovo automaticamente il filtro
            if (e.target.value.trim() === '') {
                onTagChange('all')
            }
          }}
        />
      </div>
     

      {/* Dropdown dei risultati filtrati */}
      {isOpen && (
        <div className="filter-dropdown">
          {disabled && (
            <p className="filter-dropdown__hint">
              I tag sono disponibili solo per le spese.
            </p>
          )}
          {filteredTags.length === 0 ? (
            <p className="filter-dropdown__empty">Nessun tag trovato</p>
          ) : (
            filteredTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={`filter-dropdown__item ${
                  disabled ? 'filter-dropdown__item--disabled' : ''
                }`}
                onClick={() => handleSelectTag(tag)}
                disabled={disabled}
                aria-disabled={disabled}  
              >
                <span aria-hidden="true">#</span>
                {tag.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
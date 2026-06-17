import { useMemo, useState, useRef} from 'react'
import type { AppUser } from '../../types/types'
import { useClickOutside } from '../../hooks/useClickOutside'

type PeopleFilterProps = {
  availablePeople: AppUser[]
  selectedPersonIds: string[]
  onTogglePerson: (personId: string) => void
  onClearPeople: () => void
}

export default function PeopleFilter({
  availablePeople,
  selectedPersonIds,
  onTogglePerson,
}: PeopleFilterProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  // Ref al contenitore completo del filtro.
  // Serve all'hook per capire se il click è interno o esterno.
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Attiviamo il comportamento "click outside" solo quando il dropdown è aperto.
  useClickOutside(
    containerRef,
    () => {
      setIsOpen(false)
    },
    isOpen
  )


  const filteredPeople = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return availablePeople
    }

    return availablePeople.filter((person) =>
      person.displayName.toLowerCase().startsWith(normalizedQuery) ||
      (person.nickname && person.nickname.toLowerCase().includes(normalizedQuery))
    )
  }, [availablePeople, query])



  function handleSelectPerson(personId: string) {
    onTogglePerson(personId)
    setQuery('')
    setIsOpen(true) // dropdown ancora aperto per la selezione multipla
  }


  
  return (
    <div className="filter-field" ref={containerRef}>
      {/* Barra di ricerca per le persone */}
      <div className="filter-search">
        <span className="filter-search__icon" aria-hidden="true">
          🔍
        </span>

        <input
          type="text"
          value={query}
          placeholder="Persone"
          onFocus={() => {
            // Quando l'input riceve focus, mostriamo il dropdown
            setIsOpen(true)
          }}
          onChange={(e) => {
            // Quando l'utente digita:
            // - aggiorniamo la query
            // - apriamo il dropdown con i risultati filtrati
            setQuery(e.target.value)
            setIsOpen(true)
          }}
        />
      </div>

      {/* Chip delle persone selezionate.
          Ogni chip può essere cliccato per rimuovere quella persona dal filtro. */}
      

      {/* Dropdown dei risultati */}
      {isOpen && (
        <div className="filter-dropdown">
          {filteredPeople.length === 0 ? (
            <p className="filter-dropdown__empty">Nessuna persona trovata</p>
          ) : (
            filteredPeople.map((person) => {
              // serve sapere se questa persona è già selezionata
              // per mostrarlo visivamente nel dropdown.
              const isSelected = selectedPersonIds.includes(person.id)
              return (
                <button
                  key={person.id}
                  type="button"
                  className="filter-dropdown__item"
                  onClick={() => handleSelectPerson(person.id)}
                >
                  <span>
                    {person.displayName}
                    {person.nickname && (
                      <span style={{ fontSize: '0.85em', color: '#868e96', marginLeft: '6px' }}>@{person.nickname}</span>
                    )}
                  </span>

                  {/* Se la persona è già selezionata, mostro un piccolo indicatore */}
                  {isSelected && <span aria-hidden="true">✓</span>}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
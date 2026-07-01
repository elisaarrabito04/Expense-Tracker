import { useState, useRef } from 'react'
import type { AppUser, Tag, FiltersState, FiltersActions } from '../../types/types'
import TagFilter from './TagFilter'
import PeopleFilter from './PeopleFilter'
import { useClickOutside } from '../../hooks/useClickOutside'
import './HomeFilters.css'

/*
  Non userei Context solo perché hai “troppe props” tra Home e HomeFilters, 
  dato che qui il passaggio è diretto parent-child e il prop drilling vero non c’è. 
  Context ha più senso quando lo stesso stato deve essere letto o aggiornato da molti componenti a profondità diverse nell’albero.
*/

type HomeFiltersProps = {
  availableTags: Tag[]
  availablePeople: AppUser[]
  filters: FiltersState
  actions: FiltersActions
}

export default function HomeFilters({
  availableTags,
  availablePeople,
  filters,
  actions,
}: HomeFiltersProps) {
  const {
    movement,
    selectedTag,
    selectedPersonIds,
    fromDate,
    toDate,
    status,
    personalOnly,
  } = filters

  const {
    onMovementChange,
    onTagChange,
    onTogglePerson,
    onClearPeople,
    onFromDateChange,
    onToDateChange,
    onStatusChange,
    onTogglePersonalOnly,
  } = actions


  // dati utili per mostrare i chip dei filtri applicati
  const selectedPeople = availablePeople.filter((person) =>
    selectedPersonIds.includes(person.id)
  )

  const selectedTagObject =
    availableTags.find((tag) => tag.id === selectedTag) ?? null

  // flag per capire se dabilitare certe opzioni nelle tendine
  const isSettlementDisabled = selectedPersonIds.length > 1
  const isTagFilterDisabled = movement === 'settlement'

  // Stato locale solo per aprire/chiudere il piccolo dropdown del filtro "Type".
  // Lo teniamo qui perché riguarda solo la UI di questo componente.
  const [isMovementOpen, setIsMovementOpen] = useState(false)
  const [isStatusOpen, setIsStatusOpen] = useState(false)

  const movementRef = useRef<HTMLDivElement | null>(null) // creo il containerRef, poi  React al mount inserirà l'elemento HTML fisico in containerRef.current
  const statusRef = useRef<HTMLDivElement | null>(null)

  useClickOutside(
    movementRef,
    () => {
      setIsMovementOpen(false)
    },
    isMovementOpen
  )

  useClickOutside(
    statusRef,
    () => {
      setIsStatusOpen(false)
    },
    isStatusOpen
  )

  // Piccola mappa per mostrare un'etichetta leggibile nel bottone "Type".
  // Il valore vero del filtro resta comunque movement = 'all' | 'expense' | 'settlement'.
  const movementLabelMap = {
    all: 'Tipo',
    expense: 'Spese',
    settlement: 'Pagamenti',
  }

  const statusLabelMap = {
    active: 'Confermate',
    pending: 'In attesa',
    revision: 'Da revisionare',
    deleted: 'Eliminate',
  }

  // per resettare tutto il range data
  function handleClearDateRange() {
    onFromDateChange('')
    onToDateChange('')
  }

  // per mostrare i chip attivi (filtro per persone e tag lo implementano già)
  const hasActiveDateFilter = !!fromDate || !!toDate
  const hasActiveMovementFilter = movement !== 'all'
  const hasActivePeopleFilter = selectedPeople.length > 0
  const hasActiveTagFilter = selectedTagObject !== null
  const hasActiveStatusFilter = status !== 'active'
  const hasActivePersonalOnlyFilter = personalOnly
  const hasAnyActiveFilter =
    hasActivePeopleFilter ||
    hasActiveTagFilter ||
    hasActiveDateFilter ||
    hasActiveMovementFilter ||
    hasActiveStatusFilter ||
    hasActivePersonalOnlyFilter

  return (
    <section className="home-filters">
      <h3 className="home-filters__title">Filtri</h3>

      {/* Prima riga: People + Tags */}
      <div className="home-filters-layout home-filters-layout--top-row">
        <PeopleFilter
          availablePeople={availablePeople}
          selectedPersonIds={selectedPersonIds}
          onTogglePerson={onTogglePerson}
          onClearPeople={onClearPeople}
        />

        <TagFilter
          availableTags={availableTags}
          selectedTag={selectedTag}
          onTagChange={onTagChange}
          disabled={isTagFilterDisabled}
        />
      </div>

      {/* Seconda riga: solo date */}
      <div className="home-filters-layout home-filters-layout--dates-row">
        <label className="filter-search filter-search--date">
          <span className="filter-field__label">Da</span>

          <input
            type="date"
            value={fromDate}
            required
            max={toDate || undefined}
            onChange={(e) => onFromDateChange(e.target.value)}
            aria-label="Data iniziale"
          />
        </label>

        <label className="filter-search filter-search--date">
          <span className="filter-field__label">A</span>

          <input
            type="date"
            value={toDate}
            required
            min={fromDate || undefined}
            onChange={(e) => onToDateChange(e.target.value)}
            aria-label="Data finale"
          />
        </label>
      </div>

      {/* Terza riga: Type e Stato affiancati */}
      <div className="home-filters-layout home-filters-layout--type-row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div className="filter-field filter-field--type" ref={movementRef} style={{ flex: 1 }}>
          <button
            type="button"
            className="filter-search filter-search--button filter-search--type"
            onClick={() => setIsMovementOpen((prev) => !prev)}
            aria-expanded={isMovementOpen}
          >
            <span className="filter-search__text">
              {movementLabelMap[movement]}
            </span>

            <span className="filter-search__chevron" aria-hidden="true">
              ▾
            </span>
          </button>

          {isMovementOpen && (
            <div className="filter-dropdown filter-dropdown--type">

              <button
                type="button"
                className="filter-dropdown__item"
                onClick={() => {
                  onMovementChange('expense')
                  setIsMovementOpen(false)
                }}
              >
                Spese
              </button>

              <button
                type="button"
                className={`filter-dropdown__item ${isSettlementDisabled ? 'filter-dropdown__item--disabled' : ''
                  }`}
                onClick={() => {
                  // essendo il bottone di rimborso devo vedere se è selezionabile
                  if (isSettlementDisabled) {
                    return
                  }
                  onMovementChange('settlement')
                  setIsMovementOpen(false)
                }}
                disabled={isSettlementDisabled}
                aria-disabled={isSettlementDisabled}
              >
                Pagamenti
              </button>

              {isSettlementDisabled && (
                <p className="filter-dropdown__hint">
                  Disponibile solo quando selezioni una sola persona.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Nuovo Dropdown Filtro Stato */}
        <div className="filter-field filter-field--type" ref={statusRef} style={{ flex: 1 }}>
          <button
            type="button"
            className="filter-search filter-search--button filter-search--type"
            onClick={() => setIsStatusOpen((prev) => !prev)}
            aria-expanded={isStatusOpen}
          >
            <span className="filter-search__text">
              {statusLabelMap[status]}
            </span>

            <span className="filter-search__chevron" aria-hidden="true">
              ▾
            </span>
          </button>

          {isStatusOpen && (
            <div className="filter-dropdown filter-dropdown--type">
              <button
                type="button"
                className="filter-dropdown__item"
                onClick={() => { onStatusChange('active'); setIsStatusOpen(false) }}
              >
                Confermate
              </button>
              <button
                type="button"
                className="filter-dropdown__item"
                onClick={() => { onStatusChange('pending'); setIsStatusOpen(false) }}
              >
                In attesa
              </button>
              <button
                type="button"
                className="filter-dropdown__item"
                onClick={() => { onStatusChange('revision'); setIsStatusOpen(false) }}
              >
                Da revisionare
              </button>
              <button
                type="button"
                className="filter-dropdown__item"
                onClick={() => { onStatusChange('deleted'); setIsStatusOpen(false) }}
              >
                Eliminate
              </button>
            </div>
          )}
        </div>

        <div className="filter-field" style={{ flex: 1, minWidth: '120px' }}>
          <button
            type="button"
            className={`filter-search filter-search--button ${personalOnly ? 'filter-search--active' : ''}`}
            onClick={onTogglePersonalOnly}
            style={{
              justifyContent: 'center',
              backgroundColor: personalOnly ? '#e7f5ff' : undefined,
              color: personalOnly ? '#1864ab' : undefined,
              borderColor: personalOnly ? '#74c0fc' : undefined,
            }}
          >
            👤 Solo mie
          </button>
        </div>
      </div>

      {/* CHIPS ATTIVI */}
      {hasAnyActiveFilter && (
        <div className="selected-filter-chips">
          {hasActivePeopleFilter &&
            selectedPeople.map((person) => (
              <button
                key={person.id}
                type="button"
                className="selected-filter-chip"
                onClick={() => onTogglePerson(person.id)}
              >
                {person.displayName}
                <span aria-hidden="true">×</span>
              </button>
            ))}

          {hasActiveTagFilter && selectedTagObject && (
            <button
              type="button"
              className="selected-filter-chip"
              onClick={() => onTagChange('all')}
            >
              <span aria-hidden="true">#</span>
              {selectedTagObject.label}
              <span aria-hidden="true">×</span>
            </button>
          )}

          {hasActiveMovementFilter && (
            <button
              type="button"
              className="selected-filter-chip"
              onClick={() => onMovementChange('all')}
            >
              {movementLabelMap[movement]}
              <span aria-hidden="true">×</span>
            </button>
          )}

          {hasActiveStatusFilter && (
            <button
              type="button"
              className="selected-filter-chip"
              onClick={() => onStatusChange('active')}
            >
              {statusLabelMap[status]}
              <span aria-hidden="true">×</span>
            </button>
          )}

          {hasActivePersonalOnlyFilter && (
            <button
              type="button"
              className="selected-filter-chip"
              onClick={onTogglePersonalOnly}
            >
              Solo mie
              <span aria-hidden="true">×</span>
            </button>
          )}

          {hasActiveDateFilter && (
            <button
              type="button"
              className="selected-filter-chip"
              onClick={handleClearDateRange}
            >
              {fromDate || 'inizio'} - {toDate || 'fine'}
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
      )}
    </section>
  )
}
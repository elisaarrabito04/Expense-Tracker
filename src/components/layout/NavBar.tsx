import { NavLink } from 'react-router-dom'
// L'aggiunta di "?react" è fondamentale: trasforma l'SVG in un componente
import HomeIcon from '../../assets/home.svg?react'
import AnalyticsIcon from '../../assets/analytics.svg?react'
import AddIcon from '../../assets/add.svg?react'
import ProfileIcon from '../../assets/profile.svg?react'
import './Navbar.css'

export default function Navbar() {
  return (
    <nav className="bottom-navbar">
      <div className="bottom-navbar__inner">
        {/* NavLink fornisce automaticamente un parametro "isActive" basato sull'URL corrente */}
        <NavLink 
          to="/home" 
          className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
        >
          <HomeIcon className="nav-icon" />
          <span className="nav-label">Home</span>
        </NavLink>

        <NavLink 
          to="/analytics" 
          className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
        >
          <AnalyticsIcon className="nav-icon" />
          <span className="nav-label">Analisi</span>
        </NavLink>

        <NavLink 
          to="/add" 
          className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
        >
          <AddIcon className="nav-icon" />
          <span className="nav-label">Aggiungi</span>
        </NavLink>

        <NavLink 
          to="/profile" 
          className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
        >
          <ProfileIcon className="nav-icon" />
          <span className="nav-label">Profilo</span>
        </NavLink>
      </div>
    </nav>
  )
}
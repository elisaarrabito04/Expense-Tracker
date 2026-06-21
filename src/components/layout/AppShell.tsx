import { Outlet } from 'react-router-dom'
import TopBar from './TopBar'
import NavBar from './NavBar'

export default function AppShell() {

  return (
    <div className="app-shell">
      <TopBar />

      <main className="app-content">
        <Outlet />
      </main>

      <NavBar />
    </div>
  )
}
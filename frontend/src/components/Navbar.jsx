import { Link, useLocation } from 'react-router-dom'
import Logo from './Logo'

const NAV_LINKS = [
  { to: '/',       label: 'Home' },
  { to: '/about',  label: 'About' },
  { to: '/search', label: 'Search' },
]

export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <nav className="gm-nav">
      <div className="container-gm gm-nav-inner">
        <Link to="/" className="gm-brand">
          <Logo size={30} />
          garment market
        </Link>

        <div className="gm-nav-links">
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`gm-nav-link${pathname === to ? ' gm-nav-link-active' : ''}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}

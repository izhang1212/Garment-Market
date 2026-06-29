import { Link } from 'react-router-dom'
import Logo from './Logo'

export default function Footer() {
  return (
    <footer className="gm-footer">
      <div className="container-gm">
        <div className="gm-footer-grid">
          {/* Brand */}
          <div>
            <div className="mb-3">
              <Logo size={36} />
            </div>
            <p
              className="text-sm font-semibold mb-2"
              style={{ color: 'var(--bone)', letterSpacing: '-0.01em' }}
            >
              garment market.
            </p>
            <p
              className="text-xs leading-relaxed"
              style={{ color: 'color-mix(in oklab, var(--bone) 50%, transparent)', maxWidth: '18rem' }}
            >
              algorithmic market-making for sneakers &amp; streetwear using ev and avellaneda–stoikov models.
            </p>
          </div>

          {/* MARKET */}
          <div>
            <p className="gm-footer-col-title">Market</p>
            <Link to="/" className="gm-footer-link">hot drops</Link>
            <Link to="/search" className="gm-footer-link">movers</Link>
            <Link to="/search" className="gm-footer-link">watchlist</Link>
          </div>

          {/* MODELS */}
          <div>
            <p className="gm-footer-col-title">Models</p>
            <Link to="/about" className="gm-footer-link">expected value</Link>
            <Link to="/about" className="gm-footer-link">avellaneda–stoikov</Link>
            <Link to="/about" className="gm-footer-link">methodology</Link>
          </div>

          {/* GARMENT */}
          <div>
            <p className="gm-footer-col-title">Garment</p>
            <Link to="/about" className="gm-footer-link">about</Link>
            <span className="gm-footer-link" style={{ cursor: 'default' }}>api</span>
            <span className="gm-footer-link" style={{ cursor: 'default' }}>contact</span>
          </div>
        </div>

        <div className="gm-footer-bottom">
          <span>© 2026 Garment Market</span>
          <span>V0.4.2 · Live</span>
        </div>
      </div>
    </footer>
  )
}

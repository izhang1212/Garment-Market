const TICKER_ITEMS = [
  { name: 'Nike Dunk Low Panda',          sku: 'DD1391-100', price: 120, delta: +18  },
  { name: 'Air Jordan 1 High OG',         sku: 'DZ5485-612', price: 195, delta: -12  },
  { name: 'Yeezy 350 V2 Zebra',           sku: 'CP9654',     price: 220, delta: +5   },
  { name: 'NB 550 White Green',           sku: 'BB550WT1',   price: 110, delta: +32  },
  { name: 'SB Dunk Travis Scott',         sku: 'CT5053-001', price: 860, delta: +420 },
  { name: 'Adidas Samba OG',              sku: 'B75806',     price: 95,  delta: +22  },
  { name: 'Air Force 1 Low White',        sku: 'CW2288-111', price: 90,  delta: -3   },
  { name: 'Jordan 4 Retro Black Cat',     sku: 'CU1110-010', price: 215, delta: +65  },
  { name: 'New Balance 2002R Protection', sku: 'M2002RDH',   price: 145, delta: +55  },
  { name: 'Nike Cortez SP White',         sku: 'DZ2853-100', price: 105, delta: +15  },
]

const doubled = [...TICKER_ITEMS, ...TICKER_ITEMS]

export default function Ticker() {
  return (
    <div className="ticker">
      <div className="ticker-track">
        {doubled.map((item, i) => (
          <span key={i} className="ticker-item">
            <span>{item.name}</span>
            <span style={{ color: 'oklch(0.45 0.005 60)' }}>·</span>
            <span style={{ color: 'oklch(0.94 0.012 90)' }}>${item.price}</span>
            <span className={item.delta >= 0 ? 'ticker-up' : 'ticker-down'}>
              {item.delta >= 0 ? '+' : ''}{item.delta}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

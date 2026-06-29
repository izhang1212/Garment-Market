import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Ticker from './components/Ticker'
import Footer from './components/Footer'
import Home from './pages/Home'
import About from './pages/About'
import Search from './pages/Search'
import ItemDetail from './pages/ItemDetail'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <Ticker />
        <main className="flex-1">
          <Routes>
            <Route path="/"           element={<Home />} />
            <Route path="/about"      element={<About />} />
            <Route path="/search"     element={<Search />} />
            <Route path="/items/:sku" element={<ItemDetail />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  )
}

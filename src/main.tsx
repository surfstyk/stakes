import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { applyBrand } from './brand/index.ts'
import './product/product.css'

// Drive the stylesheet + title from the brand layer before first paint.
applyBrand()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

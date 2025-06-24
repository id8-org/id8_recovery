import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import IdeaPage from './pages/Idea'

createRoot(document.getElementById("root")!).render(
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/*" element={<App />} />
      <Route path="/ideas/:id" element={<IdeaPage />} />
    </Routes>
  </BrowserRouter>
);

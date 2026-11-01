import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import './index.css'
import Anomalies from './pages/Anomalies'
import { Login, Register, RequireAuth } from './pages/Auth'
import DataManagement from './pages/DataManagement'
import Evaluation from './pages/Evaluation'
import ModelTesting from './pages/ModelTesting'
import Overview from './pages/Overview'
import Prediction from './pages/Prediction'
import Trends from './pages/Trends'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 60_000 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<Overview />} />
            <Route path="trends" element={<Trends />} />
            <Route path="prediction" element={<Prediction />} />
            <Route path="testing" element={<ModelTesting />} />
            <Route path="anomalies" element={<Anomalies />} />
            <Route path="evaluation" element={<Evaluation />} />
            <Route path="data" element={<DataManagement />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)

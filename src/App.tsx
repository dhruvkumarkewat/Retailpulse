import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DataProvider, useData } from './context/DataContext';
import { SettingsProvider } from './context/SettingsContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Customers from './pages/Customers';
import Segmentation from './pages/Segmentation';
import Churn from './pages/Churn';
import Inventory from './pages/Inventory';
import Countries from './pages/Countries';
import Products from './pages/Products';
import Forecast from './pages/Forecast';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { LoadingState } from './components/ui';

function Gate({ children }: { children: React.ReactNode }) {
  const { status } = useData();
  if (status === 'loading') return <div className="grid h-full place-items-center"><LoadingState label="RetailPulse is parsing the cleaned dataset…" /></div>;
  return <>{children}</>;
}

export default function App() {
  return (
    <SettingsProvider>
      <DataProvider>
        <HashRouter>
          <Gate>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/sales" element={<Sales />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/segmentation" element={<Segmentation />} />
                <Route path="/churn" element={<Churn />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/countries" element={<Countries />} />
                <Route path="/products" element={<Products />} />
                <Route path="/forecast" element={<Forecast />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Gate>
        </HashRouter>
      </DataProvider>
    </SettingsProvider>
  );
}

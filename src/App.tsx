import { Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar } from './components/Sidebar';
import { CustomerApp } from './apps/customer/CustomerApp';
import { RemotePin } from './apps/customer/RemotePin';
import { TransitApp } from './apps/transit/TransitApp';
import { HubConsole, HubPicker } from './apps/hub/HubConsole';
import { RiderApp, RiderPicker, RiderStop } from './apps/rider/RiderApp';

export default function App() {
  return (
    <ErrorBoundary>
      {/* Sidebar: always on, switches between stakeholder interfaces (no launcher page) */}
      <div className="flex">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <Routes>
            <Route path="/" element={<Navigate to="/customer" replace />} />
            <Route path="/customer/*" element={<CustomerApp />} />
            <Route path="/transit" element={<TransitApp />} />
            <Route path="/hub" element={<HubPicker />} />
            <Route path="/hub/:hubId" element={<HubConsole />} />
            <Route path="/rider" element={<RiderPicker />} />
            <Route path="/rider/:riderId" element={<RiderApp />} />
            <Route path="/rider/:riderId/stop/:orderId" element={<RiderStop />} />
            <Route path="/pin/:token" element={<RemotePin />} />
            <Route path="*" element={<Navigate to="/customer" replace />} />
          </Routes>
        </div>
      </div>
    </ErrorBoundary>
  );
}

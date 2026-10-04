import { Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Launcher } from './apps/Launcher';
import { CustomerApp } from './apps/customer/CustomerApp';
import { RemotePin } from './apps/customer/RemotePin';
import { TransitApp } from './apps/transit/TransitApp';
import { HubConsole, HubPicker } from './apps/hub/HubConsole';
import { RiderApp, RiderPicker, RiderStop } from './apps/rider/RiderApp';
import { OpsApp } from './apps/ops/OpsApp';
import { ActivityLog } from './apps/log/ActivityLog';

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Launcher />} />
        <Route path="/customer/*" element={<CustomerApp />} />
        <Route path="/transit" element={<TransitApp />} />
        <Route path="/hub" element={<HubPicker />} />
        <Route path="/hub/:hubId" element={<HubConsole />} />
        <Route path="/rider" element={<RiderPicker />} />
        <Route path="/rider/:riderId" element={<RiderApp />} />
        <Route path="/rider/:riderId/stop/:orderId" element={<RiderStop />} />
        <Route path="/ops" element={<OpsApp />} />
        <Route path="/log" element={<ActivityLog />} />
        <Route path="/pin/:token" element={<RemotePin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

import { Navigate, Route, Routes } from 'react-router-dom';
import { PhoneFrame } from '../../components/PhoneFrame';
import { HomeFeed } from './HomeFeed';
import { ProductPage } from './ProductPage';
import { Cart } from './Cart';
import { Checkout } from './Checkout';
import { AddressEditor } from './AddressEditor';
import { OrderPlaced } from './OrderPlaced';
import { Orders } from './Orders';
import { OrderDetails } from './OrderDetails';
import { Account, AddressBook } from './Account';
import { Inbox } from './Inbox';
import { IvrCall } from './IvrCall';

export function CustomerApp() {
  return (
    <PhoneFrame>
      <Routes>
        <Route index element={<HomeFeed />} />
        <Route path="product/:productId" element={<ProductPage />} />
        <Route path="cart" element={<Cart />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="addresses" element={<AddressBook />} />
        <Route path="addresses/new" element={<AddressEditor />} />
        <Route path="addresses/:addressId/edit" element={<AddressEditor />} />
        <Route path="order-placed/:orderId" element={<OrderPlaced />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:orderId" element={<OrderDetails />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="account" element={<Account />} />
        <Route path="*" element={<Navigate to="/customer" replace />} />
      </Routes>
      <IvrCall />
    </PhoneFrame>
  );
}

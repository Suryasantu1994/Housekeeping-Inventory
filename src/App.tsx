/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Layout from './components/Layout';
import { AuthProvider } from './contexts/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <Layout />
    </AuthProvider>
  );
}

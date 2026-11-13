import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/app-shell';
import { LedgerFlowApi, type LedgerFlowApiPort } from '../lib/api-client';
import { LedgerFlowProvider } from './ledgerflow-provider';
import { LedgerPage } from './pages/ledger-page';
import { OverviewPage } from './pages/overview-page';
import { SettlementsPage } from './pages/settlements-page';
import { TransactionsPage } from './pages/transactions-page';

const defaultApi = new LedgerFlowApi();

export function App({ api = defaultApi }: { api?: LedgerFlowApiPort }) {
  return (
    <LedgerFlowProvider api={api}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<OverviewPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="ledger" element={<LedgerPage />} />
            <Route path="settlements" element={<SettlementsPage />} />
            <Route path="*" element={<Navigate replace to="/" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LedgerFlowProvider>
  );
}

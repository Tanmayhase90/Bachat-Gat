import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import AddMemberModal from '../forms/AddMemberModal';
import RecordSavingsModal from '../forms/RecordSavingsModal';
import CreateLoanModal from '../forms/CreateLoanModal';
import RecordRepaymentModal from '../forms/RecordRepaymentModal';

const MainLayout = () => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isRecordSavingsOpen, setIsRecordSavingsOpen] = useState(false);
  const [isCreateLoanOpen, setIsCreateLoanOpen] = useState(false);
  const [isRecordRepaymentOpen, setIsRecordRepaymentOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="app-container">
      <Sidebar isMobileOpen={isMobileSidebarOpen} onCloseMobile={() => setIsMobileSidebarOpen(false)} />

      <div className="main-content">
        <Header
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenAddMember={() => setIsAddMemberOpen(true)}
          onOpenRecordSavings={() => setIsRecordSavingsOpen(true)}
          onOpenCreateLoan={() => setIsCreateLoanOpen(true)}
        />

        <main className="page-body">
          <Outlet
            context={{
              refreshTrigger,
              triggerRefresh,
              openAddMember: () => setIsAddMemberOpen(true),
              openRecordSavings: () => setIsRecordSavingsOpen(true),
              openCreateLoan: () => setIsCreateLoanOpen(true),
              openRecordRepayment: () => setIsRecordRepaymentOpen(true),
            }}
          />
        </main>
      </div>

      {/* Global Modals */}
      <AddMemberModal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        onSuccess={triggerRefresh}
      />

      <RecordSavingsModal
        isOpen={isRecordSavingsOpen}
        onClose={() => setIsRecordSavingsOpen(false)}
        onSuccess={triggerRefresh}
      />

      <CreateLoanModal
        isOpen={isCreateLoanOpen}
        onClose={() => setIsCreateLoanOpen(false)}
        onSuccess={triggerRefresh}
      />

      <RecordRepaymentModal
        isOpen={isRecordRepaymentOpen}
        onClose={() => setIsRecordRepaymentOpen(false)}
        onSuccess={triggerRefresh}
      />
    </div>
  );
};

export default MainLayout;

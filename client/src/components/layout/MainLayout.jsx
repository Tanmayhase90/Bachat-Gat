import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import AddMemberModal from '../forms/AddMemberModal';
import RecordSavingsAndLoanModal from '../forms/RecordSavingsAndLoanModal';
import CreateLoanModal from '../forms/CreateLoanModal';
import { licenseService } from '../../services/licenseService';
import { backupService } from '../../services/backupService';
import {
  LicenseExpiredModal,
  LicenseExpiryWarningBanner,
  ActivateLicenseModal,
} from '../license/LicenseModals';

const MainLayout = () => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordModalOptions, setRecordModalOptions] = useState({});
  const [isCreateLoanOpen, setIsCreateLoanOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Licence & Auto Backup state
  const [licenseStatus, setLicenseStatus] = useState(licenseService.getLicenseStatus());
  const [showWarningBanner, setShowWarningBanner] = useState(false);
  const [isActivateOpen, setIsActivateOpen] = useState(false);

  useEffect(() => {
    // Check if warning banner should be shown today
    if (licenseStatus.needsWarning && licenseService.consumeDailyWarning()) {
      setShowWarningBanner(true);
    }

    // Check 2-day auto backup on load
    backupService.checkAutoBackupDue();

    // Check auto backup & license status on window visibility change (resume)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const currentStatus = licenseService.getLicenseStatus();
        setLicenseStatus(currentStatus);
        if (currentStatus.needsWarning && licenseService.consumeDailyWarning()) {
          setShowWarningBanner(true);
        }
        backupService.checkAutoBackupDue();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => window.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleOpenRecordModal = (options = {}) => {
    setRecordModalOptions(options || {});
    setIsRecordModalOpen(true);
  };

  return (
    <div className="app-container">
      <Sidebar isMobileOpen={isMobileSidebarOpen} onCloseMobile={() => setIsMobileSidebarOpen(false)} />

      <div className="main-content">
        {showWarningBanner && (
          <LicenseExpiryWarningBanner
            status={licenseStatus}
            onOpenActivate={() => setIsActivateOpen(true)}
            onDismiss={() => setShowWarningBanner(false)}
          />
        )}

        <Header
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenAddMember={() => setIsAddMemberOpen(true)}
          onOpenRecordSavings={() => handleOpenRecordModal({ mode: 'savings' })}
          onOpenCreateLoan={() => setIsCreateLoanOpen(true)}
          onOpenRecordRepayment={() => handleOpenRecordModal({ mode: 'loan' })}
        />

        <main className="page-body">
          <Outlet
            context={{
              refreshTrigger,
              triggerRefresh,
              openAddMember: () => setIsAddMemberOpen(true),
              openRecordSavings: handleOpenRecordModal,
              openCreateLoan: () => setIsCreateLoanOpen(true),
              openRecordRepayment: (options = {}) => handleOpenRecordModal({ ...options, mode: 'loan' }),
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

      <RecordSavingsAndLoanModal
        key={`global-savings-loan-modal-${recordModalOptions.memberId || recordModalOptions.initialMemberId || ''}-${recordModalOptions.loanId || recordModalOptions.initialLoanId || ''}-${recordModalOptions.month || ''}-${recordModalOptions.year || ''}-${isRecordModalOpen}`}
        isOpen={isRecordModalOpen}
        onClose={() => {
          setIsRecordModalOpen(false);
          setRecordModalOptions({});
        }}
        onSuccess={triggerRefresh}
        initialMemberId={recordModalOptions.memberId || recordModalOptions.initialMemberId || null}
        initialLoanId={recordModalOptions.loanId || recordModalOptions.initialLoanId || null}
        initialMonth={recordModalOptions.month || recordModalOptions.selectedMonth || recordModalOptions.initialMonth || null}
        initialYear={recordModalOptions.year || recordModalOptions.selectedYear || recordModalOptions.initialYear || null}
        initialMode={recordModalOptions.mode || 'savings'}
      />

      <CreateLoanModal
        isOpen={isCreateLoanOpen}
        onClose={() => setIsCreateLoanOpen(false)}
        onSuccess={triggerRefresh}
      />

      {/* Global Licence Modals */}
      <LicenseExpiredModal
        isOpen={licenseStatus.isExpired}
        onActivateSuccess={() => {
          setLicenseStatus(licenseService.getLicenseStatus());
          setShowWarningBanner(false);
          triggerRefresh();
        }}
      />

      <ActivateLicenseModal
        isOpen={isActivateOpen}
        onClose={() => setIsActivateOpen(false)}
        onSuccess={() => {
          setLicenseStatus(licenseService.getLicenseStatus());
          setShowWarningBanner(false);
          triggerRefresh();
        }}
        initialMachineId={licenseStatus.machineId}
      />
    </div>
  );
};

export default MainLayout;

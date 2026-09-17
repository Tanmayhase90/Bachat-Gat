import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import AddMemberModal from '../forms/AddMemberModal';
import RecordSavingsModal from '../forms/RecordSavingsModal';
import CreateLoanModal from '../forms/CreateLoanModal';
import RecordRepaymentModal from '../forms/RecordRepaymentModal';
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
  const [isRecordSavingsOpen, setIsRecordSavingsOpen] = useState(false);
  const [recordSavingsOptions, setRecordSavingsOptions] = useState({});
  const [isCreateLoanOpen, setIsCreateLoanOpen] = useState(false);
  const [isRecordRepaymentOpen, setIsRecordRepaymentOpen] = useState(false);
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

  const handleOpenRecordSavings = (options = {}) => {
    setRecordSavingsOptions(options || {});
    setIsRecordSavingsOpen(true);
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
          onOpenRecordSavings={() => handleOpenRecordSavings()}
          onOpenCreateLoan={() => setIsCreateLoanOpen(true)}
          onOpenRecordRepayment={() => setIsRecordRepaymentOpen(true)}
        />

        <main className="page-body">
          <Outlet
            context={{
              refreshTrigger,
              triggerRefresh,
              openAddMember: () => setIsAddMemberOpen(true),
              openRecordSavings: handleOpenRecordSavings,
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
        key={`global-savings-modal-${recordSavingsOptions.memberId || ''}-${recordSavingsOptions.month || ''}-${recordSavingsOptions.year || ''}-${isRecordSavingsOpen}`}
        isOpen={isRecordSavingsOpen}
        onClose={() => {
          setIsRecordSavingsOpen(false);
          setRecordSavingsOptions({});
        }}
        onSuccess={triggerRefresh}
        initialMemberId={recordSavingsOptions.memberId || recordSavingsOptions.initialMemberId || null}
        initialMonth={recordSavingsOptions.month || recordSavingsOptions.selectedMonth || recordSavingsOptions.initialMonth || null}
        initialYear={recordSavingsOptions.year || recordSavingsOptions.selectedYear || recordSavingsOptions.initialYear || null}
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

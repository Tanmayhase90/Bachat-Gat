import React from 'react';
import RecordSavingsAndLoanModal from './RecordSavingsAndLoanModal';

/**
 * Unified single popup: RecordRepaymentModal delegates directly to RecordSavingsAndLoanModal
 * with initialMode="loan". Eliminates duplicate modal components and separate recording workflows.
 */
const RecordRepaymentModal = (props) => {
  return <RecordSavingsAndLoanModal {...props} initialMode="loan" />;
};

export default RecordRepaymentModal;

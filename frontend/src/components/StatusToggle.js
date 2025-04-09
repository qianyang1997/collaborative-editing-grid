import React, { forwardRef, useImperativeHandle, useState, useRef, useEffect } from 'react';
import './style/Grid.css';

const StatusToggle = forwardRef((props, ref) => {
  const [saveStatus, setSaveStatus] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const numSaving = useRef(0);
  const statusMap = {
    0: 'Saving...',
    1: 'All changes Saved.',
    2: 'Some changes failed to save. Saving...',
    3: 'Failed to save.'
  };

  // TODO: update logic - bulk save in the backend
  useImperativeHandle(ref, () => {
    return {
      updateSaveStatus: (status) => {
        if (status === 0) {
          // If status is 'saving', increment saving ref
          numSaving.current++;
          setSaveStatus(0);
        } else if (status === 1) {
          // If status is 'saved', decrement saving ref
          numSaving.current--;
          if (numSaving.current === 0) {
            setSaveStatus(1);
          }
        } else if (status === 2) {
          // If status is 'failed', decrement saving ref
          numSaving.current--;
          if (numSaving.current > 0) {
            setSaveStatus(2);
          } else {
            setSaveStatus(3);
          }
        }
        setIsVisible(true);
      }
    };
  }, []);

  // If status becomes "saved" or "failed", remove toggle after 3 seconds
  useEffect(() => {
    const removeToggle = setTimeout(() => {
      if (saveStatus > 0) {
        setIsVisible(false);
      }
    }, 3000);
    return () => clearTimeout(removeToggle);
  }, [saveStatus]);

  return (
    <div className={`save-status ${isVisible ? 'show' : 'hide'}`}>{statusMap[saveStatus]}</div>
  );
});

StatusToggle.displayName = 'StatusToggle';

export default StatusToggle;

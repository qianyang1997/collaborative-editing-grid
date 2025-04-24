/* eslint-disable react/prop-types */
import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { BACKEND_URL } from '../constants/settings';

const DataContext = createContext();

const DataProvider = ({ children }) => {
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState(null);
  const ws = useRef(null);
  const statusToggleRef = useRef(null);
  const cellRefs = useRef({});

  const handleCellRender = useCallback((isPending) => {
    setIsPending(isPending);
  }, []);

  useEffect(() => {
    // Skip websocket setup if cells are not rendered
    if (isPending) return;

    ws.current = new WebSocket(`ws://${BACKEND_URL}`); // TODO: separate dev vs. prod

    ws.current.onopen = () => {
      console.log('Connection to websocket established.');
    };

    ws.current.onmessage = (e) => {
      const data = JSON.parse(e.data);
      console.log(data);
      switch (data.type) {
        case 'USER':
          if (data.payload.status === 'open') {
            // TODO: Add user icon at top
            console.log(`${data.payload.user} is now online!`);
          }
          if (data.payload.status === 'closed') {
            // TODO: drop user icon
            console.log(`${data.payload.user} went offline.`);
          }
          break;
        case 'DATA':
          if (data.payload.data_type === 'user') {
            // TODO: Populate active users upon initial sign in
            // setInitialUsers(data.payload.message);
          } else if (data.payload.data_type === 'data') {
            // Populate current data upon initial sign in
            Object.entries(data.payload.message).forEach(([key, valueMap]) => {
              cellRefs.current[key].updateCellValue(valueMap.value);
            });
          }
          break;
        case 'EDIT':
          cellRefs.current[`${data.payload.rowKey}-${data.payload.columnKey}`].updateCellValue(
            data.payload.value
          );
          break;
        case 'SAVE':
          if (data.payload.status === 200) {
            statusToggleRef.current.updateSaveStatus(1);
          } else {
            statusToggleRef.current.updateSaveStatus(2);
          }
          break;
        case 'SYSTEM_ERROR':
          setError(data.payload.message);
          break;
        default:
      }
    };

    ws.current.onerror = (error) => {
      alert('Connection error: Unable to reach server.');
      setError(`Websocket error observed: ${error.message}.`);
    };

    ws.current.onclose = () => {
      alert('Server is shutting down. You session is closed.');
      setError('Connection to websocket closed.');
    };

    return () => {
      ws.current.close();
    };
  }, [isPending]);

  const getCellValue = () => {};

  const saveCellValue = (rowKey, columnKey, value) => {
    // Set status to "Saving"
    statusToggleRef.current.updateSaveStatus(0);

    // Send new edits to backend
    ws.current.send(
      JSON.stringify({
        type: 'EDIT',
        payload: { rowKey, columnKey, value }
      })
    );
  };

  return (
    <DataContext.Provider
      value={{ getCellValue, saveCellValue, cellRefs, statusToggleRef, handleCellRender, error }}
    >
      {children}
    </DataContext.Provider>
  );
};

export { DataContext, DataProvider };

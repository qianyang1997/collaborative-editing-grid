import React, { useContext, useEffect, useState } from 'react';
import { DataContext } from '../context/DataContext';
import Cell from './Cell';
import StatusToggle from './StatusToggle';
import { DEFAULT_DIMENSIONS } from '../constants/settings';
import './style/Grid.css';

const Grid = () => {
  const { cellRefs, statusToggleRef, handleCellRender, error } = useContext(DataContext);
  const [rows, cols] = DEFAULT_DIMENSIONS;
  const [conflict, setConflict] = useState(null);

  // Initialize data values after Cell components render
  useEffect(() => {
    handleCellRender(false);
  }, [handleCellRender]);

  const tableRows = [];

  // // Show active users as icons
  // if (initialUsers) {
  //   Object.keys(initialUsers).forEach((user) => {
  //     // TODO: show them as icons
  //   });
  // }

  const handleConflict = (rk, ck, value) => {
    setConflict({ rk, ck, value });
  };

  // Create grid and populate with initial data
  for (let i = 0; i < rows; i++) {
    const tableCells = [];
    for (let j = 0; j < cols; j++) {
      tableCells.push(
        <Cell
          ref={(ref) => {
            cellRefs.current[`${i}-${j}`] = ref;
          }}
          conflictHandler={handleConflict}
          key={`${i}-${j}`}
          rowKey={i}
          columnKey={j}
          value=""
        />
      );
    }
    tableRows.push(<tr key={i}>{tableCells}</tr>);
  }

  if (error) {
    return (
      <div>
        <h2>Error</h2>
        <p>
          One or more backend systems are down. We apologize for the inconvenience. Please check
          back later.
        </p>
        <p>Error message: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <StatusToggle ref={statusToggleRef} />
      <div className="grid-container">
        <table>
          <tbody>{tableRows}</tbody>
        </table>
      </div>
      {conflict && (
        <div className="popup-overlay">
          <div className="popup">
            <p>This cell is currently being edited.</p>
            <p>Do you want to use the incoming value or continue editing?</p>
            <button
              onClick={() => {
                const { rk, ck, value } = conflict;
                cellRefs.current[`${rk}-${ck}`].overrideCellValue(value);
                setConflict(null);
              }}
            >
              Use Incoming Value
            </button>
            <button
              onClick={() => {
                setConflict(null);
              }}
            >
              Continue Editing
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Grid;

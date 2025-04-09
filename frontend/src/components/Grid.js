import React, { useContext, useEffect } from 'react';
import { DataContext } from '../context/DataContext';
import Cell from './Cell';
import StatusToggle from './StatusToggle';
import { DEFAULT_DIMENSIONS } from '../constants/settings';
import './style/Grid.css';

const Grid = () => {
  const { cellRefs, statusToggleRef, handleCellRender } = useContext(DataContext);
  const [rows, cols] = DEFAULT_DIMENSIONS;

  // Initialize data values after Cell components render
  useEffect(() => {
    handleCellRender(false);
  }, []);

  const tableRows = [];

  // // Show active users as icons
  // if (initialUsers) {
  //   Object.keys(initialUsers).forEach((user) => {
  //     // TODO: show them as icons
  //   });
  // }

  // Create grid and populate with initial data
  for (let i = 0; i < rows; i++) {
    const tableCells = [];
    for (let j = 0; j < cols; j++) {
      // TODO: add edit history
      tableCells.push(
        <Cell
          ref={(ref) => {
            cellRefs.current[`${i}-${j}`] = ref;
          }}
          key={`${i}-${j}`}
          rowKey={i}
          columnKey={j}
          value=''
        />
      );
    }
    tableRows.push(<tr key={i}>{tableCells}</tr>);
  }

  return (
    <div>
      <StatusToggle ref={statusToggleRef} />
      <table>
        <tbody>{tableRows}</tbody>
      </table>
    </div>
  );
};

export default Grid;

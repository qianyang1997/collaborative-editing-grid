/* eslint-disable react/prop-types */
import React, { useState, useContext, useRef, forwardRef, useImperativeHandle } from 'react';
import { DataContext } from '../context/DataContext';

const Cell = forwardRef(({ rowKey, columnKey, value }, ref) => {
  const [cellValue, setCellValue] = useState(value);
  const [lastCellValue, setLastCellValue] = useState(value);
  const { saveCellValue } = useContext(DataContext);
  const [isEditing, setIsEditing] = useState(false);
  const cellSavedRef = useRef(true);

  const handleChange = ({ target }) => {
    setIsEditing(true);
    // If cell is edited, update cell value
    if (cellValue !== target.value) {
      cellSavedRef.current = false;
      setCellValue(target.value);
    }
  };

  const handleBlur = ({ target }) => {
    setIsEditing(false);
    // If cell loses focus, save new value if cell was edited
    if (target.value !== lastCellValue) {
      console.log('Saving cell', rowKey, columnKey, target.value, lastCellValue);
      saveCellValue(rowKey, columnKey, target.value);
      cellSavedRef.current = true;
      setLastCellValue(target.value);
    }
  };

  useImperativeHandle(ref, () => {
    return {
      updateCellValue: (rk, ck, value) => {
        if (!isEditing) {
          console.log('updating cell value', rk, ck, value);
          setCellValue(value);
        } else {
          // TODO: cell changed by others while user is actively editing. Conflict resolution
        }
      }
    };
  }, [isEditing, rowKey, columnKey]);

  return (
    <td className="cell">
      <input className="cell-input" onChange={handleChange} onBlur={handleBlur} value={cellValue} />
    </td>
  );
});

Cell.displayName = 'Cell';

export default Cell;

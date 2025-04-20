/* eslint-disable react/prop-types */
import React, { useState, useContext, useRef, forwardRef, useImperativeHandle } from 'react';
import { DataContext } from '../context/DataContext';

const Cell = forwardRef(({ conflictHandler, rowKey, columnKey, value }, ref) => {
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
      updateCellValue: (value) => {
        if (!isEditing) {
          // Update cell value if cell is not actively edited
          setCellValue(value);
        } else {
          // Generate pop up to resolve conflict is cell is actively edited
          conflictHandler(rowKey, columnKey, value);
        }
      },

      overrideCellValue: (value) => {
        // Force update cell value regardless of edit status
        setCellValue(value);
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

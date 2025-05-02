import React, { useContext } from 'react';
import { DataContext } from '../context/DataContext';
import './style/Grid.css';

const ActivityToggle = () => {
  const { activityLog } = useContext(DataContext);

  return (
    <div className="activity-log-overlay">
      <h3>Activity Log</h3>
      {activityLog.map((activity, i) => {
        return (
          <ul key={`activity_${i}`}>
            <pre>{activity}</pre>
          </ul>
        );
      })}
    </div>
  );
};

export default ActivityToggle;

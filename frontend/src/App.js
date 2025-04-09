import React from 'react';
import { DataProvider } from './context/DataContext';
import Grid from './components/Grid';

const App = () => {
  return (
    <div>
      <DataProvider>
        <Grid />
      </DataProvider>
    </div>
  );
};

export default App;

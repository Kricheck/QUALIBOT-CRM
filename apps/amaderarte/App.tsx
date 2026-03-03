
import React, { useState } from 'react';
import { LeadsProvider } from './context/LeadsContext';
import FilterBar from './components/FilterBar';
import KanbanBoard from './components/KanbanBoard';
import ReportsDashboard from './components/ReportsDashboard';
import NQLKanbanBoard from './components/NQLKanbanBoard';
import PipelineView from './components/PipelineView';
import DebugLogger from './components/DebugLogger';

export type AppView = 'kanban' | 'reports' | 'nql' | 'pipeline';

const App = () => {
  const [currentView, setCurrentView] = useState<AppView>('kanban');

  return (
    <LeadsProvider>
      <div className="flex flex-col h-screen bg-slate-100 overflow-hidden text-slate-900">
        <FilterBar currentView={currentView} onViewChange={setCurrentView} />
        <main className="flex-1 overflow-hidden relative flex flex-col">
          {currentView === 'kanban' ? <KanbanBoard /> :
           currentView === 'nql' ? <NQLKanbanBoard /> :
           currentView === 'pipeline' ? <PipelineView /> :
           <ReportsDashboard />}
        </main>
      </div>
      <DebugLogger />
    </LeadsProvider>
  );
};

export default App;

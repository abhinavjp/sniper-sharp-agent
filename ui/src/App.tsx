import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ChatView from './views/ChatView';
import ProvidersView from './views/ProvidersView';
import AgentsView from './views/AgentsView';
import SkillsView from './views/SkillsView';
import RoutingRulesView from './views/RoutingRulesView';
import SystemView from './views/SystemView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<ChatView />} />
          <Route path="providers" element={<ProvidersView />} />
          <Route path="agents" element={<AgentsView />} />
          <Route path="skills" element={<SkillsView />} />
          <Route path="routing-rules" element={<RoutingRulesView />} />
          <Route path="system" element={<SystemView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

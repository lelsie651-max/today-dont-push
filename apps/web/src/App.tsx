import { DailyPlanPage, type DailyPlanPageProps } from './features/daily-plan/DailyPlanPage';

export type AppProps = DailyPlanPageProps;

function App(props: AppProps) {
  return <DailyPlanPage {...props} />;
}

export default App;

import { DailyPlanPage, type DailyPlanPageProps } from './features/daily-plan/DailyPlanPage';
import { SpaceWorkspace } from './features/space/SpaceWorkspace';

export type AppProps = DailyPlanPageProps;

function App(props: AppProps) {
  const view =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('view')
      : null;

  const isSpaceView = view === 'space';

  return (
    <>
      <nav className="app-view-switch" aria-label="页面切换">
        <a
          className={`app-view-chip ${!isSpaceView ? 'is-active' : ''}`}
          href="/"
        >
          每日计划页面
        </a>
        <a
          className={`app-view-chip ${isSpaceView ? 'is-active' : ''}`}
          href="/?view=space"
        >
          空间页面
        </a>
      </nav>
      {isSpaceView ? <SpaceWorkspace /> : <DailyPlanPage {...props} />}
    </>
  );
}

export default App;

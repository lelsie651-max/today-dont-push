import { DailyPlanPage, type DailyPlanPageProps } from './features/daily-plan/DailyPlanPage';
import { SpaceWorkspace } from './features/space/SpaceWorkspace';

export type AppProps = DailyPlanPageProps;

function App(props: AppProps) {
  const searchParams =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : null;
  const view = searchParams?.get('view') ?? null;
  const debugAssets = searchParams?.get('debugAssets') === '1';

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
      {isSpaceView ? <SpaceWorkspace debugAssets={debugAssets} /> : <DailyPlanPage {...props} />}
    </>
  );
}

export default App;

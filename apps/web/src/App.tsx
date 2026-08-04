import { DailyPlanPage, type DailyPlanPageProps } from './features/daily-plan/DailyPlanPage';
import { SpaceWorkspace } from './features/space/SpaceWorkspace';

export type AppProps = DailyPlanPageProps & {
  readonly isDev?: boolean;
};

function App(props: AppProps) {
  const { isDev = import.meta.env.DEV, ...dailyPlanProps } = props;
  const searchParams =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : null;
  const view = searchParams?.get('view') ?? null;
  const debugAssets = searchParams?.get('debugAssets') === '1';
  const sceneEditor = isDev && searchParams?.get('sceneEditor') === '1';

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
      {isSpaceView ? (
        <SpaceWorkspace debugAssets={debugAssets} sceneEditor={sceneEditor} />
      ) : (
        <DailyPlanPage {...dailyPlanProps} />
      )}
    </>
  );
}

export default App;

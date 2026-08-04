import { DailyPlanPage, type DailyPlanPageProps } from './features/daily-plan/DailyPlanPage';
import { resolveAppViewState } from './app-view-state';
import { SpaceWorkspace } from './features/space/SpaceWorkspace';

export type AppProps = DailyPlanPageProps;

function App(props: AppProps) {
  const viewState =
    typeof window !== 'undefined'
      ? resolveAppViewState(window.location.search)
      : { isSpaceView: false, debugAssets: false };
  const { isSpaceView, debugAssets } = viewState;

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
        <SpaceWorkspace debugAssets={debugAssets} />
      ) : (
        <DailyPlanPage {...props} />
      )}
    </>
  );
}

export default App;

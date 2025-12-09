import { useState, useEffect, lazy, Suspense, useCallback, memo } from 'react';
import Header from '@/components/Header';
import BottomNav, { ActiveSection } from '@/components/BottomNav';
import SubNavTabs from '@/components/SubNavTabs';
import MapView from '@/components/MapView';
import RunControls from '@/components/RunControls';
import RunSummary from '@/components/RunSummary';
import GPSPermissionDialog from '@/components/GPSPermissionDialog';
import { useRun } from '@/hooks/useRun';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import { Toaster } from '@/components/ui/sonner';
import { RunPredictionOverlay } from '@/components/RunPredictionOverlay';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ContentSkeleton } from '@/components/ui/content-skeleton';

// Lazy load heavy components
const Leagues = lazy(() => import('@/components/Leagues'));
const Profile = lazy(() => import('@/components/Profile'));
const Tutorial = lazy(() => import('@/components/Tutorial'));
const Friends = lazy(() => import('@/components/Friends'));
const Challenges = lazy(() => import('@/components/Challenges'));
const ActivityFeed = lazy(() => import('@/components/ActivityFeed'));
const UserProfile = lazy(() => import('@/components/UserProfile'));
const ImportRun = lazy(() => import('@/components/ImportRun').then(m => ({ default: m.ImportRun })));
const RunHistory = lazy(() => import('@/components/RunHistory').then(m => ({ default: m.RunHistory })));
const Clans = lazy(() => import('@/components/Clans'));
const Notifications = lazy(() => import('@/components/Notifications'));

const activityTabs = [
  { id: 'feed', label: 'Feed' },
  { id: 'history', label: 'Historial' },
];

const competeTabs = [
  { id: 'leagues', label: 'Ligas' },
  { id: 'challenges', label: 'Retos' },
];

const communityTabs = [
  { id: 'friends', label: 'Amigos' },
  { id: 'clans', label: 'Clanes' },
];

// Loading fallback component
const SectionLoader = memo(() => (
  <div className="p-4 space-y-4">
    <ContentSkeleton type="friends" count={3} />
  </div>
));
SectionLoader.displayName = 'SectionLoader';
SectionLoader.displayName = 'SectionLoader';

// Memoized offline banner
const OfflineBanner = memo(({ 
  isOffline, 
  pendingRunsCount, 
  isOfflineSyncing, 
  syncRuns 
}: { 
  isOffline: boolean; 
  pendingRunsCount: number; 
  isOfflineSyncing: boolean; 
  syncRuns: () => void;
}) => {
  if (!isOffline && pendingRunsCount === 0) return null;
  
  return (
    <div className="px-4 mt-2 fixed top-16 left-0 right-0 z-40">
      <Card className="p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-muted/40 border-dashed border-border/50 backdrop-blur-sm">
        <div>
          <p className="text-sm font-semibold flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isOffline ? 'bg-warning animate-pulse' : 'bg-primary'}`} />
            {isOffline ? 'Modo offline activo' : 'Carreras pendientes'}
          </p>
          <p className="text-xs text-muted-foreground">
            {isOffline
              ? 'Tus carreras se sincronizarán al recuperar conexión.'
              : `${pendingRunsCount} carrera${pendingRunsCount === 1 ? '' : 's'} pendiente${pendingRunsCount === 1 ? '' : 's'}.`}
          </p>
        </div>
        {pendingRunsCount > 0 && (
          <Button
            size="sm"
            variant="secondary"
            onClick={syncRuns}
            disabled={isOffline || isOfflineSyncing}
          >
            {isOfflineSyncing ? 'Sincronizando...' : 'Sincronizar'}
          </Button>
        )}
      </Card>
    </div>
  );
});
OfflineBanner.displayName = 'OfflineBanner';

const Index = () => {
  const { user, loading } = useAuth();
  const [activeSection, setActiveSection] = useState<ActiveSection>('home');
  const [activityTab, setActivityTab] = useState('feed');
  const [competeTab, setCompeteTab] = useState('leagues');
  const [communityTab, setCommunityTab] = useState('friends');
  const [showSummary, setShowSummary] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [viewUserProfileId, setViewUserProfileId] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const { pendingRunsCount, isSyncing: isOfflineSyncing, syncRuns } = useOfflineSync();

  const {
    isRunning,
    isPaused,
    runPath,
    duration,
    distance,
    useGPS,
    isSaving,
    startRun,
    pauseRun,
    resumeRun,
    addPoint,
    stopRun,
  } = useRun();

  const {
    currentLocation,
    accuracy,
    permissionGranted,
    requestPermission,
    startTracking,
    stopTracking,
  } = useGeolocation();

  useEffect(() => {
    if (permissionGranted) {
      startTracking();
    }
    return () => {
      stopTracking();
    };
  }, [permissionGranted, startTracking, stopTracking]);

  useEffect(() => {
    const updateStatus = () => {
      if (typeof navigator === 'undefined') return;
      setIsOffline(!navigator.onLine);
    };
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  const handleStopRun = useCallback(async () => {
    const result = await stopRun();
    if (result) {
      const avgPace = distance > 0 ? (duration / 60) / (distance / 1000) : 0;
      const avgSpeed = duration > 0 ? (distance / 1000) / (duration / 3600) : 0;
      setSummaryData({ 
        ...result, 
        distance, 
        duration,
        avgPace,
        avgSpeed
      });
      setShowSummary(true);
    }
  }, [stopRun, distance, duration]);

  const handleNavigate = useCallback((section: ActiveSection) => {
    setActiveSection(section);
  }, []);

  const handleViewUserProfile = useCallback((userId: string) => {
    setViewUserProfileId(userId);
  }, []);

  const handleCloseUserProfile = useCallback(() => {
    setViewUserProfileId(null);
  }, []);

  const handleImportClick = useCallback(() => {
    setActiveSection('home');
    setShowImport(true);
  }, []);

  const handleCloseImport = useCallback(() => {
    setShowImport(false);
  }, []);

  const handleCloseSummary = useCallback(() => {
    setShowSummary(false);
  }, []);

  const handleCloseTutorial = useCallback(() => {
    setShowTutorial(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-2xl font-display font-bold text-primary-foreground">U</span>
            </div>
          </div>
          <p className="text-muted-foreground animate-pulse">Cargando URBANZ...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Lazy load Auth component
    const Auth = lazy(() => import('@/components/Auth'));
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Cargando...</div>
        </div>
      }>
        <Auth />
      </Suspense>
    );
  }

  const renderMobileContent = () => {
    switch (activeSection) {
      case 'home':
        return (
          <main className="pt-16 pb-20 h-screen relative">
            <MapView
              runPath={runPath}
              onMapClick={addPoint}
              isRunning={isRunning && !useGPS}
              currentLocation={currentLocation}
              locationAccuracy={accuracy}
            />
            <RunPredictionOverlay
              runPath={runPath}
              currentLocation={currentLocation}
              isRunning={isRunning}
            />
          </main>
        );
      
      case 'activity':
        return (
          <div className="pt-16 pb-20 h-screen overflow-y-auto bg-background">
            <SubNavTabs tabs={activityTabs} activeTab={activityTab} onTabChange={setActivityTab} />
            <Suspense fallback={<SectionLoader />}>
              {activityTab === 'feed' ? (
                <ActivityFeed onClose={() => setActiveSection('home')} isMobileFullPage />
              ) : (
                <div className="px-4">
                  <RunHistory onClose={() => setActivityTab('feed')} />
                </div>
              )}
            </Suspense>
          </div>
        );
      
      case 'compete':
        return (
          <div className="pt-16 pb-20 h-screen overflow-y-auto bg-background">
            <SubNavTabs tabs={competeTabs} activeTab={competeTab} onTabChange={setCompeteTab} />
            <Suspense fallback={<SectionLoader />}>
              {competeTab === 'leagues' ? (
                <Leagues onClose={() => setActiveSection('home')} isMobileFullPage />
              ) : (
                <Challenges onClose={() => setActiveSection('home')} isMobileFullPage />
              )}
            </Suspense>
          </div>
        );
      
      case 'community':
        return (
          <div className="pt-16 pb-20 h-screen overflow-y-auto bg-background">
            <SubNavTabs tabs={communityTabs} activeTab={communityTab} onTabChange={setCommunityTab} />
            <Suspense fallback={<SectionLoader />}>
              {communityTab === 'friends' ? (
                <Friends 
                  onClose={() => setActiveSection('home')} 
                  isMobileFullPage 
                  onViewUserProfile={handleViewUserProfile}
                />
              ) : (
                <Clans onClose={() => setActiveSection('home')} isMobileFullPage />
              )}
            </Suspense>
          </div>
        );
      
      case 'you':
        return (
          <div className="pt-16 pb-20 h-screen overflow-y-auto bg-background mobile-full-page-content">
            <Suspense fallback={<SectionLoader />}>
              <Profile 
                onClose={() => setActiveSection('home')} 
                isMobileFullPage 
                onImportClick={handleImportClick}
              />
            </Suspense>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {!permissionGranted && (
        <GPSPermissionDialog
          onPermissionGranted={requestPermission}
          onPermissionDenied={() => {}}
        />
      )}

      <Header
        onShowNotifications={() => setShowNotifications(true)}
      />

      <OfflineBanner 
        isOffline={isOffline}
        pendingRunsCount={pendingRunsCount}
        isOfflineSyncing={isOfflineSyncing}
        syncRuns={syncRuns}
      />

      {/* Mobile / Tablet (hasta xl): Full page sections */}
      <div className="xl:hidden">
        {renderMobileContent()}
      </div>

      {/* Desktop: Keep existing behavior */}
      <div className="hidden xl:block">
        <main className="pt-16 h-screen relative">
          <MapView
            runPath={runPath}
            onMapClick={addPoint}
            isRunning={isRunning && !useGPS}
            currentLocation={currentLocation}
            locationAccuracy={accuracy}
          />
          <RunPredictionOverlay
            runPath={runPath}
            currentLocation={currentLocation}
            isRunning={isRunning}
          />
        </main>
      </div>

      <BottomNav activeSection={activeSection} onNavigate={handleNavigate} />

      {activeSection === 'home' && !showSummary && (
        <RunControls
          isRunning={isRunning || isSaving}
          isPaused={isPaused}
          duration={duration}
          distance={distance}
          useGPS={useGPS}
          onStart={startRun}
          onPause={pauseRun}
          onResume={resumeRun}
          onStop={handleStopRun}
        />
      )}

      {/* Desktop modals */}
      <Suspense fallback={null}>
        {showTutorial && <Tutorial onClose={handleCloseTutorial} autoShow={false} />}
        {activeSection === 'home' && !showSummary && !showTutorial && (
          <Tutorial onClose={handleCloseTutorial} autoShow={true} />
        )}
      </Suspense>
      
      <div className="hidden md:block">
        <Suspense fallback={<SectionLoader />}>
          {activeSection === 'you' && (
            <Profile 
              onClose={() => setActiveSection('home')}
              onImportClick={handleImportClick}
            />
          )}
          {activeSection === 'community' && communityTab === 'friends' && (
            <Friends 
              onClose={() => setActiveSection('home')} 
              onViewUserProfile={handleViewUserProfile}
            />
          )}
          {activeSection === 'community' && communityTab === 'clans' && (
            <Clans onClose={() => setActiveSection('home')} />
          )}
          {activeSection === 'compete' && competeTab === 'challenges' && (
            <Challenges onClose={() => setActiveSection('home')} />
          )}
          {activeSection === 'compete' && competeTab === 'leagues' && (
            <Leagues onClose={() => setActiveSection('home')} />
          )}
          {activeSection === 'activity' && (
            <ActivityFeed onClose={() => setActiveSection('home')} />
          )}
        </Suspense>
      </div>
      
      {showImport && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg">
            <div className="mb-4 flex justify-end">
              <button
                onClick={handleCloseImport}
                className="text-muted-foreground hover:text-foreground text-2xl px-3"
              >
                ✕
              </button>
            </div>
            <Suspense fallback={<SectionLoader />}>
              <ImportRun onImportComplete={handleCloseImport} />
            </Suspense>
          </div>
        </div>
      )}

      {viewUserProfileId && (
        <Suspense fallback={<SectionLoader />}>
          <UserProfile 
            userId={viewUserProfileId} 
            onClose={handleCloseUserProfile} 
          />
        </Suspense>
      )}
      
      {showSummary && summaryData && (
        <RunSummary
          conquered={summaryData.conquered}
          stolen={summaryData.stolen}
          lost={summaryData.lost}
          pointsGained={summaryData.pointsGained}
          distance={summaryData.distance}
          duration={summaryData.duration}
          avgPace={summaryData.avgPace}
          avgSpeed={summaryData.avgSpeed}
          onClose={handleCloseSummary}
        />
      )}

      {showNotifications && (
        <Suspense fallback={<SectionLoader />}>
          <Notifications onClose={() => setShowNotifications(false)} isMobileFullPage />
        </Suspense>
      )}

      <Toaster />
    </div>
  );
};

export default Index;

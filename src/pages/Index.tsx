import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import BottomNav, { ActiveSection } from '@/components/BottomNav';
import SubNavTabs from '@/components/SubNavTabs';
import MapView from '@/components/MapView';
import RunControls from '@/components/RunControls';
import Leagues from '@/components/Leagues';
import Profile from '@/components/Profile';
import RunSummary from '@/components/RunSummary';
import Tutorial from '@/components/Tutorial';
import Friends from '@/components/Friends';
import Challenges from '@/components/Challenges';
import ActivityFeed from '@/components/ActivityFeed';
import Notifications from '@/components/Notifications';
import Auth from '@/components/Auth';
import GPSPermissionDialog from '@/components/GPSPermissionDialog';
import UserProfile from '@/components/UserProfile';
import { useRun } from '@/hooks/useRun';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import { Toaster } from '@/components/ui/sonner';
import { ImportRun } from '@/components/ImportRun';
import { RunPredictionOverlay } from '@/components/RunPredictionOverlay';
import { RunHistory } from '@/components/RunHistory';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Clans from '@/components/Clans';

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

const Index = () => {
  const { user, loading } = useAuth();
  const [activeSection, setActiveSection] = useState<ActiveSection>('home');
  const [activityTab, setActivityTab] = useState('feed');
  const [competeTab, setCompeteTab] = useState('leagues');
  const [communityTab, setCommunityTab] = useState('friends');
  const [showSummary, setShowSummary] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
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

  const handleStopRun = async () => {
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
  };

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
    return <Auth />;
  }

  const handleNavigate = (section: ActiveSection) => {
    setActiveSection(section);
  };

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
            {activityTab === 'feed' ? (
              <ActivityFeed onClose={() => setActiveSection('home')} isMobileFullPage />
            ) : (
              <div className="px-4">
                <RunHistory onClose={() => setActivityTab('feed')} />
              </div>
            )}
          </div>
        );
      
      case 'compete':
        return (
          <div className="pt-16 pb-20 h-screen overflow-y-auto bg-background">
            <SubNavTabs tabs={competeTabs} activeTab={competeTab} onTabChange={setCompeteTab} />
            {competeTab === 'leagues' ? (
              <Leagues onClose={() => setActiveSection('home')} isMobileFullPage />
            ) : (
              <Challenges onClose={() => setActiveSection('home')} isMobileFullPage />
            )}
          </div>
        );
      
      case 'community':
        return (
          <div className="pt-16 pb-20 h-screen overflow-y-auto bg-background">
            <SubNavTabs tabs={communityTabs} activeTab={communityTab} onTabChange={setCommunityTab} />
            {communityTab === 'friends' ? (
              <Friends 
                onClose={() => setActiveSection('home')} 
                isMobileFullPage 
                onViewUserProfile={(userId) => setViewUserProfileId(userId)}
              />
            ) : (
              <Clans onClose={() => setActiveSection('home')} isMobileFullPage />
            )}
          </div>
        );
      
      case 'you':
        return (
          <div className="pt-16 pb-20 h-screen overflow-y-auto bg-background mobile-full-page-content">
            <Profile 
              onClose={() => setActiveSection('home')} 
              isMobileFullPage 
              onImportClick={() => {
                setActiveSection('home');
                setShowImport(true);
              }}
              onHistoryClick={() => {
                setActiveSection('activity');
                setActivityTab('history');
              }}
            />
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
        onShowRanking={() => { setActiveSection('compete'); setCompeteTab('leagues'); }}
        onShowProfile={() => setActiveSection('you')}
        onShowFriends={() => { setActiveSection('community'); setCommunityTab('friends'); }}
        onShowChallenges={() => { setActiveSection('compete'); setCompeteTab('challenges'); }}
        onShowClans={() => { setActiveSection('community'); setCommunityTab('clans'); }}
        onShowFeed={() => { setActiveSection('activity'); setActivityTab('feed'); }}
        onShowNotifications={() => setActiveSection('you')}
      />

      {(isOffline || pendingRunsCount > 0) && (
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
      )}

      {/* Mobile: Full page sections */}
      <div className="md:hidden">
        {renderMobileContent()}
      </div>

      {/* Desktop: Keep existing behavior */}
      <div className="hidden md:block">
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
      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} autoShow={false} />}
      {activeSection === 'home' && !showSummary && !showTutorial && (
        <Tutorial onClose={() => setShowTutorial(false)} autoShow={true} />
      )}
      
      <div className="hidden md:block">
        {activeSection === 'you' && (
          <Profile 
            onClose={() => setActiveSection('home')}
            onImportClick={() => {
              setActiveSection('home');
              setShowImport(true);
            }}
            onHistoryClick={() => {
              setActiveSection('activity');
              setActivityTab('history');
            }}
          />
        )}
        {activeSection === 'community' && communityTab === 'friends' && (
          <Friends 
            onClose={() => setActiveSection('home')} 
            onViewUserProfile={(userId) => setViewUserProfileId(userId)}
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
      </div>
      
      {showImport && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg">
            <div className="mb-4 flex justify-end">
              <button
                onClick={() => setShowImport(false)}
                className="text-muted-foreground hover:text-foreground text-2xl px-3"
              >
                ✕
              </button>
            </div>
            <ImportRun onImportComplete={() => setShowImport(false)} />
          </div>
        </div>
      )}

      {viewUserProfileId && (
        <UserProfile 
          userId={viewUserProfileId} 
          onClose={() => setViewUserProfileId(null)} 
        />
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
          onClose={() => setShowSummary(false)}
        />
      )}

      <Toaster />
    </div>
  );
};

export default Index;

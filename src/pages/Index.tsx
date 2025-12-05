import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
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

const Index = () => {
  const { user, loading } = useAuth();
  const [activeSection, setActiveSection] = useState<'home' | 'challenges' | 'friends' | 'feed' | 'notifications' | 'profile' | 'leagues' | 'clans'>('home');
  const [showLeagues, setShowLeagues] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
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

  // Iniciar tracking cuando se conceden permisos
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

  return (
    <div className="min-h-screen bg-background">
      {/* Dialog de permisos GPS */}
      {!permissionGranted && (
        <GPSPermissionDialog
          onPermissionGranted={requestPermission}
          onPermissionDenied={() => {}}
        />
      )}

      <Header
        onShowRanking={() => setShowLeagues(true)}
        onShowProfile={() => setActiveSection('profile')}
        onShowFriends={() => setActiveSection('friends')}
        onShowChallenges={() => setActiveSection('challenges')}
        onShowClans={() => setActiveSection('clans')}
        onShowFeed={() => setActiveSection('feed')}
        onShowNotifications={() => setActiveSection('notifications')}
      />

      {(isOffline || pendingRunsCount > 0) && (
        <div className="px-4 mt-2">
          <Card className="p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-muted/20 border-dashed border-border">
            <div>
              <p className="text-sm font-semibold flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${isOffline ? 'bg-amber-400 animate-pulse' : 'bg-primary'}`} />
                {isOffline ? 'Modo offline activo' : 'Carreras pendientes de sincronizar'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isOffline
                  ? 'Seguiremos guardando tus carreras y las subiremos cuando recuperes conexión.'
                  : `Tienes ${pendingRunsCount} carrera${pendingRunsCount === 1 ? '' : 's'} esperando sincronización.`}
              </p>
            </div>
            {pendingRunsCount > 0 && (
              <Button
                size="sm"
                onClick={syncRuns}
                disabled={isOffline || isOfflineSyncing}
              >
                {isOfflineSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
              </Button>
            )}
          </Card>
        </div>
      )}

      {/* Mobile: Full page sections */}
      <div className="md:hidden">
        {activeSection === 'home' && (
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
        )}
        {activeSection === 'challenges' && (
          <div className="pt-16 pb-20 h-screen overflow-y-auto bg-background mobile-full-page-content">
            <Challenges onClose={() => setActiveSection('home')} isMobileFullPage />
          </div>
        )}
        {activeSection === 'friends' && (
          <div className="pt-16 pb-20 h-screen overflow-y-auto bg-background mobile-full-page-content">
            <Friends 
              onClose={() => setActiveSection('home')} 
              isMobileFullPage 
              onViewUserProfile={(userId) => setViewUserProfileId(userId)}
            />
          </div>
        )}
        {activeSection === 'clans' && (
          <div className="pt-16 pb-20 h-screen overflow-y-auto bg-background mobile-full-page-content">
            <Clans onClose={() => setActiveSection('home')} isMobileFullPage />
          </div>
        )}
        {activeSection === 'feed' && (
          <div className="pt-16 pb-20 h-screen overflow-y-auto bg-background mobile-full-page-content">
            <ActivityFeed onClose={() => setActiveSection('home')} isMobileFullPage />
          </div>
        )}
        {activeSection === 'notifications' && (
          <div className="pt-16 pb-20 h-screen overflow-y-auto bg-background mobile-full-page-content">
            <Notifications onClose={() => setActiveSection('home')} isMobileFullPage />
          </div>
        )}
        {activeSection === 'profile' && (
          <div className="pt-16 pb-20 h-screen overflow-y-auto bg-background mobile-full-page-content">
            <Profile 
              onClose={() => setActiveSection('home')} 
              isMobileFullPage 
              onImportClick={() => {
                setActiveSection('home');
                setShowImport(true);
              }}
              onHistoryClick={() => {
                setActiveSection('home');
                setShowHistory(true);
              }}
            />
          </div>
        )}
        {activeSection === 'leagues' && (
          <div className="pt-16 pb-20 h-screen overflow-y-auto bg-background mobile-full-page-content">
            <Leagues onClose={() => setActiveSection('home')} isMobileFullPage />
          </div>
        )}
      </div>

      {/* Desktop: Keep modal behavior */}
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

      <BottomNav
        activeSection={activeSection as 'home' | 'challenges' | 'friends' | 'feed' | 'leagues' | 'clans'}
        onShowHome={() => setActiveSection('home')}
        onShowChallenges={() => setActiveSection('challenges')}
        onShowFriends={() => setActiveSection('friends')}
        onShowFeed={() => setActiveSection('feed')}
        onShowRanking={() => setActiveSection('leagues')}
        onShowClans={() => setActiveSection('clans')}
      />

      {activeSection === 'home' && !showSummary && !showHistory && (
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
      {showLeagues && <Leagues onClose={() => setShowLeagues(false)} />}
      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} autoShow={false} />}
      {activeSection === 'home' && !showLeagues && !showSummary && !showTutorial && (
        <Tutorial onClose={() => setShowTutorial(false)} autoShow={true} />
      )}
      
      {/* Desktop: Show modals for sections */}
      <div className="hidden md:block">
        {activeSection === 'profile' && (
          <Profile 
            onClose={() => setActiveSection('home')}
            onImportClick={() => {
              setActiveSection('home');
              setShowImport(true);
            }}
            onHistoryClick={() => {
              setActiveSection('home');
              setShowHistory(true);
            }}
          />
        )}
        {activeSection === 'friends' && (
          <Friends 
            onClose={() => setActiveSection('home')} 
            onViewUserProfile={(userId) => setViewUserProfileId(userId)}
          />
        )}
        {activeSection === 'challenges' && <Challenges onClose={() => setActiveSection('home')} />}
        {activeSection === 'feed' && <ActivityFeed onClose={() => setActiveSection('home')} />}
        {activeSection === 'notifications' && <Notifications onClose={() => setActiveSection('home')} />}
        {activeSection === 'clans' && <Clans onClose={() => setActiveSection('home')} />}
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

      {showHistory && (
        <div className="fixed inset-0 z-50 md:bg-background/80 md:backdrop-blur-sm md:flex md:items-center md:justify-center md:p-4">
          <RunHistory onClose={() => setShowHistory(false)} />
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

import { useState, useEffect } from 'react';

interface TerritoryDiagramProps {
  className?: string;
}

const TerritoryDiagram = ({ className = '' }: TerritoryDiagramProps) => {
  const [animationStep, setAnimationStep] = useState(0);
  const [showLabels, setShowLabels] = useState(false);

  useEffect(() => {
    // Animate through steps
    const timer = setInterval(() => {
      setAnimationStep((prev) => (prev + 1) % 4);
    }, 2500);

    const labelTimer = setTimeout(() => setShowLabels(true), 500);

    return () => {
      clearInterval(timer);
      clearTimeout(labelTimer);
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* Title tabs */}
      <div className="flex justify-center gap-2 mb-4">
        <button
          onClick={() => setAnimationStep(0)}
          className={`px-3 py-1 text-xs rounded-full transition-all ${
            animationStep === 0 || animationStep === 1
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          Robo parcial
        </button>
        <button
          onClick={() => setAnimationStep(2)}
          className={`px-3 py-1 text-xs rounded-full transition-all ${
            animationStep === 2 || animationStep === 3
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          Conquista total
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-center justify-center">
        {/* Scenario 1: Partial overlap */}
        <div className={`transition-all duration-500 ${animationStep < 2 ? 'opacity-100 scale-100' : 'opacity-40 scale-95'}`}>
          <div className="text-center mb-2">
            <span className="text-xs font-semibold text-muted-foreground">ROBO PARCIAL</span>
          </div>
          <svg
            viewBox="0 0 200 160"
            className="w-48 h-40 md:w-56 md:h-44"
            role="img"
            aria-label="Diagrama de robo parcial de territorio"
          >
            {/* Background grid */}
            <defs>
              <pattern id="grid1" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />
              </pattern>
              <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(210, 100%, 60%)" />
                <stop offset="100%" stopColor="hsl(210, 100%, 40%)" />
              </linearGradient>
              <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(142, 76%, 50%)" />
                <stop offset="100%" stopColor="hsl(142, 76%, 36%)" />
              </linearGradient>
              <linearGradient id="redGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(0, 84%, 60%)" />
                <stop offset="100%" stopColor="hsl(0, 84%, 45%)" />
              </linearGradient>
            </defs>
            <rect width="200" height="160" fill="url(#grid1)" />

            {/* Original large territory (blue - defender) */}
            <polygon
              points="30,30 170,30 170,130 30,130"
              fill="url(#blueGrad)"
              fillOpacity="0.4"
              stroke="hsl(210, 100%, 50%)"
              strokeWidth="2"
              className="transition-all duration-500"
            />

            {/* Attacker's run path (green) - smaller area inside */}
            <polygon
              points="50,50 100,50 100,100 50,100"
              fill="url(#greenGrad)"
              fillOpacity={animationStep === 1 ? 0.7 : 0.3}
              stroke="hsl(142, 76%, 45%)"
              strokeWidth="2"
              strokeDasharray={animationStep === 0 ? "5,5" : "0"}
              className="transition-all duration-700"
            />

            {/* Runner icon */}
            <g className={`transition-all duration-700 ${animationStep === 1 ? 'opacity-100' : 'opacity-70'}`}>
              <circle
                cx={animationStep === 0 ? 50 : 75}
                cy={animationStep === 0 ? 50 : 75}
                r="8"
                fill="hsl(142, 76%, 45%)"
                className="transition-all duration-1000"
              />
              <text
                x={animationStep === 0 ? 50 : 75}
                y={animationStep === 0 ? 53 : 78}
                textAnchor="middle"
                fill="white"
                fontSize="10"
                className="transition-all duration-1000"
              >
                🏃
              </text>
            </g>

            {/* Labels */}
            {showLabels && (
              <>
                <text x="150" y="25" textAnchor="end" fill="hsl(210, 100%, 60%)" fontSize="10" fontWeight="bold">
                  Territorio A
                </text>
                <text x="75" y="115" textAnchor="middle" fill="hsl(142, 76%, 45%)" fontSize="9" fontWeight="bold">
                  {animationStep === 1 ? '¡Robado!' : 'Tu carrera'}
                </text>
              </>
            )}

            {/* Result indicator */}
            {animationStep === 1 && (
              <g className="animate-fade-in">
                <rect x="105" y="55" width="60" height="35" rx="4" fill="hsl(var(--card))" stroke="hsl(var(--border))" />
                <text x="135" y="70" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="8">
                  Resto sigue
                </text>
                <text x="135" y="82" textAnchor="middle" fill="hsl(210, 100%, 60%)" fontSize="8" fontWeight="bold">
                  siendo de A
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Arrow separator */}
        <div className="hidden md:flex flex-col items-center text-muted-foreground">
          <span className="text-2xl">vs</span>
        </div>

        {/* Scenario 2: Complete encirclement */}
        <div className={`transition-all duration-500 ${animationStep >= 2 ? 'opacity-100 scale-100' : 'opacity-40 scale-95'}`}>
          <div className="text-center mb-2">
            <span className="text-xs font-semibold text-muted-foreground">CONQUISTA TOTAL</span>
          </div>
          <svg
            viewBox="0 0 200 160"
            className="w-48 h-40 md:w-56 md:h-44"
            role="img"
            aria-label="Diagrama de conquista total de territorio"
          >
            <defs>
              <pattern id="grid2" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />
              </pattern>
            </defs>
            <rect width="200" height="160" fill="url(#grid2)" />

            {/* Large territory (attacker's new run - green) */}
            <polygon
              points="20,20 180,20 180,140 20,140"
              fill="url(#greenGrad)"
              fillOpacity={animationStep === 3 ? 0.6 : 0.3}
              stroke="hsl(142, 76%, 45%)"
              strokeWidth="2"
              strokeDasharray={animationStep === 2 ? "5,5" : "0"}
              className="transition-all duration-700"
            />

            {/* Small territory inside (original - being consumed) */}
            <polygon
              points="70,55 130,55 130,105 70,105"
              fill={animationStep === 3 ? "url(#greenGrad)" : "url(#redGrad)"}
              fillOpacity={animationStep === 3 ? 0.8 : 0.5}
              stroke={animationStep === 3 ? "hsl(142, 76%, 45%)" : "hsl(0, 84%, 50%)"}
              strokeWidth="2"
              className="transition-all duration-700"
            />

            {/* Runner icon */}
            <g className={`transition-all duration-700 ${animationStep === 3 ? 'opacity-100' : 'opacity-70'}`}>
              <circle
                cx={animationStep === 2 ? 20 : 100}
                cy={animationStep === 2 ? 80 : 20}
                r="8"
                fill="hsl(142, 76%, 45%)"
                className="transition-all duration-1000"
              />
              <text
                x={animationStep === 2 ? 20 : 100}
                y={animationStep === 2 ? 83 : 23}
                textAnchor="middle"
                fill="white"
                fontSize="10"
                className="transition-all duration-1000"
              >
                🏃
              </text>
            </g>

            {/* Labels */}
            {showLabels && (
              <>
                <text x="100" y="135" textAnchor="middle" fill="hsl(142, 76%, 45%)" fontSize="10" fontWeight="bold">
                  Tu nuevo territorio
                </text>
                <text x="100" y="80" textAnchor="middle" fill={animationStep === 3 ? "hsl(142, 76%, 45%)" : "hsl(0, 84%, 50%)"} fontSize="9" fontWeight="bold">
                  {animationStep === 3 ? '¡Conquistado!' : 'Territorio B'}
                </text>
              </>
            )}

            {/* Victory indicator */}
            {animationStep === 3 && (
              <g className="animate-scale-in">
                <circle cx="100" cy="80" r="20" fill="hsl(142, 76%, 45%)" fillOpacity="0.3">
                  <animate attributeName="r" values="20;30;20" dur="1s" repeatCount="indefinite" />
                  <animate attributeName="fill-opacity" values="0.3;0.1;0.3" dur="1s" repeatCount="indefinite" />
                </circle>
                <text x="100" y="85" textAnchor="middle" fontSize="16">
                  ✓
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'hsl(210, 100%, 50%)' }} />
          <span className="text-muted-foreground">Territorio ajeno</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'hsl(142, 76%, 45%)' }} />
          <span className="text-muted-foreground">Tu carrera</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'hsl(0, 84%, 50%)' }} />
          <span className="text-muted-foreground">Territorio pequeño</span>
        </div>
      </div>

      {/* Key insight */}
      <div className="mt-4 text-center">
        <p className="text-xs text-muted-foreground px-4 py-2 bg-primary/5 rounded-lg inline-block">
          💡 <strong>Clave:</strong> Rodear completamente = conquista total. Superponer parcialmente = solo te quedas con esa porción.
        </p>
      </div>
    </div>
  );
};

export default TerritoryDiagram;

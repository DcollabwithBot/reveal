import { createContext, useContext, useState, useCallback, useRef } from "react";
import Joyride, { ACTIONS, EVENTS, STATUS } from "react-joyride";
import { TOUR_STEPS, TOUR_TOTAL_STEPS } from "./tourSteps.js";
import { handleError } from "../lib/errorHandler.js";

// ─── Context ─────────────────────────────────────────────────────────────────

const TourContext = createContext(null);

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function TourTooltip({ continuous, index, step, backProps, closeProps, primaryProps, tooltipProps, skipProps }) {
  const total = TOUR_TOTAL_STEPS;

  return (
    <div
      {...tooltipProps}
      style={{
        background: "var(--bg2, #111116)",
        border: "1px solid var(--jade, #00c896)",
        borderRadius: "var(--radius-lg, 14px)",
        padding: "20px 22px 16px",
        maxWidth: 320,
        boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,200,150,0.12)",
        fontFamily: "var(--sans, 'DM Sans', system-ui, sans-serif)",
        color: "var(--text, #f4f4f6)",
        position: "relative",
      }}
    >
      {/* Progress bar */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        background: "var(--border, #1e1e26)",
        borderRadius: "var(--radius-lg, 14px) var(--radius-lg, 14px) 0 0",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: `${((index + 1) / total) * 100}%`,
          background: "var(--jade, #00c896)",
          transition: "width 0.3s ease",
        }} />
      </div>

      {/* Step label */}
      <div style={{
        fontSize: 10,
        color: "var(--jade, #00c896)",
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginBottom: 8,
      }}>
        Trin {index + 1} af {total}
      </div>

      {/* Title */}
      {step.title && (
        <div style={{
          fontSize: 15,
          fontWeight: 700,
          marginBottom: 8,
          color: "var(--text, #f4f4f6)",
          lineHeight: 1.3,
        }}>
          {step.title}
        </div>
      )}

      {/* Content */}
      <div style={{
        fontSize: 13,
        color: "var(--text2, #8888a0)",
        lineHeight: 1.55,
        marginBottom: 16,
      }}>
        {step.content}
      </div>

      {/* Actions */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}>
        {/* Skip always visible */}
        <button
          {...skipProps}
          style={{
            background: "none",
            border: "none",
            fontSize: 11,
            color: "var(--text3, #55556a)",
            cursor: "pointer",
            padding: "4px 0",
            textDecoration: "underline",
            fontFamily: "inherit",
          }}
        >
          Spring over
        </button>

        <div style={{ display: "flex", gap: 8 }}>
          {index > 0 && (
            <button
              {...backProps}
              style={{
                background: "var(--bg3, #16161d)",
                border: "1px solid var(--border2, #2a2a36)",
                borderRadius: "var(--radius, 8px)",
                fontSize: 12,
                color: "var(--text2, #8888a0)",
                cursor: "pointer",
                padding: "6px 14px",
                fontFamily: "inherit",
                fontWeight: 500,
              }}
            >
              ← Tilbage
            </button>
          )}
          <button
            {...primaryProps}
            style={{
              background: "var(--jade, #00c896)",
              border: "none",
              borderRadius: "var(--radius, 8px)",
              fontSize: 12,
              color: "#0c0c0f",
              cursor: "pointer",
              padding: "6px 16px",
              fontFamily: "inherit",
              fontWeight: 700,
              boxShadow: "0 0 12px rgba(0,200,150,0.35)",
            }}
          >
            {continuous && index < total - 1 ? "Næste →" : "Afslut ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TourProvider({ children }) {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [mode, setMode] = useState(null); // 'demo' | 'onboarding' | 'explore'
  const onCompleteRef = useRef(null);
  const onSkipRef = useRef(null);

  const startTour = useCallback((tourMode = "explore", { onComplete, onSkip } = {}) => {
    try {
      setMode(tourMode);
      setStepIndex(0);
      setRun(true);
      onCompleteRef.current = onComplete || null;
      onSkipRef.current = onSkip || null;
    } catch (err) {
      handleError(err, "tour-start");
    }
  }, []);

  const skipTour = useCallback(() => {
    setRun(false);
    if (onSkipRef.current) {
      try { onSkipRef.current(); } catch (e) { handleError(e, "tour-skip-callback"); }
    }
  }, []);

  function handleJoyrideCallback(data) {
    const { action, index, status, type } = data;

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
    }

    if (status === STATUS.FINISHED) {
      setRun(false);
      if (onCompleteRef.current) {
        try { onCompleteRef.current(); } catch (e) { handleError(e, "tour-complete-callback"); }
      }
    }

    if (status === STATUS.SKIPPED || action === ACTIONS.SKIP || action === ACTIONS.CLOSE) {
      setRun(false);
      if (onSkipRef.current) {
        try { onSkipRef.current(); } catch (e) { handleError(e, "tour-skip-callback"); }
      }
    }
  }

  const value = {
    startTour,
    skipTour,
    isActive: run,
    currentStep: stepIndex,
    mode,
  };

  return (
    <TourContext.Provider value={value}>
      <Joyride
        steps={TOUR_STEPS}
        run={run}
        stepIndex={stepIndex}
        continuous
        scrollToFirstStep
        showSkipButton
        disableOverlayClose
        tooltipComponent={TourTooltip}
        callback={handleJoyrideCallback}
        styles={{
          options: {
            zIndex: 10000,
            arrowColor: "var(--bg2, #111116)",
            overlayColor: "rgba(0,0,0,0.72)",
            spotlightShadow: "0 0 30px rgba(0,200,150,0.25)",
          },
          spotlight: {
            borderRadius: 10,
          },
        }}
        floaterProps={{
          disableAnimation: false,
        }}
      />
      {children}
    </TourContext.Provider>
  );
}

// ─── Export context for useTour ───────────────────────────────────────────────
export { TourContext };

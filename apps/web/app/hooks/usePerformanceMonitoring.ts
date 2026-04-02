import { useEffect, useRef, useCallback } from "react";

/**
 * Performance Monitoring Hook
 * Tracks Core Web Vitals and custom performance metrics
 */
export function usePerformanceMonitoring() {
  const metricsRef = useRef<Map<string, number>>(new Map());
  const observersRef = useRef<PerformanceObserver[]>([]);

  const sendMetrics = useCallback((metrics: Record<string, unknown>) => {
    // Send to analytics endpoint
    if (typeof window !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/analytics/performance",
        JSON.stringify(metrics)
      );
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Track Largest Contentful Paint (LCP)
    if ("PerformanceObserver" in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];

          if (lastEntry) {
            metricsRef.current.set("LCP", lastEntry.startTime);

            // Send if LCP is poor (>2.5s)
            if (lastEntry.startTime > 2500) {
              sendMetrics({
                metric: "LCP",
                value: lastEntry.startTime,
                url: window.location.href,
                timestamp: Date.now(),
                severity: lastEntry.startTime > 4000 ? "critical" : "warning",
              });
            }
          }
        });

        lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });
        observersRef.current.push(lcpObserver);
      } catch {
        // LCP not supported
      }

      // Track First Input Delay (FID)
      try {
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const fidEntry = entry as PerformanceEventTiming;
            metricsRef.current.set(
              "FID",
              fidEntry.processingStart - fidEntry.startTime
            );

            // Send if FID is poor (>100ms)
            if (fidEntry.processingStart - fidEntry.startTime > 100) {
              sendMetrics({
                metric: "FID",
                value: fidEntry.processingStart - fidEntry.startTime,
                url: window.location.href,
                timestamp: Date.now(),
                severity:
                  fidEntry.processingStart - fidEntry.startTime > 300
                    ? "critical"
                    : "warning",
              });
            }
          }
        });

        fidObserver.observe({ entryTypes: ["first-input"] });
        observersRef.current.push(fidObserver);
      } catch {
        // FID not supported
      }

      // Track Cumulative Layout Shift (CLS)
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const layoutShiftEntry = entry as unknown as {
              hadRecentInput: boolean;
              value: number;
            };
            if (!layoutShiftEntry.hadRecentInput) {
              clsValue += layoutShiftEntry.value;
            }
          }

          metricsRef.current.set("CLS", clsValue);

          // Send if CLS is poor (>0.1)
          if (clsValue > 0.1) {
            sendMetrics({
              metric: "CLS",
              value: clsValue,
              url: window.location.href,
              timestamp: Date.now(),
              severity: clsValue > 0.25 ? "critical" : "warning",
            });
          }
        });

        clsObserver.observe({ entryTypes: ["layout-shift"] });
        observersRef.current.push(clsObserver);
      } catch {
        // CLS not supported
      }

      // Track First Contentful Paint (FCP)
      try {
        const fcpObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === "first-contentful-paint") {
              metricsRef.current.set("FCP", entry.startTime);

              // Send if FCP is poor (>1.8s)
              if (entry.startTime > 1800) {
                sendMetrics({
                  metric: "FCP",
                  value: entry.startTime,
                  url: window.location.href,
                  timestamp: Date.now(),
                  severity: entry.startTime > 3000 ? "critical" : "warning",
                });
              }
            }
          }
        });

        fcpObserver.observe({ entryTypes: ["paint"] });
        observersRef.current.push(fcpObserver);
      } catch {
        // FCP not supported
      }
    }

    // Track Time to First Byte (TTFB)
    const navigation = performance.getEntriesByType(
      "navigation"
    )[0] as PerformanceNavigationTiming;
    if (navigation) {
      const ttfb = navigation.responseStart - navigation.startTime;
      metricsRef.current.set("TTFB", ttfb);

      if (ttfb > 600) {
        sendMetrics({
          metric: "TTFB",
          value: ttfb,
          url: window.location.href,
          timestamp: Date.now(),
          severity: ttfb > 1000 ? "critical" : "warning",
        });
      }
    }

    return () => {
      observersRef.current.forEach((observer) => observer.disconnect());
      observersRef.current = [];
    };
  }, [sendMetrics]);

  const trackCustomMetric = useCallback(
    (name: string, value: number) => {
      metricsRef.current.set(name, value);

      sendMetrics({
        metric: name,
        value,
        url: typeof window !== "undefined" ? window.location.href : "",
        timestamp: Date.now(),
      });
    },
    [sendMetrics]
  );

  const getMetrics = useCallback(() => {
    return Object.fromEntries(metricsRef.current);
  }, []);

  return {
    trackCustomMetric,
    getMetrics,
  };
}

/**
 * Component render performance tracking
 */
export function useComponentPerformance(componentName: string) {
  const renderCountRef = useRef(0);
  const renderTimeRef = useRef<number[]>([]);
  const { trackCustomMetric } = usePerformanceMonitoring();

  useEffect(() => {
    const startTime = performance.now();
    renderCountRef.current++;

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      renderTimeRef.current.push(renderTime);

      // Alert if render time is excessive (>100ms)
      if (renderTime > 100) {
        trackCustomMetric(`${componentName}_slow_render`, renderTime);
        console.warn(
          `[Performance] ${componentName} slow render: ${renderTime.toFixed(2)}ms`
        );
      }

      // Alert if excessive re-renders (>10 in 5 seconds)
      if (renderCountRef.current > 10) {
        trackCustomMetric(
          `${componentName}_excessive_renders`,
          renderCountRef.current
        );
        console.warn(
          `[Performance] ${componentName} excessive renders: ${renderCountRef.current}`
        );
      }
    };
  }, [componentName, trackCustomMetric]);

  return {
    renderCount: renderCountRef.current,
    averageRenderTime:
      renderTimeRef.current.length > 0
        ? renderTimeRef.current.reduce((a, b) => a + b, 0) /
          renderTimeRef.current.length
        : 0,
  };
}

/**
 * API performance tracking
 */
export function useApiPerformance() {
  const requestTimesRef = useRef<Map<string, number[]>>(new Map());
  const { trackCustomMetric } = usePerformanceMonitoring();

  const trackRequest = useCallback(
    (endpoint: string, duration: number, success: boolean) => {
      const times = requestTimesRef.current.get(endpoint) || [];
      times.push(duration);
      requestTimesRef.current.set(endpoint, times);

      // Track slow requests (>1s)
      if (duration > 1000) {
        trackCustomMetric(`api_slow_${endpoint}`, duration);
        console.warn(
          `[API Performance] Slow request to ${endpoint}: ${duration.toFixed(2)}ms`
        );
      }

      // Track failed requests
      if (!success) {
        trackCustomMetric(`api_error_${endpoint}`, 1);
      }
    },
    [trackCustomMetric]
  );

  const getSlowestEndpoints = useCallback((limit = 5) => {
    const endpointStats = Array.from(requestTimesRef.current.entries()).map(
      ([endpoint, times]) => ({
        endpoint,
        average: times.reduce((a, b) => a + b, 0) / times.length,
        max: Math.max(...times),
        count: times.length,
      })
    );

    return endpointStats.sort((a, b) => b.average - a.average).slice(0, limit);
  }, []);

  return {
    trackRequest,
    getSlowestEndpoints,
  };
}

/**
 * User interaction performance tracking
 */
export function useInteractionPerformance() {
  const pendingInteractionsRef = useRef<Map<string, number>>(new Map());
  const { trackCustomMetric } = usePerformanceMonitoring();

  const startInteraction = useCallback((interactionId: string) => {
    pendingInteractionsRef.current.set(interactionId, performance.now());
  }, []);

  const endInteraction = useCallback(
    (interactionId: string, success: boolean = true) => {
      const startTime = pendingInteractionsRef.current.get(interactionId);
      if (startTime) {
        const duration = performance.now() - startTime;
        pendingInteractionsRef.current.delete(interactionId);

        trackCustomMetric(`interaction_${interactionId}`, duration);

        // Alert on slow interactions (>500ms)
        if (duration > 500) {
          console.warn(
            `[Interaction Performance] Slow interaction ${interactionId}: ${duration.toFixed(2)}ms`
          );
        }

        if (!success) {
          trackCustomMetric(`interaction_${interactionId}_failed`, 1);
        }

        return duration;
      }
      return null;
    },
    [trackCustomMetric]
  );

  return {
    startInteraction,
    endInteraction,
  };
}

export default usePerformanceMonitoring;

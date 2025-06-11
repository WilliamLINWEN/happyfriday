// performance-monitor.ts - Utilities for performance monitoring and analytics
import { performance } from 'perf_hooks';

export class PerformanceMonitor {
  private static timings: Record<string, number[]> = {};

  static start(label: string): number {
    return performance.now();
  }

  static end(label: string, startTime: number): number {
    const duration = performance.now() - startTime;
    if (!this.timings[label]) this.timings[label] = [];
    this.timings[label].push(duration);
    return duration;
  }

  static getStats(label: string) {
    const times = this.timings[label] || [];
    if (times.length === 0) return { avg: 0, min: 0, max: 0, count: 0 };
    const sum = times.reduce((a, b) => a + b, 0);
    return {
      avg: sum / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      count: times.length
    };
  }

  static reset(label?: string) {
    if (label) delete this.timings[label];
    else this.timings = {};
  }
}

"use client";

import { useEffect, useRef } from "react";

type Point = { x: number; y: number; vx: number; vy: number; r: number };

// Decorative drifting constellation for the login screen. Colours come from the
// app tokens (--silver for stars, --gold for links). Static when the user prefers
// reduced motion; paused while the tab is hidden.
export function ConstellationBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const styles = getComputedStyle(document.documentElement);
    const star = styles.getPropertyValue("--silver").trim() || "#b7c4d4";
    const link = styles.getPropertyValue("--gold").trim() || "#e29a2b";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const LINK_DISTANCE = 140;

    let points: Point[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Density scales with the screen, capped for small phones and big monitors.
      const count = Math.max(28, Math.min(90, Math.round((width * height) / 14000)));
      points = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.4 + 0.8,
      }));
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const dx = points[i].x - points[j].x;
          const dy = points[i].y - points[j].y;
          const distance = Math.hypot(dx, dy);
          if (distance < LINK_DISTANCE) {
            ctx!.globalAlpha = (1 - distance / LINK_DISTANCE) * 0.5;
            ctx!.strokeStyle = link;
            ctx!.lineWidth = 0.8;
            ctx!.beginPath();
            ctx!.moveTo(points[i].x, points[i].y);
            ctx!.lineTo(points[j].x, points[j].y);
            ctx!.stroke();
          }
        }
      }
      ctx!.globalAlpha = 0.85;
      ctx!.fillStyle = star;
      for (const point of points) {
        ctx!.beginPath();
        ctx!.arc(point.x, point.y, point.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    function step() {
      for (const point of points) {
        point.x += point.vx;
        point.y += point.vy;
        if (point.x < 0 || point.x > width) point.vx *= -1;
        if (point.y < 0 || point.y > height) point.vy *= -1;
      }
      draw();
      frame = requestAnimationFrame(step);
    }

    function start() {
      cancelAnimationFrame(frame);
      if (reduceMotion) draw();
      else frame = requestAnimationFrame(step);
    }

    function onVisibility() {
      if (document.hidden) cancelAnimationFrame(frame);
      else start();
    }

    resize();
    start();
    const onResize = () => {
      resize();
      start();
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 h-full w-full"
    />
  );
}

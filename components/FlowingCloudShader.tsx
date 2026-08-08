"use client";

import { useEffect, useRef } from "react";

export type CloudPalette = "coral" | "magenta" | "champagne";

const palettes: Record<CloudPalette, { base: [number, number, number]; cloud: [number, number, number]; accent: [number, number, number]; highlight: [number, number, number] }> = {
  coral: {
    base: [0.28, 0.025, 0.19],
    cloud: [1.0, 0.13, 0.42],
    accent: [1.0, 0.31, 0.25],
    highlight: [1.0, 0.73, 0.58]
  },
  magenta: {
    base: [0.22, 0.015, 0.28],
    cloud: [0.96, 0.035, 0.58],
    accent: [0.72, 0.12, 0.82],
    highlight: [1.0, 0.43, 0.62]
  },
  champagne: {
    base: [0.31, 0.035, 0.21],
    cloud: [1.0, 0.18, 0.48],
    accent: [1.0, 0.44, 0.34],
    highlight: [1.0, 0.82, 0.57]
  }
};

const vertexShader = `#version 300 es
in vec2 position;
void main(){gl_Position=vec4(position,0.,1.);}`;

const fragmentShader = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform vec3 baseColor;
uniform vec3 cloudColor;
uniform vec3 accentColor;
uniform vec3 highlightColor;
out vec4 outputColor;

float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);
}
float fbm(vec2 p){
  float value=0.,amplitude=.52;
  mat2 turn=mat2(.82,-.57,.57,.82);
  for(int i=0;i<5;i++){value+=amplitude*noise(p);p=turn*p*2.03+3.1;amplitude*=.5;}
  return value;
}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*resolution)/max(resolution.y,1.);
  float t=time*.075;
  vec2 drift=vec2(t,-t*.42);
  float broad=fbm(uv*1.42+drift);
  float folded=fbm(uv*2.35+vec2(-t*.68,t*.31)+broad*.75);
  float body=smoothstep(.24,.91,broad*.76+folded*.48);
  float rim=smoothstep(.52,.94,folded)-smoothstep(.78,1.,folded);
  float light=pow(max(0.,1.-length(uv-vec2(-.22,.12))),3.2);
  vec3 col=mix(baseColor,cloudColor*(.72+.48*folded),body*.92);
  col=mix(col,accentColor,clamp(rim*.48+broad*.16,0.,.58));
  col+=highlightColor*(light*.32+rim*.18);
  col=pow(col,vec3(.88));
  outputColor=vec4(col,1.);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function FlowingCloudShader({ palette, className = "" }: { palette: CloudPalette; className?: string }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const shell = shellRef.current;
    const canvas = canvasRef.current;
    if (!shell || !canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, powerPreference: "low-power" });
    if (!gl) return;
    const vertex = compile(gl, gl.VERTEX_SHADER, vertexShader);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentShader);
    if (!vertex || !fragment) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resolution = gl.getUniformLocation(program, "resolution");
    const clock = gl.getUniformLocation(program, "time");
    const colors = palettes[palette];
    gl.uniform3fv(gl.getUniformLocation(program, "baseColor"), colors.base);
    gl.uniform3fv(gl.getUniformLocation(program, "cloudColor"), colors.cloud);
    gl.uniform3fv(gl.getUniformLocation(program, "accentColor"), colors.accent);
    gl.uniform3fv(gl.getUniformLocation(program, "highlightColor"), colors.highlight);
    gl.clearColor(colors.base[0], colors.base[1], colors.base[2], 1);

    let visible = false;
    let frame = 0;
    let started = performance.now();
    const resize = () => {
      const rect = shell.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2) * .5;
      canvas.width = Math.max(1, Math.round(rect.width * scale));
      canvas.height = Math.max(1, Math.round(rect.height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(resolution, canvas.width, canvas.height);
    };
    const draw = (now: number) => {
      frame = 0;
      if (!visible || document.hidden) return;
      gl.uniform1f(clock, (now - started) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      frame = requestAnimationFrame(draw);
    };
    const resume = () => {
      if (!visible || document.hidden || frame) return;
      frame = requestAnimationFrame(draw);
    };
    const stop = () => { if (frame) cancelAnimationFrame(frame); frame = 0; };
    const observer = new IntersectionObserver(entries => {
      visible = Boolean(entries[0]?.isIntersecting);
      if (visible) resume(); else stop();
    }, { rootMargin: "80px" });
    const visibility = () => document.hidden ? stop() : resume();
    const resizeObserver = new ResizeObserver(resize);
    observer.observe(shell);
    resizeObserver.observe(shell);
    document.addEventListener("visibilitychange", visibility);
    resize();
    return () => {
      stop();
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.deleteBuffer(buffer);
    };
  }, [palette]);

  return (
    <div ref={shellRef} className={`flowingCloudShader palette-${palette} ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}

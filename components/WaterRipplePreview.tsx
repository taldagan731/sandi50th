"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ShaderPerformanceMeter } from "@/components/ShaderPerformanceMeter";

type RippleStrength = "whisper" | "gentle" | "lively";

const strengths: Record<RippleStrength, { label: string; description: string; amplitude: number; shimmer: number }> = {
  whisper: { label: "Whisper", description: "A subtle but visible swell and reflected shimmer.", amplitude: 1.05, shimmer: 0.4 },
  gentle: { label: "Gentle", description: "Natural movement that is immediately visible without looking artificial.", amplitude: 2.15, shimmer: 0.62 },
  lively: { label: "Lively", description: "The clearest ripple, still masked away from Sandi and the sky.", amplitude: 3.4, shimmer: 0.82 }
};

const vertexShader = `#version 300 es
in vec2 position;
void main(){gl_Position=vec4(position,0.,1.);}`;

const fragmentShader = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform vec2 imageSize;
uniform float time;
uniform float amplitude;
uniform float shimmerAmount;
uniform sampler2D photograph;
out vec4 outputColor;

float segmentDistance(vec2 p, vec2 a, vec2 b){
  vec2 pa=p-a,ba=b-a;
  float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);
  return length(pa-ba*h);
}

void main(){
  vec2 destination=vec2(gl_FragCoord.x,resolution.y-gl_FragCoord.y);
  float scale=max(resolution.x/imageSize.x,resolution.y/imageSize.y);
  vec2 rendered=imageSize*scale;
  vec2 offset=(resolution-rendered)*vec2(.42,.48);
  vec2 source=(destination-offset)/rendered;
  if(any(lessThan(source,vec2(0.)))||any(greaterThan(source,vec2(1.)))) discard;

  float horizon=smoothstep(.215,.252,source.y);
  float bodyA=segmentDistance(source,vec2(.397,.292),vec2(.407,.485));
  float bodyB=segmentDistance(source,vec2(.408,.435),vec2(.419,.626));
  float person=min(bodyA/.044,bodyB/.047);
  float personKeep=smoothstep(.84,1.12,person);
  float waterMask=horizon*personKeep;

  float swell=sin(source.y*48.-time*1.18+sin(source.x*7.)*.34);
  float crossWave=sin(source.y*81.+source.x*13.-time*.81);
  float slowDrift=sin(source.x*19.+source.y*9.+time*.47);
  vec2 displacement=vec2(
    (swell*.72+crossWave*.28)*.00125,
    (crossWave*.58+slowDrift*.42)*.00052
  )*amplitude*waterMask;

  vec3 color=texture(photograph,vec2(source.x+displacement.x,1.-source.y-displacement.y)).rgb;
  float shimmer=pow(max(0.,sin(source.x*42.+source.y*67.-time*.72)),8.);
  shimmer*=smoothstep(.27,.78,source.y)*(1.-smoothstep(.78,.98,source.y))*waterMask;
  color+=vec3(1.,.84,.68)*shimmer*.072*shimmerAmount;
  outputColor=vec4(color,waterMask);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
  return shader;
}

type MotionState = "checking" | "active" | "reduced" | "unavailable" | "failed";

function WaterRippleLayer({ strength, onState }: { strength: RippleStrength; onState: (state: MotionState) => void }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const shell=shellRef.current,canvas=canvasRef.current;
    if(!shell||!canvas)return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){onState("reduced");return;}
    const gl=canvas.getContext("webgl2",{alpha:true,antialias:false,premultipliedAlpha:false,powerPreference:"low-power"});
    if(!gl){onState("unavailable");return;}
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexShader),fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentShader);
    if(!vertex||!fragment){onState("failed");return;}
    const program=gl.createProgram();
    if(!program){onState("failed");return;}
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)){onState("failed");return;}
    gl.useProgram(program);
    const buffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,"position");
    gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    const texture=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    const image=new window.Image();
    let ready=false,visible=false,frame=0,started=performance.now();
    const resolution=gl.getUniformLocation(program,"resolution");
    const clock=gl.getUniformLocation(program,"time");
    const resize=()=>{
      const rect=shell.getBoundingClientRect();
      const scale=Math.min(window.devicePixelRatio||1,2)*.5;
      canvas.width=Math.max(1,Math.round(rect.width*scale));canvas.height=Math.max(1,Math.round(rect.height*scale));
      gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(resolution,canvas.width,canvas.height);
    };
    const stop=()=>{if(frame)cancelAnimationFrame(frame);frame=0;};
    const draw=(now:number)=>{frame=0;if(!visible||document.hidden||!ready)return;gl.uniform1f(clock,(now-started)/1000);gl.drawArrays(gl.TRIANGLES,0,3);frame=requestAnimationFrame(draw);};
    const resume=()=>{if(visible&&!document.hidden&&ready&&!frame)frame=requestAnimationFrame(draw);};
    image.onload=()=>{
      gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
      gl.uniform2f(gl.getUniformLocation(program,"imageSize"),image.naturalWidth,image.naturalHeight);
      gl.uniform1i(gl.getUniformLocation(program,"photograph"),0);
      ready=true;canvas.dataset.ready="true";onState("active");resume();
    };
    image.onerror=()=>onState("failed");
    image.src="/images/sandi-hero.jpeg";
    const observer=new IntersectionObserver(entries=>{visible=Boolean(entries[0]?.isIntersecting);if(visible)resume();else stop();},{rootMargin:"80px"});
    const visibility=()=>document.hidden?stop():resume();
    const resizeObserver=new ResizeObserver(resize);
    gl.uniform1f(gl.getUniformLocation(program,"amplitude"),strengths[strength].amplitude);
    gl.uniform1f(gl.getUniformLocation(program,"shimmerAmount"),strengths[strength].shimmer);
    gl.clearColor(0,0,0,0);observer.observe(shell);resizeObserver.observe(shell);document.addEventListener("visibilitychange",visibility);resize();
    return()=>{stop();observer.disconnect();resizeObserver.disconnect();document.removeEventListener("visibilitychange",visibility);image.onload=null;image.onerror=null;gl.deleteTexture(texture);gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);gl.deleteBuffer(buffer);};
  },[strength,onState]);

  return <div ref={shellRef} className="waterRippleLayer" aria-hidden="true"><canvas ref={canvasRef}/></div>;
}

export function WaterRipplePreview(){
  const [strength,setStrength]=useState<RippleStrength>("gentle");
  const [motionState,setMotionState]=useState<MotionState>("checking");
  const current=strengths[strength];
  return <section className="waterPreviewComparison">
    <header><p>PRIVATE MOTION STUDY</p><h1>Beach water, gently alive</h1><span>The photograph appears first. WebGL adds only the masked water layer afterward.</span></header>
    <div className="waterPreviewStage">
      <Image className="waterPreviewPhoto" src="/images/sandi-hero.jpeg" alt="Sandi standing in the water at the beach" fill priority sizes="100vw"/>
      <WaterRippleLayer strength={strength} onState={setMotionState}/>
      <p className="waterMotionStatus" data-state={motionState} aria-live="polite">{motionState==="active"?"Motion active · masked water only":motionState==="reduced"?"Static by design · Reduced Motion is enabled on this device":motionState==="unavailable"?"Static fallback · WebGL2 is unavailable":motionState==="failed"?"Static fallback · the animation layer could not start":"Checking the animation layer…"}</p>
      <div className="waterPreviewCopy"><span>50</span><strong>Sandi Yadegari</strong></div>
    </div>
    <div className="waterPreviewChoices" role="radiogroup" aria-label="Water movement intensity">
      {(Object.entries(strengths) as Array<[RippleStrength,typeof current]>).map(([id,option])=><button key={id} type="button" role="radio" aria-checked={strength===id} onClick={()=>setStrength(id)}><strong>{option.label}</strong><span>{option.description}</span></button>)}
    </div>
    <ShaderPerformanceMeter sampleKey={strength}/>
    <p className="waterPreviewNote"><strong>Selected:</strong> {current.label}. Sandi and the sky are excluded by a feathered hand-authored mask.</p>
  </section>;
}
